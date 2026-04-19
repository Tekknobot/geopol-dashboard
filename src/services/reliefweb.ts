import { setCache } from './cache'

export type ReliefWebItem = {
  id: number | string
  fields: {
    title: string
    url: string
    date: { created: string }
    country?: { name: string }[]
    theme?: { name: string }[]
    disaster_type?: { name: string }[]
    format?: { name: string }[]
    source?: { name: string }[]
  }
}

const RW_BASE = (import.meta as any)?.env?.VITE_RELIEFWEB_PROXY_URL || '/api/reliefweb'
const DEFAULT_LIMIT = 500
const MAX_RW_PAGE = 1000

function appName() {
  return (
    (import.meta as any)?.env?.VITE_RELIEFWEB_APPNAME ||
    'ShannaGeopolDashboardResearchX9K4RYHLJzF'
  )
}

export function reliefWebSource(url?: string | null) {
  const raw = String(url || '').trim()
  if (!raw) return 'reliefweb.int'
  try {
    return new URL(raw).hostname.replace(/^www\./, '') || 'reliefweb.int'
  } catch {
    return 'reliefweb.int'
  }
}

export function reliefWebCreatedMs(item: ReliefWebItem): number {
  const t = Date.parse(item?.fields?.date?.created || '')
  return Number.isFinite(t) ? t : 0
}

export function reliefWebCountry(item: ReliefWebItem): string | null {
  return item?.fields?.country?.[0]?.name?.trim() || null
}

export function reliefWebCategory(item: ReliefWebItem): string {
  const themes = (item.fields.theme || []).map(x => x?.name || '').join(' | ')
  const disasters = (item.fields.disaster_type || []).map(x => x?.name || '').join(' | ')
  const title = item.fields.title || ''
  const hay = `${themes} | ${disasters} | ${title}`.toLowerCase()

  if (/(flood|flooding)/i.test(hay)) return 'Flood'
  if (/(earthquake|seismic)/i.test(hay)) return 'Earthquake'
  if (/(cyclone|storm|hurricane|typhoon)/i.test(hay)) return 'Storm/Cyclone'
  if (/(drought|heatwave|dry spell)/i.test(hay)) return 'Drought'
  if (/(cholera|measles|outbreak|health|epidemic|pandemic|disease)/i.test(hay)) return 'Health/Outbreak'
  if (/(food security|nutrition|famine|ipc|hunger)/i.test(hay)) return 'Food Security'
  if (/(conflict|violence|security|attack|armed|hostilities|protection)/i.test(hay)) return 'Conflict/Insecurity'
  if (/(displacement|refugee|migration|idp|returnee)/i.test(hay)) return 'Displacement'
  if (/(corruption|bribery|governance|oversight|accountability|anti-corruption)/i.test(hay)) return 'Governance/Corruption'
  return 'Other'
}

export function reliefWebMatchesAny(item: ReliefWebItem, terms: string[]): boolean {
  const hay = [
    item.fields.title,
    ...(item.fields.theme || []).map(t => t?.name || ''),
    ...(item.fields.disaster_type || []).map(t => t?.name || ''),
    ...(item.fields.country || []).map(c => c?.name || ''),
    ...(item.fields.format || []).map(f => f?.name || ''),
  ]
    .join(' | ')
    .toLowerCase()

  return terms.some(term => hay.includes(term.toLowerCase()))
}

async function postReports(body: any): Promise<ReliefWebItem[]> {
  const url = `${RW_BASE}?${new URLSearchParams({
    appname: appName(),
  }).toString()}`

  const timeoutMs = 12000
  const retries = 2
  let lastErr: any

  for (let i = 0; i <= retries; i++) {
    const controller = new AbortController()
    const to = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        console.error('RELIEFWEB HTTP ERROR', res.status, text)
        throw new Error(`HTTP ${res.status}${text ? `: ${text.slice(0, 500)}` : ''}`)
      }

      const raw = await res.json()
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      return Array.isArray(parsed?.data) ? (parsed.data as ReliefWebItem[]) : []
    } catch (e: any) {
      lastErr = e
      if (e?.name === 'AbortError') break
      if (String(e?.message || '').startsWith('HTTP 4')) break
      await new Promise(r => setTimeout(r, 500 * Math.pow(2, i) * (0.7 + Math.random() * 0.6)))
    } finally {
      clearTimeout(to)
    }
  }

  throw lastErr ?? new Error('ReliefWeb request failed')
}

