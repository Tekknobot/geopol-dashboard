import { fetchJson } from './http'

export type WorldNewsItem = {
  id: string
  title: string
  url: string
  source: string
  publishedAt?: string
  description?: string
  tags?: string[]
}

const WORLD_NEWS_BASE = '/api/world-news'

export function worldNewsCreatedMs(item: WorldNewsItem): number {
  const t = Date.parse(item?.publishedAt || '')
  return Number.isFinite(t) ? t : 0
}

export function worldNewsCategory(item: Pick<WorldNewsItem, 'title' | 'description' | 'tags'>): string {
  const hay = `${item.title || ''} | ${item.description || ''} | ${(item.tags || []).join(' | ')}`.toLowerCase()
  if (/(war|missile|drone|attack|troops|military|rebels|ceasefire|hostage|airstrike|shelling|conflict|security)/i.test(hay)) return 'Conflict/Security'
  if (/(election|vote|parliament|president|prime minister|cabinet|coalition|senate|congress|court|constitution|protest)/i.test(hay)) return 'Politics'
  if (/(tariff|trade|economy|economic|inflation|recession|gdp|markets?|stocks?|bonds?|bank|interest rates?|currency|budget)/i.test(hay)) return 'Economy/Markets'
  if (/(oil|gas|energy|pipeline|opec|power grid|electricity|refinery|nuclear)/i.test(hay)) return 'Energy'
  if (/(climate|flood|storm|cyclone|wildfire|earthquake|drought|weather|heatwave|eruption|disaster)/i.test(hay)) return 'Climate/Disaster'
  if (/(cyber|hack|hacker|ransomware|malware|surveillance|tech|technology|ai |artificial intelligence|chip|chips|semiconductor)/i.test(hay)) return 'Technology/Cyber'
  if (/(health|virus|disease|outbreak|hospital|who |vaccin)/i.test(hay)) return 'Health'
  if (/(migration|migrant|refugee|asylum|rights|human rights|detention|deport)/i.test(hay)) return 'Migration/Human Rights'
  if (/(summit|talks|diplomacy|diplomatic|treaty|alliance|nato|united nations|u\.n\.|sanctions)/i.test(hay)) return 'Diplomacy'
  return 'World News'
}

export async function getLatestWorldNews(cacheMs = 1000 * 60 * 5): Promise<WorldNewsItem[]> {
  const data = await fetchJson<{ items?: WorldNewsItem[] }>(WORLD_NEWS_BASE, {
    maxAgeMs: cacheMs,
    cacheKey: 'world-news:latest',
    retries: 2,
    timeoutMs: 15000,
  })
  return Array.isArray(data?.items) ? data.items : []
}
