import { fetchJson } from '../services/http'
import {
  getLatestReports,
  reliefWebCategory,
  reliefWebCountry,
  reliefWebSource,
  type ReliefWebItem,
} from '../services/reliefweb'
import { normalizeExternalUrl } from './links'

export type PinRow = {
  id: string
  headline: string
  url: string
  source?: string
  category: string
  lat: number
  lon: number
  label: string
  countryGuess: string
  created?: number
}

type RestCountryLite = {
  name?: { common?: string; official?: string }
  cca3?: string
  latlng?: [number, number]
}

const centroidCache = new Map<string, [number, number]>()
let allCountryLookupPromise: Promise<Map<string, [number, number]>> | null = null

const COUNTRY_ALIASES: Record<string, string[]> = {
  'Viet Nam': ['Vietnam'],
  'Syrian Arab Republic': ['Syria'],
  'Iran (Islamic Republic of)': ['Iran'],
  "Lao People's Democratic Republic": ['Laos', 'Lao PDR'],
  'Bolivia (Plurinational State of)': ['Bolivia'],
  'Venezuela (Bolivarian Republic of)': ['Venezuela'],
  'Republic of Moldova': ['Moldova'],
  "Democratic People's Republic of Korea": ['North Korea'],
  'Republic of Korea': ['South Korea', 'Korea'],
  'Türkiye': ['Turkey'],
  'Côte d’Ivoire': ["Cote d'Ivoire", 'Ivory Coast'],
  'Occupied Palestinian Territory': ['Palestine', 'State of Palestine'],
  'Palestinian Territories': ['Palestine', 'State of Palestine'],
  'Russian Federation': ['Russia'],
  'United Republic of Tanzania': ['Tanzania'],
  'Democratic Republic of the Congo': ['DR Congo', 'Congo, Democratic Republic of the'],
  'Congo, Democratic Republic of the': ['DR Congo', 'Democratic Republic of the Congo'],
  'Republic of the Congo': ['Congo'],
  'Congo, Republic of the': ['Congo'],
}

const MANUAL_CENTROIDS: Record<string, [number, number]> = {
  'Occupied Palestinian Territory': [31.95, 35.2],
  'Palestinian Territories': [31.95, 35.2],
  'State of Palestine': [31.95, 35.2],
  'Kosovo': [42.67, 21.17],
}

function normalizeName(value: string): string {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
}

function createdMs(item: ReliefWebItem) {
  const t = Date.parse(item?.fields?.date?.created || '')
  return Number.isFinite(t) ? t : undefined
}

async function loadAllCountryLookup(): Promise<Map<string, [number, number]>> {
  if (allCountryLookupPromise) return allCountryLookupPromise

  allCountryLookupPromise = (async () => {
    const url = 'https://restcountries.com/v3.1/all?fields=name,cca3,latlng'
    const data = await fetchJson<RestCountryLite[]>(url, {
      cacheKey: 'rc:all-lite',
      maxAgeMs: 1000 * 60 * 60 * 24,
      retries: 2,
      timeoutMs: 15000,
    })

    const lookup = new Map<string, [number, number]>()

    const put = (name?: string, coords?: [number, number]) => {
      if (!name || !coords || coords.length < 2) return
      const key = normalizeName(name)
      if (!key) return
      if (!lookup.has(key)) lookup.set(key, coords)
    }

    for (const country of Array.isArray(data) ? data : []) {
      const coords = Array.isArray(country.latlng) && country.latlng.length >= 2
        ? [country.latlng[0], country.latlng[1]] as [number, number]
        : null
      if (!coords) continue
      put(country.name?.common, coords)
      put(country.name?.official, coords)
      put(country.cca3, coords)
    }

    for (const [name, coords] of Object.entries(MANUAL_CENTROIDS)) {
      put(name, coords)
    }

    for (const [name, aliases] of Object.entries(COUNTRY_ALIASES)) {
      const existing = lookup.get(normalizeName(name)) || MANUAL_CENTROIDS[name]
      if (!existing) continue
      put(name, existing)
      for (const alias of aliases) put(alias, existing)
    }

    return lookup
  })()

  return allCountryLookupPromise
}

async function countryCentroid(country: string): Promise<[number, number] | null> {
  if (centroidCache.has(country)) return centroidCache.get(country) || null

  const manual = MANUAL_CENTROIDS[country]
  if (manual) {
    centroidCache.set(country, manual)
    return manual
  }

  const lookup = await loadAllCountryLookup()
  const queries = [country, ...(COUNTRY_ALIASES[country] || [])]

  for (const query of queries) {
    const coords = lookup.get(normalizeName(query))
    if (coords) {
      centroidCache.set(country, coords)
      return coords
    }
  }

  return null
}

export async function fetchPins24h(): Promise<PinRow[]> {
  const reports = await getLatestReports(1000)
  const countries = Array.from(new Set(reports.map(reliefWebCountry).filter((v): v is string => !!v))).sort()

  await Promise.all(countries.map(countryCentroid))

  const rows: PinRow[] = []
  const seen = new Set<string>()

  for (const report of reports) {
    const country = reliefWebCountry(report)
    if (!country) continue

    const url = normalizeExternalUrl(report.fields.url)
    if (url === '#') continue

    const key = `${country}:${url}`
    if (seen.has(key)) continue
    seen.add(key)

    const coords = centroidCache.get(country) || MANUAL_CENTROIDS[country]
    if (!coords) continue

    rows.push({
      id: String(report.id),
      headline: report.fields.title,
      url,
      source: reliefWebSource(report.fields.url),
      category: reliefWebCategory(report),
      lat: coords[0],
      lon: coords[1],
      label: country,
      countryGuess: country,
      created: createdMs(report),
    })
  }

  rows.sort((a, b) => {
    const ta = a.created || 0
    const tb = b.created || 0
    return tb - ta || a.countryGuess.localeCompare(b.countryGuess) || a.headline.localeCompare(b.headline)
  })

  return rows
}
