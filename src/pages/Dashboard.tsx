import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Card from '../components/Card'
import Loading from '../components/Loading'
import ErrorState from '../components/ErrorState'
import { getLatestReports, ReliefWebItem } from '../services/reliefweb'
import { getOpenEvents, EonetEvent } from '../services/eonet'
import { wbGetGlobalIndicator, toSeries, WbPoint, wbGetCountryIndicator, wbGetGlobalIndicator as wbGlobal } from '../services/worldBank'
import { searchCountryByName, type Country } from '../services/restCountries'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, LabelList } from 'recharts'
import LazyEventMap from '../components/LazyEventMap'
import { getCache, setCache } from '../services/cache'
import { Newspaper, ExternalLink, Tag as TagIcon, ChevronLeft, ChevronRight, Pause, Play, Info } from 'lucide-react'
import type { MapNewsItem } from '../components/MapCore'
import { eventsToMapNews } from '../utils/mapNews'
import ReliefWebCarousel from '../components/ReliefWebCarousel'

// --------- Tiny helpers for collapsible sections (with localStorage memory)
function usePersistedToggle(key: string, defaultOpen = false) {
  const [open, setOpen] = useState<boolean>(defaultOpen)
  useEffect(() => {
    try {
      const v = localStorage.getItem(key)
      if (v !== null) setOpen(v === '1')
    } catch {}
  }, [key])
  useEffect(() => {
    try {
      localStorage.setItem(key, open ? '1' : '0')
    } catch {}
  }, [key, open])
  return [open, setOpen] as const
}

function CollapsibleSection({
  title,
  storageKey,
  defaultOpen = false,
  rightHint,
  children,
}: {
  title: string
  storageKey: string
  defaultOpen?: boolean
  rightHint?: React.ReactNode
  children: React.ReactNode
}) {
  const [open, setOpen] = usePersistedToggle(storageKey, defaultOpen)
  return (
    <details
      className="group rounded-xl border bg-white shadow-sm"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="flex cursor-pointer select-none items-center justify-between gap-3 rounded-xl px-4 py-2">
        <span className="font-semibold">{title}</span>
        <span className="ml-auto text-xs text-slate-500">{rightHint}</span>
        <span className="i-chevron transition-transform group-open:rotate-180 text-slate-500">
          <span className="inline-block rotate-90 select-none">⌃</span>
        </span>
      </summary>
      <div className="px-4 pb-4 pt-2">{children}</div>
    </details>
  )
}

function MiniSection({
  title,
  storageKey,
  defaultOpen = false,
  children,
}: {
  title: string
  storageKey: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = usePersistedToggle(storageKey, defaultOpen)
  return (
    <details
      className="rounded-lg border"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer select-none px-3 py-2 text-[13px] font-semibold">
        {title}
      </summary>
      <div className="px-3 pb-3 pt-1 text-[13px] text-slate-700">{children}</div>
    </details>
  )
}

// Polyfill requestIdleCallback for Safari
const ric = (cb: () => void) => {
  const fn = (window as any).requestIdleCallback as any
  if (typeof fn === 'function') return fn(cb)
  return setTimeout(cb, 1)
}

// ---------- Carousel (newspaper style, very large)
type HeadlineItem = {
  id: string
  headline: string
  url: string
  source?: string
  category?: string
  lat?: number
  lon?: number
  countryName?: string
  created?: number // when known (ReliefWeb often provides)
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// --- Relevance scoring for the CAROUSEL (reputation + category + headline + freshness + geo) ---

const CATEGORY_WEIGHTS: Record<string, number> = {
  'Security/Conflict': 18,
  'Sanctions': 16,
  'Macro/Finance': 15,
  'Supply Chain': 15,
  'Elections/Politics': 12,
  'Energy': 12,
  'Cyber': 12,
  'Migration': 10,
  'Trade/Export Controls': 12,
  'Diplomacy/Alliances': 9,
  'Governance/Corruption': 9,
  'Update': 6,     // ReliefWeb generic bucket
  'Other': 4,
}

const URGENCY_RX = /(coup|cease\s*fire|sanction|strike|port\s*closure|blockade|tariff|default|devalu|inflation|attack|air\s*strike|missile|ransomware|data breach|pipeline|refinery|export control)/i

function headlineSignal(h: string): number {
  if (!h) return 0
  let s = 0
  if (URGENCY_RX.test(h)) s += 10
  // penalize shouty clickbait
  if (/[A-Z]{6,}/.test(h)) s -= 2
  // slightly reward concise, informative titles
  const len = h.length
  if (len >= 40 && len <= 140) s += 2
  return s
}

function freshnessBoost(created?: number): number {
  if (!created) return 0
  const hours = (Date.now() - created) / 36e5
  // 0–24h: up to +12, 24–72h: linearly down to +2, 72h+: 0
  if (hours <= 24) return 12 - (hours / 24) * 2 // ~10–12 in first day
  if (hours <= 72) return 2 - ((hours - 24) / 48) * 2 // down to 0
  return 0
}

function geoSignal(lat?: number, lon?: number): number {
  // If we have coordinates, nudge up (geolocated headlines are usually stronger)
  return (typeof lat === 'number' && typeof lon === 'number') ? 2 : 0
}

// you already have reputationFor(domain)
function relevanceScore(item: HeadlineItem): number {
  const dom = (item.source || domainFromUrl(item.url)).toLowerCase()
  const rep = reputationFor(dom) * 0.15; // normalize (your rep numbers are big)
  const cat = CATEGORY_WEIGHTS[item.category || 'Update'] ?? 6
  const txt = headlineSignal(item.headline)
  const fresh = freshnessBoost(item.created)
  const geo = geoSignal(item.lat, item.lon)
  return rep + cat + txt + fresh + geo
}

function sortByRelevance<T extends HeadlineItem>(arr: T[]): T[] {
  return [...arr].sort((a, b) => relevanceScore(b) - relevanceScore(a))
}

// ---------- Reputation ranking (prefer reputable sources)
const TRUSTED_DOMAINS = new Set([
  'reuters.com','apnews.com','bbc.com','theguardian.com','nytimes.com','washingtonpost.com',
  'ft.com','bloomberg.com','aljazeera.com','axios.com','npr.org','cnn.com','cnbc.com',
  'france24.com','dw.com','scmp.com','straitstimes.com','abc.net.au'
])
const TLD_STRONG = new Set(['gov','edu','int'])
const TLD_OK = new Set(['org','com'])

function domainFromUrl(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./,'').toLowerCase() } catch { return '' }
}
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
function scoreItem(n: { url: string; source?: string }): number {
  const d = (n.source || domainFromUrl(n.url) || '').toLowerCase()
  return reputationFor(d)
}
function sortByReputation<T extends { url: string; source?: string }>(arr: T[]): T[] {
  return [...arr].sort((a,b) => scoreItem(b) - scoreItem(a))
}

