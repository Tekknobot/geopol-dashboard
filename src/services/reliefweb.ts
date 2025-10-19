
export type ReliefWebItem = {
  id: string
  fields: { title: string, url: string, date: { created: string }, country?: { name: string }[] }
}

export async function getLatestReports(limit = 12): Promise<ReliefWebItem[]> {
  const url = 'https://api.reliefweb.int/v1/reports?appname=geopol-dashboard&profile=full&sort[]=date:desc&filter[conditions][0][field]=status&filter[conditions][0][value]=published&limit=' + limit
  const res = await fetch(url)
  if (!res.ok) throw new Error('ReliefWeb error')
  const data = await res.json()
  return data?.data || []
}
