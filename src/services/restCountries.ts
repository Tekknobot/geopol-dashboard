// src/services/restCountries.ts
// REST Countries v3.1

import { fetchJson } from "./http";
import { proxyUrl } from "./apiBases";

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

const RC_PATH = "/v3.1";

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


const FALLBACK_COUNTRIES: Country[] = [
  {
    name: { common: 'Canada', official: 'Canada' },
    cca2: 'CA', cca3: 'CAN', region: 'Americas', subregion: 'North America',
    capital: ['Ottawa'], population: 40000000, area: 9984670, latlng: [56.1304, -106.3468],
    borders: ['USA'], currencies: { CAD: { name: 'Canadian dollar', symbol: '$' } }, languages: { eng: 'English', fra: 'French' },
  },
  {
    name: { common: 'United States', official: 'United States of America' },
    cca2: 'US', cca3: 'USA', region: 'Americas', subregion: 'North America',
    capital: ['Washington, D.C.'], population: 335000000, area: 9372610, latlng: [37.0902, -95.7129],
    borders: ['CAN', 'MEX'], currencies: { USD: { name: 'United States dollar', symbol: '$' } }, languages: { eng: 'English' },
  },
  {
    name: { common: 'United Kingdom', official: 'United Kingdom of Great Britain and Northern Ireland' },
    cca2: 'GB', cca3: 'GBR', region: 'Europe', subregion: 'Northern Europe',
    capital: ['London'], population: 68000000, area: 242900, latlng: [55.3781, -3.4360],
    currencies: { GBP: { name: 'British pound', symbol: '£' } }, languages: { eng: 'English' },
  },
  {
    name: { common: 'Ukraine', official: 'Ukraine' },
    cca2: 'UA', cca3: 'UKR', region: 'Europe', subregion: 'Eastern Europe',
    capital: ['Kyiv'], population: 37000000, area: 603500, latlng: [48.3794, 31.1656],
    borders: ['BLR', 'HUN', 'MDA', 'POL', 'ROU', 'RUS', 'SVK'], currencies: { UAH: { name: 'Ukrainian hryvnia', symbol: '₴' } }, languages: { ukr: 'Ukrainian' },
  },
  {
    name: { common: 'India', official: 'Republic of India' },
    cca2: 'IN', cca3: 'IND', region: 'Asia', subregion: 'Southern Asia',
    capital: ['New Delhi'], population: 1420000000, area: 3287590, latlng: [20.5937, 78.9629],
    borders: ['BGD', 'BTN', 'MMR', 'CHN', 'NPL', 'PAK'], currencies: { INR: { name: 'Indian rupee', symbol: '₹' } }, languages: { hin: 'Hindi', eng: 'English' },
  },
]

function fallbackCountrySearch(q: string): Country[] {
  const key = normalizeCountryQuery(q)
  return FALLBACK_COUNTRIES.filter(c => {
    const common = c.name.common.toLowerCase()
    const official = c.name.official.toLowerCase()
    return common.includes(key) || official.includes(key) || c.cca3.toLowerCase() === key || c.cca2.toLowerCase() === key
  })
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
  const url = proxyUrl("restcountries", `${RC_PATH}/name/${encodeURIComponent(q)}`, { fields: fields.join(",") });
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

  const fallback = fallbackCountrySearch(raw)
  if (fallback.length) return fallback

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
