import countries from "world-countries";

export const runtime = "edge";

type Severity = "critical" | "elevated" | "watch" | "stable";
type LiveLayer =
  | "Earthquakes" | "Wildfires" | "Storms" | "Volcanoes" | "Floods"
  | "Droughts" | "Landslides" | "Dust & haze" | "Other natural"
  | "Air quality" | "Humanitarian" | "Outbreaks";

export type IntelEvent = {
  id: string; layer: LiveLayer; title: string; summary: string;
  lat: number; lng: number; occurredAt: string; severity: Severity;
  source: string; sourceUrl: string; location?: string; category?: string;
  magnitude?: number; active?: boolean;
};

const USGS_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson";
const EONET_URL = "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=30&limit=250";
const GDACS_URL = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC%3BFL%3BVO%3BDR%3BWF";
const RELIEFWEB_URL = "https://api.reliefweb.int/v1/disasters?appname=atlas-intelligence-map&limit=100&profile=full&preset=latest";
const WHO_URL = "https://www.who.int/api/news/diseaseoutbreaknews?$filter=lang%20eq%20'en'&$orderby=PublicationDateAndTime%20desc&$top=60";
const OPEN_METEO_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";

type AirSite = { name: string; country: string; lat: number; lng: number };
const airSites: AirSite[] = [
  {name:"Toronto",country:"Canada",lat:43.65,lng:-79.38},{name:"Vancouver",country:"Canada",lat:49.28,lng:-123.12},
  {name:"Montreal",country:"Canada",lat:45.5,lng:-73.57},{name:"Calgary",country:"Canada",lat:51.05,lng:-114.07},
  {name:"New York",country:"United States",lat:40.71,lng:-74.01},{name:"Los Angeles",country:"United States",lat:34.05,lng:-118.24},
  {name:"Mexico City",country:"Mexico",lat:19.43,lng:-99.13},{name:"São Paulo",country:"Brazil",lat:-23.55,lng:-46.63},
  {name:"Bogotá",country:"Colombia",lat:4.71,lng:-74.07},{name:"London",country:"United Kingdom",lat:51.51,lng:-0.13},
  {name:"Paris",country:"France",lat:48.86,lng:2.35},{name:"Madrid",country:"Spain",lat:40.42,lng:-3.7},
  {name:"Berlin",country:"Germany",lat:52.52,lng:13.41},{name:"Warsaw",country:"Poland",lat:52.23,lng:21.01},
  {name:"Cairo",country:"Egypt",lat:30.04,lng:31.24},{name:"Lagos",country:"Nigeria",lat:6.52,lng:3.38},
  {name:"Nairobi",country:"Kenya",lat:-1.29,lng:36.82},{name:"Johannesburg",country:"South Africa",lat:-26.2,lng:28.05},
  {name:"Istanbul",country:"Türkiye",lat:41.01,lng:28.98},{name:"Dubai",country:"United Arab Emirates",lat:25.2,lng:55.27},
  {name:"Delhi",country:"India",lat:28.61,lng:77.21},{name:"Mumbai",country:"India",lat:19.08,lng:72.88},
  {name:"Dhaka",country:"Bangladesh",lat:23.81,lng:90.41},{name:"Bangkok",country:"Thailand",lat:13.76,lng:100.5},
  {name:"Singapore",country:"Singapore",lat:1.35,lng:103.82},{name:"Jakarta",country:"Indonesia",lat:-6.21,lng:106.85},
  {name:"Beijing",country:"China",lat:39.9,lng:116.41},{name:"Shanghai",country:"China",lat:31.23,lng:121.47},
  {name:"Seoul",country:"South Korea",lat:37.57,lng:126.98},{name:"Tokyo",country:"Japan",lat:35.68,lng:139.69},
  {name:"Sydney",country:"Australia",lat:-33.87,lng:151.21},{name:"Melbourne",country:"Australia",lat:-37.81,lng:144.96},
];

const countryPoints = countries.flatMap((country) => country.latlng.length >= 2 ? [{
  cca3: country.cca3, name: country.name.common, lat: country.latlng[0], lng: country.latlng[1],
  aliases: [country.name.common,country.name.official],
}] : []);

const validNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const validDate = (value: unknown) => {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};
const plainText = (value: unknown) => typeof value === "string"
  ? value.replace(/<[^>]*>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/\s+/g," ").trim()
  : "";
