
export type Country = {
  name: { common: string, official: string },
  cca2: string,
  cca3: string,
  region: string,
  subregion?: string,
  capital?: string[],
  population: number,
  area: number,
  flags?: { png?: string, svg?: string },
  latlng?: [number, number],
  currencies?: Record<string, { name: string, symbol: string }>,
  languages?: Record<string, string>
}

export async function searchCountryByName(q: string): Promise<Country[]> {
  const url = `https://restcountries.com/v3.1/name/${encodeURIComponent(q)}?fields=name,cca2,cca3,region,subregion,capital,population,area,flags,latlng,currencies,languages`
  const res = await fetch(url)
  if (!res.ok) throw new Error('REST Countries error')
  return await res.json()
}
