export const runtime = "edge";

type Severity = "critical" | "elevated" | "watch" | "stable";
type NaturalLayer = "Earthquakes" | "Wildfires" | "Storms" | "Volcanoes" | "Floods" | "Other natural";
export type IntelEvent = {
  id: string;
  layer: NaturalLayer;
  title: string;
  summary: string;
  lat: number;
  lng: number;
  occurredAt: string;
  severity: Severity;
  source: string;
  sourceUrl: string;
  magnitude?: number;
  active?: boolean;
};

const USGS_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson";
const EONET_URL = "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=30&limit=250";
// A second, independent multi-hazard source keeps the map populated when EONET is slow or unavailable.
const GDACS_URL = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC%3BFL%3BVO%3BDR%3BWF";

const validNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const validDate = (value: unknown) => {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};
const severityForMagnitude = (magnitude: number): Severity => magnitude >= 7 ? "critical" : magnitude >= 6 ? "elevated" : magnitude >= 5 ? "watch" : "stable";
const naturalLayer = (category: string): NaturalLayer => /wildfire|forest fire|\bfire\b|^wf$/i.test(category) ? "Wildfires" : /storm|cyclone|hurricane|typhoon|^tc$/i.test(category) ? "Storms" : /volcano|eruption|^vo$/i.test(category) ? "Volcanoes" : /flood|^fl$/i.test(category) ? "Floods" : /earthquake|seismic|^eq$/i.test(category) ? "Earthquakes" : "Other natural";
const naturalSeverity = (layer: NaturalLayer, title: string): Severity => /red alert|cat(?:egory)?\s*[45]|major|severe|extreme|emergency/i.test(title) ? "elevated" : layer === "Storms" || layer === "Wildfires" ? "watch" : "stable";

function pointFromCoordinates(value: unknown): { lat: number; lng: number } | null {
  if (!Array.isArray(value)) return null;
  if (validNumber(value[0]) && validNumber(value[1])) {
    return Math.abs(value[1]) <= 90 && Math.abs(value[0]) <= 180 ? { lng: value[0], lat: value[1] } : null;
  }
  const points = value.map(pointFromCoordinates).filter((point): point is { lat: number; lng: number } => point !== null);
  if (!points.length) return null;
  return {
    lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
    lng: points.reduce((sum, point) => sum + point.lng, 0) / points.length,
  };
}

async function fetchJson(url: string) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(url, {
      headers: { Accept: "application/geo+json, application/json", "User-Agent": "ATLAS-Intelligence-Map/2.0" },
      signal: AbortSignal.timeout(9000),
      cf: { cacheTtl: 300, cacheEverything: true },
    } as RequestInit & { cf: { cacheTtl: number; cacheEverything: boolean } });
    if (response.ok) return response.json() as Promise<unknown>;
    if (attempt === 0 && [429, 502, 503, 504].includes(response.status)) continue;
    throw new Error(`${response.status}`);
  }
  throw new Error("source unavailable");
}

export function parseUsgs(payload: unknown): IntelEvent[] {
  const features = payload && typeof payload === "object" && (payload as { features?: unknown }).features;
  if (!Array.isArray(features)) return [];
  return features.flatMap((feature, index) => {
    if (!feature || typeof feature !== "object") return [];
    const record = feature as { id?: unknown; properties?: Record<string, unknown>; geometry?: { coordinates?: unknown } };
    const point = pointFromCoordinates(record.geometry?.coordinates);
    if (!point) return [];
    const properties = record.properties ?? {};
    const magnitude = validNumber(properties.mag) ? properties.mag : 0;
    const occurredAt = validNumber(properties.time) ? new Date(properties.time).toISOString() : new Date().toISOString();
    const title = typeof properties.title === "string" ? properties.title : `Magnitude ${magnitude.toFixed(1)} earthquake`;
    const sourceUrl = typeof properties.url === "string" ? properties.url : "https://earthquake.usgs.gov/";
    return [{ id: `usgs-${String(record.id ?? index)}`, layer: "Earthquakes" as const, title, summary: `USGS recorded a magnitude ${magnitude.toFixed(1)} event. Depth and local impact details are available at the original source.`, ...point, occurredAt, severity: severityForMagnitude(magnitude), source: "USGS Earthquake Hazards Program", sourceUrl, magnitude, active: false }];
  });
}