const escapePattern = (value:string) => value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
const severityForMagnitude = (magnitude: number): Severity => magnitude >= 7 ? "critical" : magnitude >= 6 ? "elevated" : magnitude >= 5 ? "watch" : "stable";
const naturalLayer = (category: string): LiveLayer =>
  /wildfire|forest fire|\bfire\b|^wf$/i.test(category) ? "Wildfires" :
  /storm|cyclone|hurricane|typhoon|^tc$/i.test(category) ? "Storms" :
  /volcano|eruption|^vo$/i.test(category) ? "Volcanoes" :
  /flood|^fl$/i.test(category) ? "Floods" :
  /drought|dry spell|^dr$/i.test(category) ? "Droughts" :
  /landslide|mudslide|rockslide|avalanche/i.test(category) ? "Landslides" :
  /dust|haze|sandstorm/i.test(category) ? "Dust & haze" :
  /earthquake|seismic|^eq$/i.test(category) ? "Earthquakes" : "Other natural";
const naturalSeverity = (layer: LiveLayer, title: string): Severity =>
  /red alert|cat(?:egory)?\s*[45]|major|severe|extreme|emergency/i.test(title) ? "elevated" :
  layer === "Storms" || layer === "Wildfires" || layer === "Landslides" ? "watch" : "stable";

function pointFromCoordinates(value: unknown): { lat: number; lng: number } | null {
  if (!Array.isArray(value)) return null;
  if (validNumber(value[0]) && validNumber(value[1])) {
    return Math.abs(value[1]) <= 90 && Math.abs(value[0]) <= 180 ? { lng: value[0], lat: value[1] } : null;
  }
  const points = value.map(pointFromCoordinates).filter((point): point is { lat: number; lng: number } => point !== null);
  if (!points.length) return null;
  return {lat:points.reduce((sum,point)=>sum+point.lat,0)/points.length,lng:points.reduce((sum,point)=>sum+point.lng,0)/points.length};
}

async function fetchJson(url: string) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(url, {
      headers: { Accept: "application/geo+json, application/json", "User-Agent": "ATLAS-Intelligence-Map/3.0" },
      signal: AbortSignal.timeout(9000),
      cf: { cacheTtl: 300, cacheEverything: true },
    } as RequestInit & { cf: { cacheTtl: number; cacheEverything: boolean } });
    if (response.ok) return response.json() as Promise<unknown>;
    if (attempt === 0 && [429,502,503,504].includes(response.status)) continue;
    throw new Error(`${response.status}`);
  }
  throw new Error("source unavailable");
}

export function parseUsgs(payload: unknown): IntelEvent[] {
  const features = payload && typeof payload === "object" && (payload as { features?: unknown }).features;
  if (!Array.isArray(features)) return [];
  return features.flatMap((feature,index) => {
    if (!feature || typeof feature !== "object") return [];
    const record = feature as { id?: unknown; properties?: Record<string,unknown>; geometry?: { coordinates?: unknown } };
    const point = pointFromCoordinates(record.geometry?.coordinates);
    if (!point) return [];
    const properties = record.properties ?? {};
    const magnitude = validNumber(properties.mag) ? properties.mag : 0;
    const occurredAt = validNumber(properties.time) ? new Date(properties.time).toISOString() : new Date().toISOString();
    const title = typeof properties.title === "string" ? properties.title : `Magnitude ${magnitude.toFixed(1)} earthquake`;
    const sourceUrl = typeof properties.url === "string" ? properties.url : "https://earthquake.usgs.gov/";
    return [{id:`usgs-${String(record.id??index)}`,layer:"Earthquakes" as const,title,summary:`USGS recorded a magnitude ${magnitude.toFixed(1)} event. Depth and local impact details are available at the original source.`,...point,occurredAt,severity:severityForMagnitude(magnitude),source:"USGS Earthquake Hazards Program",sourceUrl,magnitude,active:false}];
  });
}

