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
    .map((p) => ({ date: p.date, value: typeof p.value === 'number' ? p.value : null }))
    .filter((p) => p.date != null)
    .sort((a, b) => (a.date > b.date ? 1 : -1));
}

export function hasNumericPoints(points: WbPoint[] = []) {
  return points.some((p) => typeof p.value === 'number' && Number.isFinite(p.value))
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

async function fetchSeriesWithFallback(
  loader: (perPage: number, cacheMs: number) => Promise<WbRawPoint[]>,
  perPages: number[] = [30, 80, 160],
  cacheMs = 1000 * 60 * 60
): Promise<WbPoint[]> {
  let richest: WbPoint[] = []
  for (const perPage of perPages) {
    const series = toSeries(await loader(perPage, cacheMs))
    if (series.length > richest.length) richest = series
    if (hasNumericPoints(series)) return series
  }
  return richest
}

export async function wbGetCountryIndicatorSeries(
  iso3: string,
  indicator: string,
  perPages: number[] = [30, 80, 160],
  cacheMs = 1000 * 60 * 60
) {
  return fetchSeriesWithFallback((perPage, maxAge) => wbGetCountryIndicator(iso3, indicator, perPage, maxAge), perPages, cacheMs)
}

export async function wbGetGlobalIndicatorSeries(
  indicator: string,
  perPages: number[] = [30, 80, 160],
  cacheMs = 1000 * 60 * 60
) {
  return fetchSeriesWithFallback((perPage, maxAge) => wbGetGlobalIndicator(indicator, perPage, maxAge), perPages, cacheMs)
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
