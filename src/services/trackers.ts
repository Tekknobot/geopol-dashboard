import { searchCountryByName } from './restCountries'
import { wbGetCountryIndicator, toSeries } from './worldBank'

export type StructuralSnapshot = {
  sampleSize: number
  avgPoliticalStability: number | null
  avgCorruptionControl: number | null
  avgGovernmentEffectiveness: number | null
  avgInflation: number | null
  avgGdpGrowth: number | null
}

const countryIsoCache = new Map<string, string | null>()
const latestIndicatorCache = new Map<string, number | null>()

async function countryToIso3(name: string): Promise<string | null> {
  const key = String(name || '').trim().toLowerCase()
  if (!key) return null
  if (countryIsoCache.has(key)) return countryIsoCache.get(key) ?? null
  try {
    const matches = await searchCountryByName(name)
    const iso3 = matches?.[0]?.cca3 || null
    countryIsoCache.set(key, iso3)
    return iso3
  } catch {
    countryIsoCache.set(key, null)
    return null
  }
}

export async function latestCountryIndicatorValue(iso3: string, indicator: string, points = 25): Promise<number | null> {
  const key = `${iso3}:${indicator}:${points}`
  if (latestIndicatorCache.has(key)) return latestIndicatorCache.get(key) ?? null
  try {
    const series = toSeries(await wbGetCountryIndicator(iso3, indicator, points))
    for (let i = series.length - 1; i >= 0; i--) {
      const value = series[i]?.value
      if (typeof value === 'number' && Number.isFinite(value)) {
        latestIndicatorCache.set(key, value)
        return value
      }
    }
  } catch {}
  latestIndicatorCache.set(key, null)
  return null
}

function avg(values: Array<number | null | undefined>): number | null {
  const clean = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  if (!clean.length) return null
  return clean.reduce((a, b) => a + b, 0) / clean.length
}

export async function buildStructuralSnapshot(countryNames: string[], maxCountries = 8): Promise<StructuralSnapshot> {
  const unique = Array.from(new Set(countryNames.map(x => String(x || '').trim()).filter(Boolean))).slice(0, maxCountries)
  const iso3List = (await Promise.all(unique.map(countryToIso3))).filter((v): v is string => !!v)

  if (!iso3List.length) {
    return {
      sampleSize: 0,
      avgPoliticalStability: null,
      avgCorruptionControl: null,
      avgGovernmentEffectiveness: null,
      avgInflation: null,
      avgGdpGrowth: null,
    }
  }

  const rows = await Promise.all(
    iso3List.map(async iso3 => ({
      pv: await latestCountryIndicatorValue(iso3, 'PV.EST'),
      cc: await latestCountryIndicatorValue(iso3, 'CC.EST'),
      ge: await latestCountryIndicatorValue(iso3, 'GE.EST'),
      cpi: await latestCountryIndicatorValue(iso3, 'FP.CPI.TOTL.ZG'),
      gdp: await latestCountryIndicatorValue(iso3, 'NY.GDP.MKTP.KD.ZG'),
    }))
  )

  return {
    sampleSize: iso3List.length,
    avgPoliticalStability: avg(rows.map(r => r.pv)),
    avgCorruptionControl: avg(rows.map(r => r.cc)),
    avgGovernmentEffectiveness: avg(rows.map(r => r.ge)),
    avgInflation: avg(rows.map(r => r.cpi)),
    avgGdpGrowth: avg(rows.map(r => r.gdp)),
  }
}