export function parseEonet(payload: unknown): IntelEvent[] {
  const events = payload && typeof payload === "object" && (payload as { events?: unknown }).events;
  if (!Array.isArray(events)) return [];
  return events.flatMap((event,index) => {
    if (!event || typeof event !== "object") return [];
    const record = event as { id?: unknown; title?: unknown; description?: unknown; closed?: unknown; categories?: Array<{id?:unknown;title?:unknown}>; geometry?: Array<{date?:unknown;coordinates?:unknown}>; sources?: Array<{url?:unknown}> };
    const geometries = Array.isArray(record.geometry) ? [...record.geometry].reverse() : [];
    const locatedGeometry = geometries.find((geometry)=>pointFromCoordinates(geometry.coordinates));
    const point = pointFromCoordinates(locatedGeometry?.coordinates);
    if (!locatedGeometry || !point) return [];
    const category = record.categories?.map((item)=>typeof item.title === "string" ? item.title : typeof item.id === "string" ? item.id : "").find(Boolean) ?? "Natural event";
    const layer = naturalLayer(category);
    const title = typeof record.title === "string" ? record.title : category;
    const sourceUrl = record.sources?.map((source)=>source.url).find((url):url is string=>typeof url === "string"&&url.startsWith("http")) ?? "https://eonet.gsfc.nasa.gov/";
    const description = typeof record.description === "string" && record.description.trim() ? record.description.trim() : `${category} tracked through NASA's Earth Observatory Natural Event Tracker.`;
    return [{id:`eonet-${String(record.id??index)}`,layer,title,summary:description,...point,occurredAt:validDate(locatedGeometry.date)??new Date().toISOString(),severity:naturalSeverity(layer,title),source:"NASA EONET",sourceUrl,active:record.closed==null,category}];
  });
}

export function parseGdacs(payload: unknown): IntelEvent[] {
  const features = payload && typeof payload === "object" && (payload as { features?: unknown }).features;
  if (!Array.isArray(features)) return [];
  return features.flatMap((feature,index) => {
    if (!feature || typeof feature !== "object") return [];
    const record = feature as {geometry?:{coordinates?:unknown};properties?:Record<string,unknown>};
    const properties = record.properties ?? {};
    const point = pointFromCoordinates(record.geometry?.coordinates) ?? (validNumber(properties.longitude)&&validNumber(properties.latitude)?{lng:properties.longitude,lat:properties.latitude}:null);
    if (!point) return [];
    const eventType = typeof properties.eventtype === "string" ? properties.eventtype : typeof properties.eventType === "string" ? properties.eventType : "";
    const layer = naturalLayer(eventType || String(properties.eventtypename ?? properties.eventTypeName ?? "Natural event"));
    if (layer === "Earthquakes") return [];
    const title = typeof properties.name === "string" && properties.name.trim() ? properties.name.trim() : `${layer} alert`;
    const alertLevel = String(properties.alertlevel ?? properties.alertLevel ?? "").toLowerCase();
    const severity: Severity = alertLevel === "red" ? "critical" : alertLevel === "orange" ? "elevated" : naturalSeverity(layer,title);
    const eventId = String(properties.eventid ?? properties.eventId ?? index);
    const episodeId = String(properties.episodeid ?? properties.episodeId ?? "latest");
    const sourceUrl = typeof properties.url === "object" && properties.url !== null && typeof (properties.url as {report?:unknown}).report === "string"
      ? (properties.url as {report:string}).report
      : `https://www.gdacs.org/report.aspx?eventid=${encodeURIComponent(eventId)}&episodeid=${encodeURIComponent(episodeId)}&eventtype=${encodeURIComponent(eventType)}`;
    const summarySource = properties.description ?? properties.htmldescription ?? properties.eventname ?? properties.eventName;
    const summary = plainText(summarySource) || `${layer} event monitored by the Global Disaster Alert and Coordination System.`;
    return [{id:`gdacs-${eventType}-${eventId}-${episodeId}`,layer,title,summary,...point,occurredAt:validDate(properties.fromdate??properties.fromDate??properties.datemodified??properties.dateModified)??new Date().toISOString(),severity,source:"GDACS (UN / European Commission)",sourceUrl,active:properties.iscurrent!==false&&properties.isCurrent!==false,category:eventType||layer}];
  });
}