export async function getLatestReports(limit = DEFAULT_LIMIT, cacheMs = 1000 * 60 * 10) {
  const key = `rw:reports:${limit}`
  const cutoff = Date.now() - 24 * 60 * 60 * 1000
  const pageSize = Math.min(MAX_RW_PAGE, Math.max(limit, 250))

  const collected: ReliefWebItem[] = []
  let offset = 0
  let emptyFreshPages = 0

  while (offset <= 4000 && collected.length < limit && emptyFreshPages < 2) {
  const body = {
    limit: pageSize,
    offset,
    preset: 'latest',
    profile: 'minimal',
    sort: ['date:desc'],
    fields: {
      include: [
        'title',
        'url',
        'date.created',
        'country.name',
        'theme.name',
        'disaster_type.name',
        'format.name',
        'source.name',
      ],
    },
  }

    const data = await postReports(body)
    if (!data.length) break

    const fresh = data.filter((item) => reliefWebCreatedMs(item) >= cutoff)

    if (!fresh.length) emptyFreshPages += 1
    else emptyFreshPages = 0

    collected.push(...fresh)

    if (data.length < pageSize) break
    offset += pageSize
  }

  const seen = new Set<string>()
  const deduped = collected.filter((item) => {
    const key = `${item.id}:${item.fields?.url || ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  deduped.sort((a, b) => reliefWebCreatedMs(b) - reliefWebCreatedMs(a))

  const finalRows = deduped.slice(0, limit)
  setCache<ReliefWebItem[]>(key, finalRows)
  return finalRows
}

export async function getRecentReports(days = 7, limit = DEFAULT_LIMIT) {
  const data = await getLatestReports(Math.max(limit, 500))
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return data.filter(item => reliefWebCreatedMs(item) >= cutoff)
}

export function buildHourlyBuckets(
  reports: ReliefWebItem[],
  hours = 24,
  predicate?: (item: ReliefWebItem) => boolean,
) {
  const start = Date.now() - (hours - 1) * 60 * 60 * 1000
  const buckets = new Map<string, number>()

  for (let i = 0; i < hours; i++) {
    const d = new Date(start + i * 60 * 60 * 1000)
    const key = `${d.toISOString().slice(5, 13)}:00`
    buckets.set(key, 0)
  }

  for (const item of reports) {
    if (predicate && !predicate(item)) continue
    const created = reliefWebCreatedMs(item)
    if (!created || created < start) continue
    const d = new Date(created)
    const key = `${d.toISOString().slice(5, 13)}:00`
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + 1)
  }

  return Array.from(buckets.entries()).map(([date, count]) => ({ date, count }))
}

export function buildDailyBuckets(
  reports: ReliefWebItem[],
  days = 14,
  predicate?: (item: ReliefWebItem) => boolean,
) {
  const start = new Date()
  start.setUTCHours(0, 0, 0, 0)
  start.setUTCDate(start.getUTCDate() - (days - 1))
  const startMs = start.getTime()
  const buckets = new Map<string, number>()

  for (let i = 0; i < days; i++) {
    const d = new Date(startMs + i * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10)
    buckets.set(key, 0)
  }

  for (const item of reports) {
    if (predicate && !predicate(item)) continue
    const created = reliefWebCreatedMs(item)
    if (!created || created < startMs) continue
    const key = new Date(created).toISOString().slice(0, 10)
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + 1)
  }

  return Array.from(buckets.entries()).map(([date, count]) => ({ date, count }))
}