export function parseEonet(payload: unknown): IntelEvent[] {
  const events = payload && typeof payload === "object" && (payload as { events?: unknown }).events;
  if (!Array.isArray(events)) return [];
  return events.flatMap((event, index) => {
    if (!event || typeof event !== "object") return [];
    const record = event as { id?: unknown; title?: unknown; description?: unknown; closed?: unknown; categories?: Array<{ id?: unknown; title?: unknown }>; geometry?: Array<{ date?: unknown; coordinates?: unknown }>; sources?: Array<{ url?: unknown }> };
    const geometries = Array.isArray(record.geometry) ? [...record.geometry].reverse() : [];
    const locatedGeometry = geometries.find((geometry) => pointFromCoordinates(geometry.coordinates));
    const point = pointFromCoordinates(locatedGeometry?.coordinates);
    if (!locatedGeometry || !point) return [];
    const category = record.categories?.map((item) => typeof item.title === "string" ? item.title : typeof item.id === "string" ? item.id : "").find(Boolean) ?? "Natural event";
    const layer = naturalLayer(category);
    const title = typeof record.title === "string" ? record.title : category;
    const sourceUrl = record.sources?.map((source) => source.url).find((url): url is string => typeof url === "string" && url.startsWith("http")) ?? "https://eonet.gsfc.nasa.gov/";
    const description = typeof record.description === "string" && record.description.trim() ? record.description.trim() : `${category} tracked through NASA's Earth Observatory Natural Event Tracker.`;
    return [{ id: `eonet-${String(record.id ?? index)}`, layer, title, summary: description, ...point, occurredAt: validDate(locatedGeometry.date) ?? new Date().toISOString(), severity: naturalSeverity(layer, title), source: "NASA EONET", sourceUrl, active: record.closed == null }];
  });
}

export function parseGdacs(payload: unknown): IntelEvent[] {
  const features = payload && typeof payload === "object" && (payload as { features?: unknown }).features;
  if (!Array.isArray(features)) return [];
  return features.flatMap((feature, index) => {
    if (!feature || typeof feature !== "object") return [];
    const record = feature as { geometry?: { coordinates?: unknown }; properties?: Record<string, unknown> };
    const properties = record.properties ?? {};
    const point = pointFromCoordinates(record.geometry?.coordinates) ?? (validNumber(properties.longitude) && validNumber(properties.latitude) ? { lng: properties.longitude, lat: properties.latitude } : null);
    if (!point) return [];
    const eventType = typeof properties.eventtype === "string" ? properties.eventtype : typeof properties.eventType === "string" ? properties.eventType : "";
    const layer = naturalLayer(eventType || String(properties.eventtypename ?? properties.eventTypeName ?? "Natural event"));
    if (layer === "Earthquakes") return [];
    const title = typeof properties.name === "string" && properties.name.trim() ? properties.name.trim() : `${layer} alert`;
    const alertLevel = String(properties.alertlevel ?? properties.alertLevel ?? "").toLowerCase();
    const severity: Severity = alertLevel === "red" ? "critical" : alertLevel === "orange" ? "elevated" : naturalSeverity(layer, title);
    const eventId = String(properties.eventid ?? properties.eventId ?? index);
    const episodeId = String(properties.episodeid ?? properties.episodeId ?? "latest");
    const sourceUrl = typeof properties.url === "object" && properties.url !== null && typeof (properties.url as { report?: unknown }).report === "string"
      ? (properties.url as { report: string }).report
      : `https://www.gdacs.org/report.aspx?eventid=${encodeURIComponent(eventId)}&episodeid=${encodeURIComponent(episodeId)}&eventtype=${encodeURIComponent(eventType)}`;
    const summarySource = properties.description ?? properties.htmldescription ?? properties.eventname ?? properties.eventName;
    const summary = typeof summarySource === "string" && summarySource.trim() ? summarySource.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : `${layer} event monitored by the Global Disaster Alert and Coordination System.`;
    return [{ id: `gdacs-${eventType}-${eventId}-${episodeId}`, layer, title, summary, ...point, occurredAt: validDate(properties.fromdate ?? properties.fromDate ?? properties.datemodified ?? properties.dateModified) ?? new Date().toISOString(), severity, source: "GDACS (UN / European Commission)", sourceUrl, active: properties.iscurrent !== false && properties.isCurrent !== false }];
  });
}

function dedupeEvents(events: IntelEvent[]) {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = `${event.layer}:${event.title.toLowerCase().replace(/\W+/g, " ").trim()}:${event.lat.toFixed(1)}:${event.lng.toFixed(1)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function GET() {
  const fetchedAt = new Date().toISOString();
  const [usgs, eonet, gdacs] = await Promise.allSettled([fetchJson(USGS_URL), fetchJson(EONET_URL), fetchJson(GDACS_URL)]);
  const events = dedupeEvents([
    ...(usgs.status === "fulfilled" ? parseUsgs(usgs.value) : []),
    ...(eonet.status === "fulfilled" ? parseEonet(eonet.value) : []),
    ...(gdacs.status === "fulfilled" ? parseGdacs(gdacs.value) : []),
  ]);
  const sources = [
    { id: "usgs", label: "USGS Earthquake Hazards Program", url: USGS_URL, status: usgs.status === "fulfilled" ? "live" : "unavailable" },
    { id: "eonet", label: "NASA EONET", url: EONET_URL, status: eonet.status === "fulfilled" ? "live" : "unavailable" },
    { id: "gdacs", label: "GDACS (UN / European Commission)", url: GDACS_URL, status: gdacs.status === "fulfilled" ? "live" : "unavailable" },
  ];
  const liveSources = sources.filter((source) => source.status === "live").length;
  return Response.json({ fetchedAt, status: liveSources === sources.length ? "live" : liveSources ? "partial" : "unavailable", events, sources }, { headers: { "Cache-Control": "public, max-age=120, s-maxage=300, stale-while-revalidate=900" } });
}