const airSeverity = (aqi:number):Severity => aqi>=201?"critical":aqi>=151?"elevated":aqi>=101?"watch":"stable";
export function parseAirQuality(payload: unknown, sites: AirSite[] = airSites): IntelEvent[] {
  const records = Array.isArray(payload) ? payload : [payload];
  return records.flatMap((item,index) => {
    if (!item || typeof item !== "object" || !sites[index]) return [];
    const current = (item as {current?:Record<string,unknown>}).current ?? {};
    const aqi = current.us_aqi;
    if (!validNumber(aqi) || aqi < 51) return [];
    const site = sites[index];
    const pm25 = validNumber(current.pm2_5) ? current.pm2_5.toFixed(1) : "n/a";
    const pm10 = validNumber(current.pm10) ? current.pm10.toFixed(1) : "n/a";
    return [{id:`air-${site.name.toLowerCase().replace(/\W+/g,"-")}`,layer:"Air quality" as const,title:`${site.name} air quality: AQI ${Math.round(aqi)}`,summary:`Current modelled US AQI ${Math.round(aqi)} · PM2.5 ${pm25} µg/m³ · PM10 ${pm10} µg/m³.`,lat:site.lat,lng:site.lng,occurredAt:validDate(current.time)??new Date().toISOString(),severity:airSeverity(aqi),source:"Open-Meteo Air Quality",sourceUrl:"https://open-meteo.com/en/docs/air-quality-api",location:`${site.name}, ${site.country}`,category:"Urban air quality",active:true}];
  });
}

async function fetchAirQuality() {
  const events: IntelEvent[] = [];
  for (let index=0; index<airSites.length; index+=8) {
    const sites = airSites.slice(index,index+8);
    const query = new URLSearchParams({latitude:sites.map((site)=>site.lat).join(","),longitude:sites.map((site)=>site.lng).join(","),current:"us_aqi,pm2_5,pm10",timezone:"UTC"});
    events.push(...parseAirQuality(await fetchJson(`${OPEN_METEO_URL}?${query}`),sites));
  }
  return events;
}

function pointForCountry(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string,unknown>;
  const iso3 = String(record.iso3 ?? record.iso ?? record.code ?? "").toUpperCase();
  const name = plainText(record.name ?? record.shortname ?? record.title);
  const matched = countryPoints.find((country)=>country.cca3===iso3) ?? countryPoints.find((country)=>country.aliases.some((alias)=>alias.toLowerCase()===name.toLowerCase()));
  return matched ? {name:matched.name,lat:matched.lat,lng:matched.lng} : null;
}

export function parseReliefWeb(payload: unknown): IntelEvent[] {
  const data = payload && typeof payload === "object" && (payload as {data?:unknown}).data;
  if (!Array.isArray(data)) return [];
  return data.flatMap((item,index) => {
    if (!item || typeof item !== "object") return [];
    const record = item as {id?:unknown;fields?:Record<string,unknown>;href?:unknown};
    const fields = record.fields ?? {};
    const title = plainText(fields.name ?? fields.title) || "Humanitarian situation update";
    const locations = Array.isArray(fields.country) ? fields.country.map(pointForCountry).filter((point):point is {name:string;lat:number;lng:number}=>point!==null) : [];
    if (!locations.length) return [];
    const types = Array.isArray(fields.type) ? fields.type.map((value)=>plainText(value&&typeof value==="object"?(value as Record<string,unknown>).name:value)).filter(Boolean) : [];
    const status = plainText(fields.status);
    const dates = fields.date && typeof fields.date === "object" ? fields.date as Record<string,unknown> : {};
    const occurredAt = validDate(dates.changed ?? dates.created ?? fields.date) ?? new Date().toISOString();
    const summary = [types.length?types.join(", "):"Humanitarian emergency",status?`Status: ${status}`:"Active situation"].join(" · ");
    const sourceUrl = typeof fields.url === "string" ? fields.url : typeof record.href === "string" ? record.href : "https://reliefweb.int/disasters";
    return locations.map((location,locationIndex)=>({id:`reliefweb-${String(record.id??index)}-${locationIndex}`,layer:"Humanitarian" as const,title,summary,lat:location.lat,lng:location.lng,occurredAt,severity:/alert|emergency|ongoing|current/i.test(status)?"elevated" as const:"watch" as const,source:"ReliefWeb (UN OCHA)",sourceUrl,location:location.name,category:types.join(", ")||"Humanitarian crisis",active:!/past|closed/i.test(status)}));
  });
}

const countryNameReplacements: Array<[string,string]> = [
  ["USA","United States"],["U.S.","United States"],["UK","United Kingdom"],["DRC","DR Congo"],
  ["Democratic Republic of the Congo","DR Congo"],["Ivory Coast","Côte d'Ivoire"],["Türkiye","Turkey"],
];
function countryFromText(value:string) {
  const normalized = countryNameReplacements.reduce((text,[alias,name])=>text.replace(new RegExp(`\\b${escapePattern(alias)}\\b`,`gi`),name),value);
  return countryPoints
    .flatMap((country)=>country.aliases.map((alias)=>({country,alias})))
    .sort((left,right)=>right.alias.length-left.alias.length)
    .find(({alias})=>new RegExp(`(^|[^\\p{L}])${escapePattern(alias)}(?=$|[^\\p{L}])`,`iu`).test(normalized))?.country;
}

