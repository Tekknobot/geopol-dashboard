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
  borders?: string[];
  currencies?: Record<string, { name: string; symbol: string }>;
  languages?: Record<string, string>;
};

const RC = "https://restcountries.com/v3.1";

const COUNTRY_ALIASES: Record<string, string> = {
  'syrian arab republic': 'syria',
  'russian federation': 'russia',
  'iran (islamic republic of)': 'iran',
  'iran, islamic republic of': 'iran',
  'venezuela (bolivarian republic of)': 'venezuela',
  'venezuela, bolivarian republic of': 'venezuela',
  'bolivia (plurinational state of)': 'bolivia',
  'bolivia, plurinational state of': 'bolivia',
  'democratic republic of the congo': 'congo (democratic republic of the)',
  'congo, democratic republic of the': 'congo (democratic republic of the)',
  'republic of the congo': 'congo',
  'congo, republic of the': 'congo',
  'cote d\'ivoire': "côte d'ivoire",
  'lao people\'s democratic republic': 'laos',
  'democratic people\'s republic of korea': 'korea (democratic people\'s republic of)',
  'republic of korea': 'korea',
  'occupied palestinian territory': 'palestine',
  'occupied palestinian territory, including east jerusalem': 'palestine',
  'state of palestine': 'palestine',
  'micronesia (federated states of)': 'micronesia',
  'united republic of tanzania': 'tanzania',
  'moldova, republic of': 'moldova',
  'moldova (republic of)': 'moldova',
  'viet nam': 'vietnam',
  'eswatini (kingdom of)': 'eswatini',
  'the bahamas': 'bahamas',
  'bahamas, the': 'bahamas',
  'the gambia': 'gambia',
  'gambia, the': 'gambia',
  'taiwan, province of china': 'taiwan',
  'kosovo (under security council resolution 1244 (1999))': 'kosovo',
}

const MANUAL_COUNTRY_COORDS: Record<string, [number, number]> = {
  'palestine': [31.95, 35.23],
  'occupied palestinian territory': [31.95, 35.23],
  'occupied palestinian territory, including east jerusalem': [31.95, 35.23],
  'kosovo': [42.67, 21.17],
}

function normalizeCountryQuery(q: string): string {
  const key = String(q || '').trim().toLowerCase()
  return COUNTRY_ALIASES[key] || key
}

async function fetchByName(q: string, cacheMs: number) {
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
    "borders",
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

function withManualCoords(country: Country, query: string): Country {
  if (Array.isArray(country.latlng) && country.latlng.length >= 2) return country
  const manual = MANUAL_COUNTRY_COORDS[normalizeCountryQuery(query)]
  return manual ? { ...country, latlng: manual } : country
}

/**
 * Search countries by common/official name.
 * Includes alias fallback for UN/ReliefWeb-style country names that REST Countries often misses.
 */
export async function searchCountryByName(q: string, cacheMs = 1000 * 60 * 60) {
  const raw = String(q || '').trim()
  if (!raw) return []

  try {
    const direct = await fetchByName(raw, cacheMs)
    if (direct.length) return direct.map(country => withManualCoords(country, raw))
  } catch {}

  const normalized = normalizeCountryQuery(raw)
  if (normalized !== raw.toLowerCase()) {
    try {
      const alias = await fetchByName(normalized, cacheMs)
      if (alias.length) return alias.map(country => withManualCoords(country, raw))
    } catch {}
  }

  const manual = MANUAL_COUNTRY_COORDS[normalized]
  if (manual) {
    return [{
      name: { common: raw, official: raw },
      cca2: '',
      cca3: raw.slice(0, 3).toUpperCase(),
      region: '',
      population: 0,
      area: 0,
      latlng: manual,
    }]
  }

  return []
}
