
export async function wbGetCountryIndicator(iso3: string, indicator: string, perPage = 20) {
  const url = `https://api.worldbank.org/v2/country/${iso3}/indicator/${indicator}?format=json&per_page=${perPage}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('World Bank error')
  const data = await res.json()
  return data[1] || []
}

export async function wbGetGlobalIndicator(indicator: string, perPage = 20) {
  const url = `https://api.worldbank.org/v2/country/WLD/indicator/${indicator}?format=json&per_page=${perPage}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('World Bank error')
  const data = await res.json()
  return data[1] || []
}

export type WbPoint = { date: string, value: number | null }

export function toSeries(points: any[]): WbPoint[] {
  return (points || [])
    .map(p => ({ date: p.date, value: p.value }))
    .filter(Boolean)
    .sort((a,b) => (a.date > b.date ? 1 : -1))
}
