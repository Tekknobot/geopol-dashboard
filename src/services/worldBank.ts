// src/services/worldBank.ts
// World Bank API helpers with caching + retries via fetchJson.

import { fetchJson } from "./http";

export type WbRawPoint = {
  indicator?: { id: string; value: string };
  country?: { id: string; value: string };
  countryiso3code?: string;
  date: string; // "2022"
  value: number | null;
};

export type WbPoint = { date: string; value: number | null };

function toArray(json: unknown): WbRawPoint[] {
  // WB returns [meta, data[]]; guard for empty pages
  if (!Array.isArray(json) || !Array.isArray(json[1])) return [];
  return json[1] as WbRawPoint[];
}

export function toSeries(points: WbRawPoint[]): WbPoint[] {
  return (points || [])
    .map((p) => ({ date: p.date, value: p.value ?? null }))
    .filter((p) => p.date != null)
    .sort((a, b) => (a.date > b.date ? 1 : -1));
}

const WB_BASE = "https://api.worldbank.org/v2";

/** Country series for a single indicator (e.g., GE.EST, NY.GDP.MKTP.KD.ZG) */
export async function wbGetCountryIndicator(
  iso3: string,
  indicator: string,
  perPage = 60,
  cacheMs = 1000 * 60 * 60 // 1h
) {
  const url = `${WB_BASE}/country/${encodeURIComponent(
    iso3
  )}/indicator/${encodeURIComponent(
    indicator
  )}?format=json&per_page=${perPage}`;
  const data = await fetchJson<[any, WbRawPoint[]]>(url, {
    maxAgeMs: cacheMs,
    cacheKey: `wb:${iso3}:${indicator}:${perPage}`,
    retries: 2,
    timeoutMs: 12000,
  });
  return toArray(data);
}

/** Global (WLD) series for a single indicator */
export async function wbGetGlobalIndicator(
  indicator: string,
  perPage = 60,
  cacheMs = 1000 * 60 * 60
) {
  const url = `${WB_BASE}/country/WLD/indicator/${encodeURIComponent(
    indicator
  )}?format=json&per_page=${perPage}`;
  const data = await fetchJson<[any, WbRawPoint[]]>(url, {
    maxAgeMs: cacheMs,
    cacheKey: `wb:WLD:${indicator}:${perPage}`,
    retries: 2,
    timeoutMs: 12000,
  });
  return toArray(data);
}

/**
 * Helper: fetch both country and world for an indicator in parallel,
 * return normalized, sorted series for each.
 */
export async function wbCountryVsWorld(
  iso3: string,
  indicator: string,
  perPage = 60,
  cacheMs = 1000 * 60 * 60
) {
  const [countryPts, worldPts] = await Promise.allSettled([
    wbGetCountryIndicator(iso3, indicator, perPage, cacheMs),
    wbGetGlobalIndicator(indicator, perPage, cacheMs),
  ]);
  return {
    country: countryPts.status === "fulfilled" ? toSeries(countryPts.value) : [],
    world: worldPts.status === "fulfilled" ? toSeries(worldPts.value) : [],
  };
}

/**
 * Convenience: get the latest non-null value in a series (for comparators)
 */
export function latestNonNull(points: WbPoint[]): { date: string; value: number } | null {
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i];
    if (p.value != null) return { date: p.date, value: p.value };
  }
  return null;
}
