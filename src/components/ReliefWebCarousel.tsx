import { useEffect, useMemo, useRef, useState } from 'react'
import { Newspaper, ExternalLink, ChevronLeft, ChevronRight, Pause, Play, Info } from 'lucide-react'
import type { ReliefWebItem } from '../services/reliefweb'

// --- Local helpers (duplicated small bits so this file is standalone)
const CATEGORY = 'Humanitarian'
const domainFromUrl = (u: string) => { try { return new URL(u).hostname.replace(/^www\./,'').toLowerCase() } catch { return '' } }
const TRUSTED_DOMAINS = new Set([
  'reliefweb.int','unocha.org','wfp.org','who.int','unicef.org','icrc.org','ifrc.org','acaps.org','imf.org','worldbank.org'
])
const TLD_STRONG = new Set(['gov','edu','int'])
const TLD_OK = new Set(['org','com'])
function reputationFor(domain: string): number {
  let s = 0
  if (!domain) return s
  if (TRUSTED_DOMAINS.has(domain)) s += 100
  const tld = domain.split('.').pop() || ''
  if (TLD_STRONG.has(tld)) s += 20
  else if (TLD_OK.has(tld)) s += 5
  if (domain.length > 25) s -= 2
  if ((domain.match(/-/g)||[]).length > 2) s -= 2
  if (/\d/.test(domain)) s -= 2
  if (/blogspot|pressrelease|prnews|newsbreak|wordpress|substack/i.test(domain)) s -= 40
  return s
}
const URGENCY_RX = /(appeal|cholera|famine|displacement|flood|earthquake|drought|outbreak|cease\s*fire|evacuation|aid|assessment|flash\s*update)/i
function headlineSignal(h: string): number {
  if (!h) return 0
  let s = 0
  if (URGENCY_RX.test(h)) s += 8
  const len = h.length
  if (len >= 40 && len <= 140) s += 2
  return s
}
function freshnessBoost(created?: number): number {
  if (!created) return 0
  const hours = (Date.now() - created) / 36e5
  if (hours <= 24) return 10 - (hours / 24) * 2
  if (hours <= 72) return 2 - ((hours - 24) / 48) * 2
  return 0
}
function relevanceScore(item: HeadlineItem): number {
  const dom = (item.source || domainFromUrl(item.url)).toLowerCase()
  const rep = reputationFor(dom) * 0.15
  const cat = 10 // fixed small boost for humanitarian
  const txt = headlineSignal(item.headline)
  const fresh = freshnessBoost(item.created)
  const geo = (typeof item.lat === 'number' && typeof item.lon === 'number') ? 2 : 0
  return rep + cat + txt + fresh + geo
}
function sortByRelevance<T extends HeadlineItem>(arr: T[]): T[] { return [...arr].sort((a,b) => relevanceScore(b) - relevanceScore(a)) }

// ---------- Types
export type HeadlineItem = {
  id: string
  headline: string
  url: string
  source?: string
  category?: string
  lat?: number
  lon?: number
  countryName?: string
  created?: number
}