function NewsCarousel({
  items,
  onOpenContext,
  index,
  onIndexChange,
}: {
  items: HeadlineItem[]
  onOpenContext: (country: string) => void
  index: number
  onIndexChange: (i: number) => void
}) {
  const [paused, setPaused] = useState(false)
  const total = items.length

  // Refs to avoid stale closures in the interval without changing prop types
  const indexRef = useRef(index)
  const totalRef = useRef(total)

  // Keep refs in sync with latest values
  useEffect(() => { indexRef.current = index }, [index])
  useEffect(() => { totalRef.current = total }, [total])

  // keep index in range if items change
  useEffect(() => {
    if (!total) return
    if (index >= total) onIndexChange(0)
  }, [total, index, onIndexChange])

  // auto-advance (interval reads latest index/total via refs)
  useEffect(() => {
    if (paused || total <= 1) return
    const id = window.setInterval(() => {
      const next = (indexRef.current + 1) % totalRef.current
      onIndexChange(next) // <- number, so TS is happy
    }, 6500)
    return () => clearInterval(id)
  }, [paused, total, onIndexChange])

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') onIndexChange((index + 1) % total)
      if (e.key === 'ArrowLeft')  onIndexChange((index - 1 + total) % total)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [total, index, onIndexChange])

  if (!total) return null
  const it = items[index]

  return (
    <section
      className="relative overflow-hidden rounded-2xl border shadow-md"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Top headlines"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-slate-100" />
      <div className="relative grid h-[55svh] min-h-[360px] md:h-[65svh] place-items-center px-4 sm:px-6 md:px-10">
        <div className="max-w-5xl">
          <div className="mb-3 inline-flex items-center gap-2">
            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">Front Page</span>
            {it.category && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                {it.category}
              </span>
            )}
            {typeof it.lat === 'number' && typeof it.lon === 'number' && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 ring-1 ring-slate-200">
                {it.lat.toFixed(2)}, {it.lon.toFixed(2)}
              </span>
            )}
          </div>

          <a href={it.url} target="_blank" rel="noreferrer" className="block" title={it.headline}>
            <h2 className="font-extrabold leading-tight tracking-tight text-3xl sm:text-5xl md:text-6xl xl:text-7xl whitespace-normal break-words">
              {it.headline}
            </h2>
          </a>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span className="inline-flex items-center gap-2">
              <Newspaper className="h-4 w-4 opacity-70" />
              {it.source || (() => { try { return new URL(it.url).hostname.replace(/^www\./,'') } catch { return 'source' } })()}
            </span>
            <span className="opacity-50">•</span>
            <a href={it.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-500">
              Read article <ExternalLink className="h-4 w-4 opacity-70" />
            </a>
            {it.countryName && (
              <>
                <span className="opacity-50">•</span>
                <button
                  type="button"
                  onClick={() => onOpenContext(it.countryName!)}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs ring-1 ring-slate-200 hover:bg-slate-200"
                  title="Open geopolitical context"
                >
                  <Info className="h-4 w-4" /> Open context: {it.countryName}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between p-2 sm:p-4">
        <button
          type="button"
          aria-label="Previous headline"
          onClick={() => onIndexChange((index - 1 + total) % total)}
          className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow ring-1 ring-black/10 hover:bg-white"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="pointer-events-auto inline-flex items-center gap-2">
          <button
            type="button"
            aria-label={paused ? 'Play' : 'Pause'}
            onClick={() => setPaused(p => !p)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow ring-1 ring-black/10 hover:bg-white"
          >
            {paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
          </button>
        </div>
        <button
          type="button"
          aria-label="Next headline"
          onClick={() => onIndexChange((index + 1) % total)}
          className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow ring-1 ring-black/10 hover:bg-white"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center">
        <span className="rounded-full bg-white/90 px-2 py-0.5 text-xs ring-1 ring-slate-200 shadow-sm">
          {index + 1} / {total}
        </span>
      </div>
    </section>
  )
}

// ---------- Lightweight geopolitics helpers

function EventContextChips({ countryName }: { countryName: string }) {
  const [textA, setTextA] = useState<string | null>(null)
  const [textB, setTextB] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [country] = await searchCountryByName(countryName)
        if (!country) return
        const iso3 = country.cca3

        const [ge, geW, inf, infW] = await Promise.all([
          wbGetCountryIndicator(iso3, 'GE.EST', 10).then(toSeries),
          wbGlobal('GE.EST', 10).then(toSeries),
          wbGetCountryIndicator(iso3, 'FP.CPI.TOTL.ZG', 10).then(toSeries),
          wbGlobal('FP.CPI.TOTL.ZG', 10).then(toSeries),
        ])
        if (!alive) return

        const trend = (s: { value: number | null }[]) => {
          const vals = s.map(x => x.value).filter((v): v is number => v !== null)
          if (vals.length < 2) return '—'
          const d = vals[vals.length - 1] - vals[vals.length - 2]
          return d > 0 ? '↑' : d < 0 ? '↓' : '→'
        }
        const last = (s: { value: number | null }[]) => {
          const vals = s.map(x => x.value).filter((v): v is number => v !== null)
          return vals.length ? vals[vals.length - 1] : null
        }

        setTextA(`Govt effectiveness ${trend(ge)} vs world ${trend(geW)}`)
        const lv = last(inf), lw = last(infW)
        setTextB(`Inflation ${lv !== null ? lv.toFixed(1) + '%' : '—'} vs world ${lw !== null ? lw.toFixed(1) + '%' : '—'}`)
      } catch {}
    })()
    return () => { alive = false }
  }, [countryName])

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {textA && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 ring-1 ring-slate-200">{textA}</span>}
      {textB && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 ring-1 ring-slate-200">{textB}</span>}
    </div>
  )
}

