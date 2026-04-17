import { searchCountryByName } from '../services/restCountries'
import { getLatestReports, reliefWebCategory, reliefWebCountry, reliefWebSource, type ReliefWebItem } from '../services/reliefweb'
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

async function countryCentroid(country: string): Promise<[number, number] | null> {
  if (centroidCache.has(country)) return centroidCache.get(country) || null
  try {
    const results = await searchCountryByName(country)
    const best = results.find(c => Array.isArray(c.latlng) && c.latlng.length >= 2)
    if (best?.latlng) {
      const value: [number, number] = [best.latlng[0], best.latlng[1]]
      centroidCache.set(country, value)
      return value
    }
  } catch {}
  return null
}

function createdMs(item: ReliefWebItem) {
  const t = Date.parse(item?.fields?.date?.created || '')
  return Number.isFinite(t) ? t : undefined
}

export async function fetchPins24h(): Promise<PinRow[]> {
  const reports = await getLatestReports(500)
  const countries = Array.from(new Set(reports.map(reliefWebCountry).filter((v): v is string => !!v))).sort()

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