// ---------- Component
export default function ReliefWebCarousel({
  reports,
  onOpenContext,
  max = 60,
  storageKey = 'carousel:relief:last',
}: {
  reports: ReliefWebItem[] | null
  onOpenContext?: (country: string) => void
  max?: number
  storageKey?: string
}) {
  const [paused, setPaused] = useState(false)
  const [index, setIndex] = useState(0)

  const items = useMemo<HeadlineItem[]>(() => {
    if (!reports?.length) return []
    const mapped = reports.map(r => ({
      id: String(r.id),
      headline: r.fields.title,
      url: r.fields.url,
      source: (() => { try { return new URL(r.fields.url).hostname.replace(/^www\./,'') } catch { return 'source' } })(),
      category: CATEGORY,
      countryName: r.fields.country?.[0]?.name,
      created: new Date(r.fields.date.created).getTime(),
    }))
    return sortByRelevance(mapped).slice(0, max)
  }, [reports, max])

  // cache items (for instant warm on reload)
  useEffect(() => {
    try { if (items.length) localStorage.setItem(storageKey, JSON.stringify(items)) } catch {}
  }, [items, storageKey])

  // warm from cache on very first mount when no reports yet
  const [hydrated, setHydrated] = useState(false)
  const [cachedItems, setCachedItems] = useState<HeadlineItem[]>([])
  useEffect(() => {
    if (hydrated || (reports && reports.length)) return
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) setCachedItems(JSON.parse(raw))
    } catch {}
    setHydrated(true)
  }, [hydrated, reports, storageKey])

  const finalItems = items.length ? items : cachedItems
  const total = finalItems.length

  // Refs to avoid stale closures in interval
  const indexRef = useRef(index)
  const totalRef = useRef(total)
  useEffect(() => { indexRef.current = index }, [index])
  useEffect(() => { totalRef.current = total }, [total])

  // keep in range
  useEffect(() => { if (total && index >= total) setIndex(0) }, [total, index])

  // auto-advance
  useEffect(() => {
    if (paused || total <= 1) return
    const id = window.setInterval(() => {
      const next = (indexRef.current + 1) % totalRef.current
      setIndex(next)
    }, 6000)
    return () => window.clearInterval(id)
  }, [paused, total])

  if (!total) return null
  const it = finalItems[index]

  console.log('[RWC] reports:', reports?.length, 'items:', finalItems.length, 'index:', index) // <-- add this

  return (
    <section
      className="relative overflow-hidden rounded-xl border shadow-sm"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Humanitarian headlines"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-slate-100" />
      <div className="relative grid h-[32svh] min-h-[260px] md:h-[38svh] place-items-center px-3 sm:px-5 md:px-8">
        <div className="max-w-4xl">
          <div className="mb-2 inline-flex items-center gap-2">
            <span className="rounded-full bg-rose-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">Humanitarian</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200">ReliefWeb</span>
            {typeof it.lat === 'number' && typeof it.lon === 'number' && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 ring-1 ring-slate-200">
                {it.lat.toFixed(2)}, {it.lon.toFixed(2)}
              </span>
            )}
          </div>

          <a href={it.url} target="_blank" rel="noreferrer" className="block" title={it.headline}>
            <h3 className="font-extrabold leading-tight tracking-tight text-xl sm:text-2xl md:text-3xl whitespace-normal break-words">
              {it.headline}
            </h3>
          </a>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-slate-600">
            <span className="inline-flex items-center gap-1">
              <Newspaper className="h-3.5 w-3.5 opacity-70" />
              {it.source || (() => { try { return new URL(it.url).hostname.replace(/^www\./,'') } catch { return 'source' } })()}
            </span>
            <span className="opacity-50">•</span>
            <a href={it.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-500">
              Read <ExternalLink className="h-3.5 w-3.5 opacity-70" />
            </a>
            {it.countryName && onOpenContext && (
              <>
                <span className="opacity-50">•</span>
                <button
                  type="button"
                  onClick={() => onOpenContext(it.countryName!)}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] ring-1 ring-slate-200 hover:bg-slate-200"
                  title="Open geopolitical context"
                >
                  <Info className="h-3.5 w-3.5" /> Context: {it.countryName}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between p-2 sm:p-3">
        <button
          type="button"
          aria-label="Previous headline"
          onClick={() => setIndex((index - 1 + total) % total)}
          className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow ring-1 ring-black/10 hover:bg-white"
        >
          <ChevronLeft className="h-4.5 w-4.5" />
        </button>
        <div className="pointer-events-auto inline-flex items-center gap-2">
          <button
            type="button"
            aria-label={paused ? 'Play' : 'Pause'}
            onClick={() => setPaused(p => !p)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow ring-1 ring-black/10 hover:bg-white"
          >
            {paused ? <Play className="h-4.5 w-4.5" /> : <Pause className="h-4.5 w-4.5" />}
          </button>
        </div>
        <button
          type="button"
          aria-label="Next headline"
          onClick={() => setIndex((index + 1) % total)}
          className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow ring-1 ring-black/10 hover:bg-white"
        >
          <ChevronRight className="h-4.5 w-4.5" />
        </button>
      </div>

      <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center">
        <span className="rounded-full bg-white/90 px-2 py-0.5 text-[11px] ring-1 ring-slate-200 shadow-sm">
          {index + 1} / {total}
        </span>
      </div>
    </section>
  )
}