function SeriesChart({ country, world, label }: { country: WbPoint[]; world: WbPoint[]; label: string }) {
  const data = useMemo(() => {
    const map = new Map<string, any>()
    world.forEach(p => map.set(p.date, { date: p.date, world: p.value }))
    country.forEach(p => {
      const row = map.get(p.date) || { date: p.date }
      row.country = p.value
      map.set(p.date, row)
    })
    return Array.from(map.values()).sort((a,b) => a.date.localeCompare(b.date))
  }, [country, world])

  return (
    <div className="h-44">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={38} />
          <Tooltip />
          <Line type="monotone" dataKey="country" name="Country" dot={false} />
          <Line type="monotone" dataKey="world" name="World" strokeDasharray="4 2" dot={false} />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-1 text-xs text-slate-600">{label}</div>
    </div>
  )
}

function ContextSidebar({ countryName, onClose }: { countryName: string | null; onClose: () => void }) {
  const [country, setCountry] = useState<Country | null>(null)
  const [series, setSeries] = useState<Record<string, WbPoint[]>>({})
  const [world, setWorld] = useState<Record<string, WbPoint[]>>({})
  const [loading, setLoading] = useState(false)

  const INDICATORS = [
    { code: 'PV.EST', label: 'Political Stability (WGI)' },
    { code: 'GE.EST', label: 'Government Effectiveness (WGI)' },
    { code: 'NY.GDP.MKTP.KD.ZG', label: 'GDP Growth (annual %)' },
    { code: 'FP.CPI.TOTL.ZG', label: 'Inflation, CPI (annual %)' },
  ]

  useEffect(() => {
    if (!countryName) return
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        const [c] = await searchCountryByName(countryName)
        if (!c || !alive) return
        setCountry(c)
        const iso3 = c.cca3

        const countryData = Object.fromEntries(
          await Promise.all(INDICATORS.map(async x => [x.code, toSeries(await wbGetCountryIndicator(iso3, x.code, 30))]))
        )
        const worldData = Object.fromEntries(
          await Promise.all(INDICATORS.map(async x => [x.code, toSeries(await wbGlobal(x.code, 30))]))
        )
        if (!alive) return
        setSeries(countryData)
        setWorld(worldData)
      } catch {
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [countryName])

  if (!countryName) return null

  return (
    <aside className="fixed right-0 top-0 z-40 h-screen w-full max-w-md border-l bg-white shadow-xl">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-lg font-semibold">Context: {countryName}</h2>
        <button onClick={onClose} className="rounded bg-slate-100 px-2 py-1 text-sm hover:bg-slate-200">Close</button>
      </div>
      <div className="space-y-4 overflow-y-auto p-4">
        <Card title="Country facts">
          {!country ? <div className="text-sm text-slate-500">Loading…</div> :
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <li><span className="text-slate-500">Region:</span> {country.region}</li>
              <li><span className="text-slate-500">Capital:</span> {country.capital?.[0] ?? '—'}</li>
              <li><span className="text-slate-500">Population:</span> {country.population.toLocaleString()}</li>
              <li><span className="text-slate-500">Area:</span> {country.area.toLocaleString()} km²</li>
            </ul>
          }
        </Card>

        <Card title="Local vs Global">
          {loading ? <div className="text-sm text-slate-500">Fetching indicators…</div> :
            <div className="space-y-4">
              <SeriesChart label="Political Stability (WGI)" country={series['PV.EST'] ?? []} world={world['PV.EST'] ?? []} />
              <SeriesChart label="Government Effectiveness (WGI)" country={series['GE.EST'] ?? []} world={world['GE.EST'] ?? []} />
              <SeriesChart label="GDP Growth (annual %)" country={series['NY.GDP.MKTP.KD.ZG'] ?? []} world={world['NY.GDP.MKTP.KD.ZG'] ?? []} />
              <SeriesChart label="Inflation, CPI (annual %)" country={series['FP.CPI.TOTL.ZG'] ?? []} world={world['FP.CPI.TOTL.ZG'] ?? []} />
            </div>
          }
        </Card>
      </div>
    </aside>
  )
}

// ---------- Main Dashboard
export default function Dashboard() {
  const [reports, setReports] = useState<ReliefWebItem[] | null>(null)
  const [events, setEvents] = useState<EonetEvent[]>([]) // empty = render map immediately
  const [eventsLoading, setEventsLoading] = useState(true) // controls volatility tracker loading state
  const [gdpSeries, setGdpSeries] = useState<WbPoint[] | null>(null)
  const [cpiSeries, setCpiSeries] = useState<WbPoint[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [carouselIndex, setCarouselIndex] = useState(0)

  // 📡 News flowing from the map
  const [mapNews, setMapNews] = useState<MapNewsItem[]>([])

  // Merge incoming news batches without clobbering earlier (often better) headlines
  const handleNews = useCallback((incoming: MapNewsItem[]) => {
    if (!incoming?.length) return;
    setMapNews(prev => {
      const byKey = new Map<string, MapNewsItem>();
      const keyOf = (n: MapNewsItem) => n.url || n.id;

      // seed with existing items
      for (const n of prev) {
        const k = keyOf(n);
        if (k) byKey.set(k, n);
      }

      // merge incoming (keep existing headline/source if already present)
      for (const n of incoming) {
        const k = keyOf(n);
        if (!k) continue;
        const existing = byKey.get(k);
        if (existing) {
          byKey.set(k, {
            ...existing,
            ...n,
            headline: existing.headline || n.headline,
            source: existing.source || n.source,
          });
        } else {
          byKey.set(k, n);
        }
      }

      return Array.from(byKey.values());
    });
  }, []);

  // De-dupe & cap map headlines so count matches what's rendered
  const NEWS_VISIBLE = 40;            // how many you render in the list
  const NEWS_POOL_MAX = 300;          // safety cap for the pool

  const uniqueMapNews = useMemo(() => {
    const seen = new Set<string>();
    const out: MapNewsItem[] = [];
    for (const n of mapNews) {
      const k = n.url || n.id;        // prefer URL; fall back to id
      if (k && !seen.has(k)) {
        seen.add(k);
        out.push(n);
        if (out.length >= NEWS_POOL_MAX) break;
      }
    }
    return out;
  }, [mapNews]);

  // Cached "front page" carousel so we can show headlines immediately
  const CAROUSEL_CACHE_KEY = 'carousel:last'
  const CAROUSEL_MAX = 100; // show up to 100 items in the carousel
  const [carouselItems, setCarouselItems] = useState<HeadlineItem[]>(() => {
    try {
      const raw = localStorage.getItem(CAROUSEL_CACHE_KEY)
      return raw ? (JSON.parse(raw) as HeadlineItem[]) : []
    } catch {
      return []
    }
  })

  // NEW: selected country for the context sidebar
  const [contextCountry, setContextCountry] = useState<string | null>(null)

  // 🗺️ Country -> Region cache for ReliefWeb items  ⬇️ (keep ONE copy only)
  const [countryRegionMap, setCountryRegionMap] = useState<Record<string, string>>({})

  // Which event type row is expanded to show headlines
  const [openTypeKey, setOpenTypeKey] = useState<string | null>(null)

  // 6-hour cache
  const TTL = 6 * 60 * 60 * 1000

  useEffect(() => {
    (async () => {
      try {
        // Warm from cache immediately
        const cgdp = getCache<WbPoint[]>('wld:gdp', TTL)
        const ccpi = getCache<WbPoint[]>('wld:cpi', TTL)
        const crw  = getCache<ReliefWebItem[]>('rw:latest', TTL)
        const cev  = getCache<EonetEvent[]>('eonet:open', TTL)

        if (cgdp) setGdpSeries(cgdp)
        if (ccpi) setCpiSeries(ccpi)
        if (crw) {
          setReports(crw)
          if (carouselItems.length === 0) {
            const seed = crw.map(r => ({
              id: String(r.id),
              headline: r.fields.title,
              url: r.fields.url,
              source: (() => { try { return new URL(r.fields.url).hostname.replace(/^www\./,'') } catch { return 'source' } })(),
              category: 'Update',
              countryName: r.fields.country?.[0]?.name,
              created: new Date(r.fields.date.created).getTime(), // NEW
            }))
            setCarouselItems(sortByRelevance(seed).slice(0, CAROUSEL_MAX))
          }
        }
        // If we have cached EONET, surface those headlines immediately, too
        if (cev) {
          setEvents(cev)
          setEventsLoading(false)
          const cachedNews = eventsToMapNews(cev)
          if (cachedNews.length) {
            handleNews(cachedNews)
            const ranked = sortByRelevance(cachedNews).slice(0, CAROUSEL_MAX)
            setCarouselItems(ranked)
            try { localStorage.setItem('carousel:last', JSON.stringify(ranked)) } catch {}
          }
        }

        // ReliefWeb now (fast path)
        const rwPromise = (async () => {
          try {
            const rw = await getLatestReports(12)
            setReports(rw)
            setCache('rw:latest', rw)
            // If we still don't have map headlines, use RW for carousel
            if (mapNews.length === 0) {
              const itemsAll = rw.map(r => ({
                id: String(r.id),
                headline: r.fields.title,
                url: r.fields.url,
                source: (() => { try { return new URL(r.fields.url).hostname.replace(/^www\./,'') } catch { return 'source' } })(),
                category: 'Update',
                countryName: r.fields.country?.[0]?.name,
                created: new Date(r.fields.date.created).getTime(), // NEW
              }))
              const ranked = sortByRelevance(itemsAll).slice(0, CAROUSEL_MAX)
              setCarouselItems(ranked)
              try { localStorage.setItem('carousel:last', JSON.stringify(ranked)) } catch {}
            }
          } catch {}
        })()

        // KPIs in parallel (non-blocking)
        const kpiPromise = (async () => {
          try {
            const [gdp, cpi] = await Promise.all([
              wbGetGlobalIndicator('NY.GDP.MKTP.KD.ZG', 20),
              wbGetGlobalIndicator('FP.CPI.TOTL.ZG', 20),
            ])
            const gdpS = toSeries(gdp)
            const cpiS = toSeries(cpi)
            setGdpSeries(gdpS); setCache('wld:gdp', gdpS)
            setCpiSeries(cpiS); setCache('wld:cpi', cpiS)
          } catch (e:any) {
            setError(e?.message || 'Failed to load data')
          }
        })()

        // ⭐ EONET immediately (no idle), to get map-style headlines without the map
        const newsPromise = (async () => {
          try {
            const ev = await getOpenEvents()
            setEvents(ev); setCache('eonet:open', ev)
            setEventsLoading(false)
            const news = eventsToMapNews(ev)
            if (news.length) {
              handleNews(news)
              const ranked = sortByRelevance(news).slice(0, CAROUSEL_MAX)
              setCarouselItems(ranked)
              try { localStorage.setItem('carousel:last', JSON.stringify(ranked)) } catch {}
            }
          } catch {
            // even on failure, stop "loading…" so the card can show a friendly empty state
            setEventsLoading(false)
          }
        })()

        // Fire all; UI renders as things resolve
        void Promise.race([rwPromise, kpiPromise, newsPromise])
      } catch (e:any) {
        setError(e?.message || 'Failed to load data')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const lastGDP = useMemo(() => gdpSeries?.filter(p => p.value !== null).slice(-1)[0], [gdpSeries])
  const lastCPI = useMemo(() => cpiSeries?.filter(p => p.value !== null).slice(-1)[0], [cpiSeries])

  const hasMapNews = mapNews.length > 0

  useEffect(() => {
    if (!reports?.length) return
    let alive = true

    ;(async () => {
      const names = new Set<string>()
      for (const r of reports) {
        const c = r.fields.country?.[0]?.name
        if (c) names.add(c)
      }

      const missing = Array.from(names).filter(n => !(n in countryRegionMap))
      if (!missing.length) return

      const updates: Record<string, string> = {}
      for (const name of missing) {
        try {
          const [c] = await searchCountryByName(name)
          updates[name] = c?.region || 'Other'
        } catch {
          updates[name] = 'Other'
        }
        if (!alive) return
      }

      if (alive && Object.keys(updates).length) {
        setCountryRegionMap(prev => ({ ...prev, ...updates }))
      }
    })()

    return () => { alive = false }
  }, [reports, countryRegionMap])

  // When map-driven headlines arrive, promote them once and cache
  useEffect(() => {
    if (uniqueMapNews.length === 0) return;
      const itemsAll = uniqueMapNews.map(n => ({
        id: n.id,
        headline: n.headline,
        url: n.url,
        source: n.source,
        category: n.category,
        lat: n.lat,
        lon: n.lon,
      }));
      const ranked = sortByRelevance(itemsAll).slice(0, CAROUSEL_MAX);
      setCarouselItems(ranked);
      try { localStorage.setItem(CAROUSEL_CACHE_KEY, JSON.stringify(ranked)) } catch {}
  }, [uniqueMapNews]);

  // 👇 Countries that landed in "Other" (7d window)
  const otherCountries = useMemo(() => {
    if (!reports?.length) return []
    const now = Date.now()
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
    const set = new Set<string>()

    for (const r of reports) {
      const created = new Date(r.fields.date.created).getTime()
      if (!isFinite(created) || created < sevenDaysAgo) continue
      const name = r.fields.country?.[0]?.name
      if (!name) continue
      const region = countryRegionMap[name] || 'Other'
      if (region === 'Other') set.add(name)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [reports, countryRegionMap])

  // 👇 Type breakdown (7d) — best-effort from ReliefWeb fields
  const typeBreakdown = useMemo(() => {
    if (!reports?.length) return []
    const now = Date.now()
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
    const counts = new Map<string, number>()

    const getType = (r: ReliefWebItem) => {
      const f = (r as any)?.fields
      // Try common ReliefWeb categorical fields; fall back to "Update"
      return (
        f?.disaster_type?.[0]?.name ||
        f?.theme?.[0]?.name ||
        f?.primary_type?.name || // if present
        'Update'
      )
    }

    for (const r of reports) {
      const created = new Date(r.fields.date.created).getTime()
      if (!isFinite(created) || created < sevenDaysAgo) continue
      const t = getType(r)
      counts.set(t, (counts.get(t) || 0) + 1)
    }

    return Array.from(counts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
  }, [reports])

  // Map event type -> array of recent headlines (last 7d)
  const typeToHeadlines = useMemo(() => {
    if (!reports?.length) return {} as Record<string, { title: string; url: string; country?: string; created: number }[]>

    const now = Date.now()
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
    const out: Record<string, { title: string; url: string; country?: string; created: number }[]> = {}

    const getType = (r: ReliefWebItem) => {
      const f = (r as any)?.fields
      return (
        f?.disaster_type?.[0]?.name ||
        f?.theme?.[0]?.name ||
        f?.primary_type?.name ||
        'Update'
      )
    }

    for (const r of reports) {
      const created = new Date(r.fields.date.created).getTime()
      if (!isFinite(created) || created < sevenDaysAgo) continue

      const type = getType(r)
      const arr = out[type] || (out[type] = [])
      arr.push({
        title: r.fields.title,
        url: r.fields.url,
        country: r.fields.country?.[0]?.name,
        created,
      })
    }

    // Sort newest first and cap to a handful per type
    for (const k of Object.keys(out)) {
      out[k].sort((a, b) => b.created - a.created)
      out[k] = out[k].slice(0, 6)
    }
    return out
  }, [reports])

  const regionalLeaderboard = useMemo(() => {
    if (!reports?.length) return []

    const now = Date.now()
    const day = 24 * 60 * 60 * 1000
    const T0 = now
    const T_7 = now - 7 * day
    const T_14 = now - 14 * day

    const agg: Record<string, { cur: number; prev: number }> = {}

    for (const r of reports) {
      const created = new Date(r.fields.date.created).getTime()
      if (!isFinite(created)) continue

      const name = r.fields.country?.[0]?.name
      if (!name) continue

      const region = countryRegionMap[name] || 'Other'
      if (!agg[region]) agg[region] = { cur: 0, prev: 0 }

      if (created >= T_7 && created <= T0) agg[region].cur += 1
      else if (created >= T_14 && created < T_7) agg[region].prev += 1
    }

    return Object.entries(agg)
      .map(([region, v]) => {
        const delta = v.cur - v.prev
        const pct = v.prev > 0 ? (delta / v.prev) * 100 : (v.cur > 0 ? 100 : 0)
        return { region, count: v.cur, delta, pct: +pct.toFixed(1) }
      })
      .filter(row => row.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }, [reports, countryRegionMap])

  // 🔹 Global Volatility (events/day for the past ~30 days)
  const volatilitySeries = useMemo(() => {
    if (!events) return []
    const byDay = new Map<string, number>()
    events.forEach(e => {
      const d = new Date((e as any).geometry?.[0]?.date ?? (e as any).closed ?? Date.now())
      const key = d.toISOString().slice(0, 10) // YYYY-MM-DD
      byDay.set(key, (byDay.get(key) || 0) + 1)
    })
    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }))
  }, [events])

  return (
    <div className="space-y-6">
      {/* VERY LARGE front-page carousel */}
      {carouselItems.length > 0 && (
        <NewsCarousel
          items={carouselItems}
          onOpenContext={(c) => setContextCountry(c)}
          index={carouselIndex}
          onIndexChange={setCarouselIndex}
        />
      )}

      {/* NEW: compact ReliefWeb carousel (smaller) */}
      {reports && reports.length > 0 && (
        <div className="mt-4">
          <ReliefWebCarousel
            reports={reports}
            onOpenContext={(c) => setContextCountry(c)}
          />
        </div>
      )}
      
      {/* About */}
      <CollapsibleSection
        title="About this dashboard"
        storageKey="intro:open"
        defaultOpen={false}
        rightHint="What it does · Who uses it · What it offers"
      >
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            This dashboard applies a <span className="font-medium">geopolitics lens</span>:
            we surface local events and immediately frame them against regional and global context.
            Scan what’s happening now, then open the context panel for deeper comparisons.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <MiniSection title="Who it’s for" storageKey="intro:who" defaultOpen={false}>
              <ul className="list-disc list-inside space-y-1">
                <li>Analysts & researchers</li>
                <li>Security & risk teams</li>
                <li>NGOs / humanitarian ops</li>
                <li>Journalists / editors</li>
              </ul>
            </MiniSection>

            <MiniSection title="What it shows" storageKey="intro:what" defaultOpen={false}>
              <ul className="list-disc list-inside space-y-1">
                <li>Live map of incidents (last 24h)</li>
                <li>Latest headlines tied to pins or feeds</li>
                <li>GDP growth & CPI (World Bank)</li>
                <li>ReliefWeb updates (fallback)</li>
              </ul>
            </MiniSection>

            <MiniSection title="How to use it" storageKey="intro:how" defaultOpen={false}>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  Toggle categories in the map legend to filter pins.
                </li>
                <li>
                  Click a pin’s headline to read the source article
                  <span className="text-slate-500"> (opens in a new tab)</span>.
                </li>
                <li>
                  Use the <span className="font-medium">Events</span> page to see all pins as a
                  country-grouped list with search & category filters.
                </li>
                <li>
                  Skim the “Latest Headlines” panel below the map; click any item to open it.
                </li>
                <li>
                  Cycle the top carousel with <span className="font-mono">◀ ▶</span> or your keyboard
                  arrow keys.
                </li>
                <li>
                  For historical indicators, try the <span className="font-medium">Explorer</span> page
                  <span className="text-slate-500"> (/countries)</span>.
                </li>
              </ul>
            </MiniSection>

          </div>
        </div>
      </CollapsibleSection>

      {/* Map */}
      <Card title="Global Socio-Political Events (Last 24h)">
        <LazyEventMap events={events} onNews={handleNews} />
      </Card>

      {/* Regional Volatility Leaderboard (Counts, Last 7 Days) */}
      {regionalLeaderboard.length > 0 && (
        <Card title="Regional Volatility Leaderboard (Last 7 Days)">
          <div className="text-xs text-slate-600 mb-2">
            Based on ReliefWeb updates. Sorted by current week count. Δ shows week-over-week change vs the prior 7 days.
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={regionalLeaderboard}
                layout="vertical"
                margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="region" type="category" width={120} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: any, name: any) => {
                    if (name === 'count') return [value, 'Reports (7d)']
                    if (name === 'delta') return [value, 'Δ WoW (count)']
                    if (name === 'pct') return [`${value}%`, 'Δ WoW (%)']
                    return [value, name]
                  }}
                  labelFormatter={(label) => `Region: ${label}`}
                />
                <Bar dataKey="count" name="Reports (7d)">
                  <LabelList
                    dataKey="count"
                    position="right"
                    formatter={(v: any) => `${v}`}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Delta badges */}
          <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {regionalLeaderboard.map(row => (
              <li key={row.region} className="flex items-center justify-between rounded border px-2 py-1">
                <span className="font-medium text-slate-700">{row.region}</span>
                <span className="tabular-nums text-slate-700">
                  {row.count}
                  <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 ring-1 ${
                    row.delta > 0
                      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                      : row.delta < 0
                        ? 'bg-rose-50 text-rose-700 ring-rose-200'
                        : 'bg-slate-50 text-slate-700 ring-slate-200'
                  }`}>
                    {row.delta > 0 ? '▲' : row.delta < 0 ? '▼' : '•'} {row.delta >= 0 ? '+' : ''}{row.delta}
                    <span className="ml-1 opacity-70">({row.pct}%)</span>
                  </span>
                </span>
              </li>
            ))}
          </ul>

          {/* Transparency: which countries are in "Other" & Type mix */}
          {(otherCountries.length > 0 || typeBreakdown.length > 0) && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {otherCountries.length > 0 && (
                <div className="rounded-lg border p-3">
                  <div className="text-xs font-semibold text-slate-700 mb-1">“Other” includes</div>
                  <div className="text-xs text-slate-700">
                    {otherCountries.join(', ')}
                  </div>
                </div>
              )}

              {typeBreakdown.length > 0 && (
                <div className="rounded-lg border p-3">
                  <div className="text-xs font-semibold text-slate-700 mb-2">Event types (last 7 days)</div>
                  <ul className="space-y-1.5">
                    {typeBreakdown.map(t => {
                      const open = openTypeKey === t.type
                      const headlines = typeToHeadlines[t.type] || []
                      const id = `etype-${t.type.replace(/\s+/g, '-').toLowerCase()}`
                      return (
                        <li key={t.type} className="rounded">
                          <button
                            type="button"
                            onClick={() => setOpenTypeKey(prev => (prev === t.type ? null : t.type))}
                            className="group flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 ring-1 ring-slate-200 hover:bg-white hover:shadow-sm bg-slate-50"
                            aria-expanded={open}
                            aria-controls={id}
                          >
                            <span className="inline-flex items-center gap-2">
                              <span className="inline-block rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                                {t.type}
                              </span>
                            </span>
                            <span className="ml-2 flex items-center gap-2 text-[12px]">
                              <span className="tabular-nums text-slate-700">{t.count}</span>
                              <span
                                className={`inline-block transition-transform text-slate-500 group-hover:text-slate-700 ${
                                  open ? 'rotate-90' : ''
                                }`}
                                aria-hidden
                              >
                                〉
                              </span>
                            </span>
                          </button>

                          {open && headlines.length > 0 && (
                            <ul id={id} className="mt-1.5 space-y-1.5 border-l pl-3">
                              {headlines.map((h, i) => (
                                <li key={i} className="flex items-center justify-between gap-2">
                                  <a
                                    href={h.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    title={h.title}
                                    className="max-w-[75%] truncate inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1 text-[12px] ring-1 ring-slate-200 hover:bg-white hover:shadow-sm hover:ring-slate-300"
                                  >
                                    {/* headline text */}
                                    <span className="truncate">{h.title}</span>
                                    {/* external link icon */}
                                    <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                                  </a>
                                  <span className="shrink-0 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 ring-1 ring-slate-200">
                                    {h.country ?? 'Global'}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Global Volatility Tracker */}
      {events && (
        <Card title="Global Volatility Tracker">
          {eventsLoading ? (
            <div className="h-64 grid place-items-center">
              <Loading label="Calculating volatility…" />
            </div>
          ) : volatilitySeries.length === 0 ? (
            <div className="h-32 grid place-items-center text-xs text-slate-500">
              No open events available right now.
            </div>
          ) : (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={volatilitySeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} width={35} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" name="Events" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-slate-600">
                Daily count of open EONET incidents globally. Spikes can signal rising instability or disaster activity.
              </p>
            </>
          )}
        </Card>
      )}

      {/* KPI charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CollapsibleSection
          title="Global GDP Growth (WLD)"
          storageKey="kpi:gdp"
          defaultOpen={false}
          rightHint={lastGDP ? `Latest: ${lastGDP.date} · ${lastGDP.value?.toFixed(2)}%` : undefined}
        >
          {!gdpSeries ? <Loading/> :
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={gdpSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{fontSize: 10}}/>
                <YAxis domain={['auto','auto']} tick={{fontSize: 10}}/>
                <Tooltip />
                <Line type="monotone" dataKey="value" />
              </LineChart>
            </ResponsiveContainer>
          </div>}
        </CollapsibleSection>

        <CollapsibleSection
          title="Global CPI (Inflation % YOY)"
          storageKey="kpi:cpi"
          defaultOpen={false}
          rightHint={lastCPI ? `Latest: ${lastCPI.date} · ${lastCPI.value?.toFixed(2)}%` : undefined}
        >
          {!cpiSeries ? <Loading/> :
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cpiSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{fontSize: 10}}/>
                <YAxis domain={['auto','auto']} tick={{fontSize: 10}}/>
                <Tooltip />
                <Line type="monotone" dataKey="value" />
              </LineChart>
            </ResponsiveContainer>
          </div>}
        </CollapsibleSection>
      </div>

      {/* Headlines list */}
      <CollapsibleSection
        title={uniqueMapNews.length ? 'Latest Headlines (from Map, 24h)' : 'Latest Humanitarian Updates (ReliefWeb)'}
        storageKey="news:list"
        defaultOpen={false}
        rightHint={
          uniqueMapNews.length
            ? `${Math.min(uniqueMapNews.length, NEWS_VISIBLE)} of ${uniqueMapNews.length}`
            : (reports ? `${reports.length} items` : undefined)
        }
      >
        {!mapNews.length ? (
          !reports ? <Loading/> : (
            <ul className="divide-y">
              {reports.map(item => {
                const countryName = item.fields.country?.[0]?.name
                return (
                  <li key={item.id} className="py-3">
                    <div className="flex items-start gap-2">
                      <Newspaper className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
                      <div className="min-w-0 flex-1">
                        <a
                          href={item.fields.url}
                          target="_blank"
                          rel="noreferrer"
                          title={item.fields.title}
                          className="block font-medium leading-snug hover:underline whitespace-normal break-words"
                        >
                          {item.fields.title}
                        </a>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 whitespace-normal break-words">
                          <span>{new Date(item.fields.date.created).toLocaleString()}</span>
                          <span className="opacity-60">—</span>
                          <span>{countryName ? countryName : (item.fields.country?.map(c=>c.name).join(', ') || 'Global')}</span>
                          {countryName && (
                            <>
                              <span className="opacity-60">·</span>
                              <button
                                type="button"
                                onClick={() => setContextCountry(countryName)}
                                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 ring-1 ring-slate-200 hover:bg-slate-200"
                                title="Open geopolitical context"
                              >
                                <Info className="h-3 w-3" /> Open context
                              </button>
                            </>
                          )}
                        </div>
                        {countryName && <EventContextChips countryName={countryName} />}
                      </div>
                      <a href={item.fields.url} target="_blank" rel="noreferrer" aria-label="Open link" className="mt-0.5 shrink-0">
                        <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                      </a>
                    </div>
                  </li>
                )
              })}
            </ul>
          )
        ) : (
          <ul className="divide-y">
            {sortByReputation(uniqueMapNews).slice(0, NEWS_VISIBLE).map(item => (
              <li key={item.id} className="py-3">
                <div className="flex items-start gap-2">
                  <Newspaper className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
                  <div className="min-w-0 flex-1">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      title={item.headline}
                      className="block font-medium leading-snug hover:underline whitespace-normal break-words"
                    >
                      {item.headline}
                    </a>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                      {item.source && <span className="shrink-0">{item.source}</span>}
                      <span className="opacity-60 shrink-0">·</span>
                      <span className="inline-flex items-center gap-1 shrink-0">
                        <TagIcon className="h-3 w-3 opacity-60" />
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700 ring-1 ring-slate-200">
                          {item.category}
                        </span>
                      </span>
                      <span className="opacity-60 shrink-0">·</span>
                      <span className="shrink-0">Lat/Lon: {item.lat.toFixed(2)}, {item.lon.toFixed(2)}</span>
                    </div>
                  </div>
                  <a href={item.url} target="_blank" rel="noreferrer" aria-label="Open link" className="mt-0.5 shrink-0">
                    <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CollapsibleSection>

      {/* Side note card */}
      <Card title="What this app tracks">
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            The dashboard combines <span className="font-medium">real-time event intelligence</span> with key macroeconomic indicators
            to provide a single view of emerging global dynamics—and situates local events in a broader geopolitical frame.
          </p>

          <ul className="list-disc list-inside pl-2 space-y-1.5">
            <li><span className="font-medium">Live incident map:</span> Global unrest, political, and security events.</li>
            <li><span className="font-medium">Macro backdrop:</span> GDP growth trends (World Bank, WLD series).</li>
            <li><span className="font-medium">Inflation data:</span> Year-over-year CPI (World Bank, WLD series).</li>
            <li><span className="font-medium">Humanitarian feed:</span> Latest situation reports (ReliefWeb API).</li>
            <li><span className="font-medium">Country context:</span> Governance & macro vs. world, on demand.</li>
          </ul>

          {error && (
            <div className="pt-2">
              <ErrorState message={error} />
            </div>
          )}
        </div>
      </Card>

      {/* Context Sidebar */}
      {contextCountry && (
        <ContextSidebar
          countryName={contextCountry}
          onClose={() => setContextCountry(null)}
        />
      )}
    </div>
  )
}
