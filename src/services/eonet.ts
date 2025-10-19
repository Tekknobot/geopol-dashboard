
export type EonetEvent = {
  id: string
  title: string
  link: string
  geometry: { coordinates: [number, number] }[]
  categories: { id: number, title: string }[]
}

export async function getOpenEvents(): Promise<EonetEvent[]> {
  const url = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open'
  const res = await fetch(url)
  if (!res.ok) throw new Error('EONET error')
  const data = await res.json()
  return data?.events || []
}
