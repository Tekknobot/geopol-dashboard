// src/services/restCountries.ts
// REST Countries v3.1

import { fetchJson } from "./http";

export type Country = {
  name: { common: string; official: string };
  cca2: string;
  cca3: string;
  region: string;
  subregion?: string;
  capital?: string[];
  population: number;
  area: number;
  flags?: { png?: string; svg?: string };
  latlng?: [number, number];
  currencies?: Record<string, { name: string; symbol: string }>;
  languages?: Record<string, string>;
};

const RC = "https://restcountries.com/v3.1";

/**
 * Search countries by common/official name.
 * We explicitly request just the fields we need to keep payload small.
 */
export async function searchCountryByName(q: string, cacheMs = 1000 * 60 * 60) {
  const fields = [
    "name",
    "cca2",
    "cca3",
    "region",
    "subregion",
    "capital",
    "population",
    "area",
    "flags",
    "latlng",
    "currencies",
    "languages",
  ];
  const url = `${RC}/name/${encodeURIComponent(q)}?fields=${fields.join(",")}`;
  const data = await fetchJson<Country[]>(url, {
    maxAgeMs: cacheMs,
    cacheKey: `rc:name:${q.toLowerCase()}`,
    retries: 2,
    timeoutMs: 12000,
  });
  return Array.isArray(data) ? data : [];
}