export function parseWhoOutbreaks(payload: unknown): IntelEvent[] {
  const data = payload && typeof payload === "object" && (payload as {value?:unknown}).value;
  if (!Array.isArray(data)) return [];
  const cutoff = Date.now()-90*24*60*60*1000;
  return data.flatMap((item,index) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string,unknown>;
    const title = plainText(record.Title ?? record.title);
    const summary = plainText(record.Summary ?? record.summary ?? record.Content ?? record.content);
    const occurredAt = validDate(record.PublicationDateAndTime ?? record.PublicationDate ?? record.date) ?? new Date().toISOString();
    if (!title || Date.parse(occurredAt)<cutoff) return [];
    const country = countryFromText(`${title} ${summary}`);
    if (!country) return [];
    const itemUrl = plainText(record.ItemDefaultUrl ?? record.UrlName ?? record.url);
    const sourceUrl = itemUrl.startsWith("http") ? itemUrl : itemUrl ? `https://www.who.int${itemUrl.startsWith("/")?"":"/"}${itemUrl}` : "https://www.who.int/emergencies/disease-outbreak-news";
    return [{id:`who-${index}-${title.toLowerCase().replace(/\W+/g,"-").slice(0,48)}`,layer:"Outbreaks" as const,title,summary:summary||"WHO Disease Outbreak News update.",lat:country.lat,lng:country.lng,occurredAt,severity:/emergency|rapidly|widespread|high risk/i.test(`${title} ${summary}`)?"elevated":"watch",source:"WHO Disease Outbreak News",sourceUrl,location:country.name,category:"Public health outbreak",active:true}];
  });
}

function dedupeEvents(events: IntelEvent[]) {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = `${event.layer}:${event.title.toLowerCase().replace(/\W+/g," ").trim()}:${event.lat.toFixed(1)}:${event.lng.toFixed(1)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function GET() {
  const fetchedAt = new Date().toISOString();
  const [usgs,eonet,gdacs,air,reliefweb,who] = await Promise.allSettled([
    fetchJson(USGS_URL),fetchJson(EONET_URL),fetchJson(GDACS_URL),fetchAirQuality(),fetchJson(RELIEFWEB_URL),fetchJson(WHO_URL),
  ]);
  const events = dedupeEvents([
    ...(usgs.status==="fulfilled"?parseUsgs(usgs.value):[]),
    ...(eonet.status==="fulfilled"?parseEonet(eonet.value):[]),
    ...(gdacs.status==="fulfilled"?parseGdacs(gdacs.value):[]),
    ...(air.status==="fulfilled"?air.value:[]),
    ...(reliefweb.status==="fulfilled"?parseReliefWeb(reliefweb.value):[]),
    ...(who.status==="fulfilled"?parseWhoOutbreaks(who.value):[]),
  ]);
  const sources = [
    {id:"usgs",label:"USGS Earthquake Hazards Program",url:USGS_URL,status:usgs.status==="fulfilled"?"live":"unavailable"},
    {id:"eonet",label:"NASA EONET",url:EONET_URL,status:eonet.status==="fulfilled"?"live":"unavailable"},
    {id:"gdacs",label:"GDACS (UN / European Commission)",url:GDACS_URL,status:gdacs.status==="fulfilled"?"live":"unavailable"},
    {id:"air",label:"Open-Meteo Air Quality",url:"https://open-meteo.com/en/docs/air-quality-api",status:air.status==="fulfilled"?"live":"unavailable"},
    {id:"reliefweb",label:"ReliefWeb (UN OCHA)",url:"https://reliefweb.int/disasters",status:reliefweb.status==="fulfilled"?"live":"unavailable"},
    {id:"who",label:"WHO Disease Outbreak News",url:"https://www.who.int/emergencies/disease-outbreak-news",status:who.status==="fulfilled"?"live":"unavailable"},
  ];
  const liveSources = sources.filter((source)=>source.status==="live").length;
  return Response.json({fetchedAt,status:liveSources===sources.length?"live":liveSources?"partial":"unavailable",events,sources},{headers:{"Cache-Control":"public, max-age=300, s-maxage=900, stale-while-revalidate=3600"}});
}
