export const runtime = "edge";

type GeoFeature = { geometry?: { coordinates?: unknown }; properties?: Record<string, unknown> };
type GeoPayload = { features?: GeoFeature[]; numberMatched?: number; numberReturned?: number };

type Metric = {
  id: string;
  label: string;
  value: string;
  raw?: number;
  unit?: string;
  detail: string;
  source: string;
  sourceUrl: string;
  observedAt?: string;
  status: "live" | "reference" | "unavailable";
};

const safeNumber = (value: unknown) => {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};
const safeText = (value: unknown) => typeof value === "string" ? value : "";

async function jsonFetch(url: string, timeout = 7500) {
  const response = await fetch(url, {
    headers: { Accept: "application/json, application/geo+json", "User-Agent": "Atlas-Canada-Simulator/2.0" },
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw new Error(`${response.status}`);
  return response.json() as Promise<any>;
}

function latestValet(payload: any, code: string) {
  const rows = Array.isArray(payload?.observations) ? payload.observations : [];
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const value = safeNumber(rows[i]?.[code]?.v);
    if (value !== null) return { value, date: safeText(rows[i]?.d) };
  }
  return null;
}

function maxAqhi(features: GeoFeature[]) {
  let maximum: { value: number; location: string; date: string } | null = null;
  for (const feature of features) {
    const p = feature.properties ?? {};
    const candidates = [p.aqhi, p.AQHI, p.aqhi_value, p.AQHI_VALUE, p.value];
    const value = candidates.map(safeNumber).find((v) => v !== null) ?? null;
    if (value === null) continue;
    const location = safeText(p.location_name_en) || safeText(p.LOCATION_NAME_EN) || safeText(p.zone_name_en) || safeText(p.name_en) || safeText(p.location_id) || "Canadian station";
    const date = safeText(p.observation_datetime) || safeText(p.OBSERVATION_DATETIME) || safeText(p.date_stamp) || safeText(p.valid_datetime);
    if (!maximum || value > maximum.value) maximum = { value, location, date };
  }
  return maximum;
}

export async function GET() {
  const fetchedAt = new Date().toISOString();
  const metrics: Metric[] = [];

  const [bank, alerts, aqhi, hydro] = await Promise.allSettled([
    jsonFetch("https://www.bankofcanada.ca/valet/observations/V39079,FXUSDCAD,STATIC_TOTALCPICHANGE,BD.CDN.10YR.DQ.YLD/json?recent=15"),
    jsonFetch("https://api.weather.gc.ca/collections/weather-alerts/items?f=json&limit=250"),
    jsonFetch("https://api.weather.gc.ca/collections/aqhi-observations-realtime/items?f=json&limit=500"),
    jsonFetch("https://api.weather.gc.ca/collections/hydrometric-realtime/items?f=json&limit=500"),
  ]);

  if (bank.status === "fulfilled") {
    const rate = latestValet(bank.value, "V39079");
    const fx = latestValet(bank.value, "FXUSDCAD");
    const cpi = latestValet(bank.value, "STATIC_TOTALCPICHANGE");
    const bond = latestValet(bank.value, "BD.CDN.10YR.DQ.YLD");
    if (rate) metrics.push({ id:"policy-rate", label:"Policy rate", value:`${rate.value.toFixed(2)}%`, raw:rate.value, unit:"%", detail:"Target for the overnight rate", source:"Bank of Canada Valet", sourceUrl:"https://www.bankofcanada.ca/valet/", observedAt:rate.date, status:"live" });
    if (fx) metrics.push({ id:"usd-cad", label:"USD / CAD", value:fx.value.toFixed(4), raw:fx.value, detail:"Daily Bank of Canada exchange rate", source:"Bank of Canada Valet", sourceUrl:"https://www.bankofcanada.ca/rates/exchange/", observedAt:fx.date, status:"live" });
    if (cpi) metrics.push({ id:"inflation", label:"CPI inflation", value:`${cpi.value.toFixed(1)}%`, raw:cpi.value, unit:"% y/y", detail:"Total CPI, year-over-year change", source:"Bank of Canada Valet", sourceUrl:"https://www.bankofcanada.ca/rates/indicators/key-variables/inflation-control-target/", observedAt:cpi.date, status:"live" });
    if (bond) metrics.push({ id:"bond-10y", label:"Canada 10Y", value:`${bond.value.toFixed(2)}%`, raw:bond.value, unit:"%", detail:"Government of Canada benchmark yield", source:"Bank of Canada Valet", sourceUrl:"https://www.bankofcanada.ca/rates/interest-rates/canadian-bonds/", observedAt:bond.date, status:"live" });
  }

  if (alerts.status === "fulfilled") {
    const payload = alerts.value as GeoPayload;
    const features = Array.isArray(payload.features) ? payload.features : [];
    const provinces = new Set(features.map((f) => safeText(f.properties?.province)).filter(Boolean));
    metrics.push({ id:"weather-alerts", label:"Weather alerts", value:String(payload.numberMatched ?? features.length), raw:payload.numberMatched ?? features.length, detail:`Active/returned ECCC alerts across ${provinces.size || "multiple"} provinces/territories`, source:"ECCC MSC GeoMet", sourceUrl:"https://api.weather.gc.ca/collections/weather-alerts", status:"live" });
  }

  if (aqhi.status === "fulfilled") {
    const payload = aqhi.value as GeoPayload;
    const features = Array.isArray(payload.features) ? payload.features : [];
    const peak = maxAqhi(features);
    metrics.push({ id:"aqhi-reporting", label:"AQHI observations", value:String(payload.numberMatched ?? features.length), raw:payload.numberMatched ?? features.length, detail:"Real-time air-quality observations returned by GeoMet", source:"ECCC MSC GeoMet", sourceUrl:"https://api.weather.gc.ca/collections/aqhi-observations-realtime", status:"live" });
    if (peak) metrics.push({ id:"aqhi-peak", label:"Peak AQHI", value:peak.value >= 10 ? "10+" : String(Math.round(peak.value)), raw:peak.value, detail:`Highest value in returned sample · ${peak.location}`, source:"ECCC MSC GeoMet", sourceUrl:"https://api.weather.gc.ca/collections/aqhi-observations-realtime", observedAt:peak.date, status:"live" });
  }

  if (hydro.status === "fulfilled") {
    const payload = hydro.value as GeoPayload;
    const features = Array.isArray(payload.features) ? payload.features : [];
    const stations = new Set(features.map((f) => safeText(f.properties?.STATION_NUMBER)).filter(Boolean));
    const provinces = new Set(features.map((f) => safeText(f.properties?.PROV_TERR_STATE_LOC)).filter(Boolean));
    metrics.push({ id:"hydro", label:"Water observations", value:String(stations.size || features.length), raw:stations.size || features.length, detail:`Real-time hydrometric stations in returned sample · ${provinces.size} jurisdictions`, source:"Water Survey of Canada / ECCC GeoMet", sourceUrl:"https://api.weather.gc.ca/collections/hydrometric-realtime", status:"live" });
  }

  const feeds = [bank, alerts, aqhi, hydro];
  return Response.json({
    fetchedAt,
    metrics,
    sourceStatus: {
      bankOfCanada: bank.status === "fulfilled",
      weatherAlerts: alerts.status === "fulfilled",
      airQuality: aqhi.status === "fulfilled",
      hydrometric: hydro.status === "fulfilled",
    },
    availableFeeds: feeds.filter((r) => r.status === "fulfilled").length,
    totalFeeds: feeds.length,
  }, { headers: { "Cache-Control":"public, max-age=180, s-maxage=600, stale-while-revalidate=1800" } });
}
