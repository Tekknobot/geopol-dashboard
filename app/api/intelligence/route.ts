export const runtime = "edge";

type Severity = "critical" | "elevated" | "watch" | "stable";
type IntelEvent = {
  id:string;
  layer:"Earthquakes"|"Wildfires"|"Storms"|"Volcanoes"|"Floods"|"Other natural";
  title:string;
  summary:string;
  lat:number;
  lng:number;
  occurredAt:string;
  severity:Severity;
  source:string;
  sourceUrl:string;
  magnitude?:number;
};

const USGS_URL="https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson";
const EONET_URL="https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=120";
const validNumber=(value:unknown):value is number=>typeof value==="number"&&Number.isFinite(value);
const severityForMagnitude=(magnitude:number):Severity=>magnitude>=7?"critical":magnitude>=6?"elevated":magnitude>=5?"watch":"stable";
const naturalLayer=(category:string):IntelEvent["layer"]=>/wildfire/i.test(category)?"Wildfires":/storm|cyclone/i.test(category)?"Storms":/volcano/i.test(category)?"Volcanoes":/flood/i.test(category)?"Floods":"Other natural";
const naturalSeverity=(layer:IntelEvent["layer"],title:string):Severity=>/major|severe|extreme|emergency/i.test(title)?"elevated":layer==="Storms"||layer==="Wildfires"?"watch":"stable";

async function fetchJson(url:string){
  const response=await fetch(url,{headers:{Accept:"application/json","User-Agent":"ATLAS-Intelligence-Map/1.0"},signal:AbortSignal.timeout(7000),cf:{cacheTtl:300,cacheEverything:true}} as RequestInit & {cf:{cacheTtl:number;cacheEverything:boolean}});
  if(!response.ok)throw new Error(`${response.status}`);
  return response.json() as Promise<unknown>;
}

function parseUsgs(payload:unknown):IntelEvent[]{
  const features=(payload&&typeof payload==="object"&&(payload as {features?:unknown}).features);
  if(!Array.isArray(features))return [];
  return features.flatMap((feature,index)=>{
    if(!feature||typeof feature!=="object")return [];
    const record=feature as {id?:unknown;properties?:Record<string,unknown>;geometry?:{coordinates?:unknown}};
    const coordinates=record.geometry?.coordinates;
    if(!Array.isArray(coordinates)||!validNumber(coordinates[0])||!validNumber(coordinates[1]))return [];
    const properties=record.properties??{};
    const magnitude=validNumber(properties.mag)?properties.mag:0;
    const occurredAt=validNumber(properties.time)?new Date(properties.time).toISOString():new Date().toISOString();
    const title=typeof properties.title==="string"?properties.title:`Magnitude ${magnitude.toFixed(1)} earthquake`;
    const sourceUrl=typeof properties.url==="string"?properties.url:"https://earthquake.usgs.gov/";
    return [{id:`usgs-${String(record.id??index)}`,layer:"Earthquakes" as const,title,summary:`USGS recorded a magnitude ${magnitude.toFixed(1)} event. Depth and local impact details are available at the original source.`,lat:coordinates[1],lng:coordinates[0],occurredAt,severity:severityForMagnitude(magnitude),source:"USGS Earthquake Hazards Program",sourceUrl,magnitude}];
  });
}

function parseEonet(payload:unknown):IntelEvent[]{
  const events=payload&&typeof payload==="object"&&(payload as {events?:unknown}).events;
  if(!Array.isArray(events))return [];
  return events.flatMap((event,index)=>{
    if(!event||typeof event!=="object")return [];
    const record=event as {id?:unknown;title?:unknown;description?:unknown;categories?:Array<{title?:unknown}>;geometry?:Array<{date?:unknown;coordinates?:unknown}>;sources?:Array<{url?:unknown}>};
    const geometry=record.geometry?.at(-1);
    if(!geometry||!Array.isArray(geometry.coordinates)||!validNumber(geometry.coordinates[0])||!validNumber(geometry.coordinates[1]))return [];
    const category=record.categories?.map((item)=>typeof item.title==="string"?item.title:"").find(Boolean)??"Natural event";
    const layer=naturalLayer(category);
    const title=typeof record.title==="string"?record.title:category;
    const sourceUrl=record.sources?.map((source)=>source.url).find((url):url is string=>typeof url==="string"&&url.startsWith("http"))??"https://eonet.gsfc.nasa.gov/";
    const description=typeof record.description==="string"&&record.description.trim()?record.description.trim():`${category} tracked through NASA's Earth Observatory Natural Event Tracker.`;
    return [{id:`eonet-${String(record.id??index)}`,layer,title,summary:description,lat:geometry.coordinates[1],lng:geometry.coordinates[0],occurredAt:typeof geometry.date==="string"?geometry.date:new Date().toISOString(),severity:naturalSeverity(layer,title),source:"NASA EONET",sourceUrl}];
  });
}

export async function GET(){
  const fetchedAt=new Date().toISOString();
  const [usgs,eonet]=await Promise.allSettled([fetchJson(USGS_URL),fetchJson(EONET_URL)]);
  const events=[...(usgs.status==="fulfilled"?parseUsgs(usgs.value):[]),...(eonet.status==="fulfilled"?parseEonet(eonet.value):[])];
  const sources=[
    {id:"usgs",label:"USGS Earthquake Hazards Program",url:USGS_URL,status:usgs.status==="fulfilled"?"live":"unavailable"},
    {id:"eonet",label:"NASA EONET",url:EONET_URL,status:eonet.status==="fulfilled"?"live":"unavailable"},
  ];
  const liveSources=sources.filter((source)=>source.status==="live").length;
  return Response.json({fetchedAt,status:liveSources===sources.length?"live":liveSources?"partial":"unavailable",events,sources},{headers:{"Cache-Control":"public, max-age=120, s-maxage=300, stale-while-revalidate=900"}});
}
