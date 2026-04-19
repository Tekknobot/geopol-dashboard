import { searchCountryByName } from '../services/restCountries'
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

const centroidCache = new Map<string, [number, number]>()

const COUNTRY_ALIASES: Record<string, string[]> = {
  'Viet Nam': ['Vietnam'],
  'Syrian Arab Republic': ['Syria'],
  'Iran (Islamic Republic of)': ['Iran'],
  'Lao People\'s Democratic Republic': ['Laos', 'Lao PDR'],
  'Bolivia (Plurinational State of)': ['Bolivia'],
  'Venezuela (Bolivarian Republic of)': ['Venezuela'],
  'Republic of Moldova': ['Moldova'],
  'Democratic People\'s Republic of Korea': ['North Korea'],
  'Republic of Korea': ['South Korea', 'Korea'],
  'Türkiye': ['Turkey'],
  'Côte d’Ivoire': ["Cote d'Ivoire", 'Ivory Coast'],
  'Occupied Palestinian Territory': ['Palestine', 'State of Palestine'],
  'Palestinian Territories': ['Palestine', 'State of Palestine'],
  'Russian Federation': ['Russia'],
  'United Republic of Tanzania': ['Tanzania'],
}

const MANUAL_CENTROIDS: Record<string, [number, number]> = {
  'Occupied Palestinian Territory': [31.95, 35.2],
  'Palestinian Territories': [31.95, 35.2],
  'State of Palestine': [31.95, 35.2],
  'Kosovo': [42.67, 21.17],
}

function countryQueries(country: string): string[] {
  const trimmed = country.trim()
  const aliases = COUNTRY_ALIASES[trimmed] || []
  return [trimmed, ...aliases]
}

async function countryCentroid(country: string): Promise<[number, number] | null> {
  if (centroidCache.has(country)) return centroidCache.get(country) || null

  const manual = MANUAL_CENTROIDS[country]
  if (manual) {
    centroidCache.set(country, manual)
    return manual
  }

  for (const query of countryQueries(country)) {
    try {
      const results = await searchCountryByName(query)
      const best = results.find(c => Array.isArray(c.latlng) && c.latlng.length >= 2)
      if (best?.latlng) {
        const value: [number, number] = [best.latlng[0], best.latlng[1]]
        centroidCache.set(country, value)
        return value
      }
    } catch {}
  }

  return null
}

function createdMs(item: ReliefWebItem) {
  const t = Date.parse(item?.fields?.date?.created || '')
  return Number.isFinite(t) ? t : undefined
}

export async function fetchPins24h(): Promise<PinRow[]> {
  const reports = await getLatestReports(1000)
  const countries = Array.from(
    new Set(reports.map(reliefWebCountry).filter((v): v is string => !!v)),
  ).sort()

  await Promise.all(countries.map(countryCentroid))

  const rows: PinRow[] = []
  const seen = new Set<string>()

  for (const report of reports) {
    const country = reliefWebCountry(report)
    if (!country) continue

    const coords = centroidCache.get(country)
    if (!coords) continue

    const url = normalizeExternalUrl(report.fields.url)
    if (url === '#') continue

    const key = `${country}:${url}`
    if (seen.has(key)) continue
    seen.add(key)

    rows.push({
      id: String(report.id),
      headline: report.fields.title,
      url,
      source: reliefWebSource(url),
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