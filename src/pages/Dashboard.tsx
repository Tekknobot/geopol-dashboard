import { useEffect, useMemo, useRef, useState } from 'react'
import Card from '../components/Card'
import Loading from '../components/Loading'
import ErrorState from '../components/ErrorState'
import { getLatestReports, ReliefWebItem } from '../services/reliefweb'
import { getOpenEvents, EonetEvent } from '../services/eonet'
import { wbGetGlobalIndicator, toSeries, WbPoint } from '../services/worldBank'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import LazyEventMap from '../components/LazyEventMap'
import { getCache, setCache } from '../services/cache'
import { Newspaper, ExternalLink, Tag as TagIcon, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import type { MapNewsItem } from '../components/MapCore'

// ---------- Tiny helpers for collapsible sections (with localStorage memory)
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
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function NewsCarousel({ items }: { items: HeadlineItem[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const total = items.length
  const timerRef = useRef<number | null>(null)

  // auto-advance
  useEffect(() => {
    if (paused || total <= 1) return
    timerRef.current = window.setInterval(() => {
      setIndex(i => (i + 1) % total)
    }, 6500)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [paused, total])

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIndex(i => (i + 1) % total)
      if (e.key === 'ArrowLeft')  setIndex(i => (i - 1 + total) % total)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [total])

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
      {/* Background vignette */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-slate-100" />

      {/* Content */}
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

          <a
            href={it.url}
            target="_blank"
            rel="noreferrer"
            className="block"
            title={it.headline}
          >
            {/* MASSIVE headline, wraps elegantly */}
            <h2 className="font-extrabold leading-tight tracking-tight text-3xl sm:text-5xl md:text-6xl xl:text-7xl whitespace-normal break-words">
              {it.headline}
            </h2>
          </a>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span className="inline-flex items-center gap-2">
              <Newspaper className="h-4 w-4 opacity-70" />
              {it.source || new URL(it.url).hostname.replace(/^www\./,'')}
            </span>
            <span className="opacity-50">•</span>
            <a
              href={it.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-500"
            >
              Read article <ExternalLink className="h-4 w-4 opacity-70" />
            </a>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between p-2 sm:p-4">
        <button
          type="button"
          aria-label="Previous headline"
          onClick={() => setIndex(i => (i - 1 + total) % total)}
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
          onClick={() => setIndex(i => (i + 1) % total)}
          className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow ring-1 ring-black/10 hover:bg-white"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Dots */}
      <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1.5">
        {items.slice(0, 12).map((_, i) => (
          <button
            key={i}
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => setIndex(i % total)}
            className={`h-2.5 w-2.5 rounded-full transition ${
              i % total === index ? 'bg-slate-900' : 'bg-slate-300 hover:bg-slate-400'
            }`}
          />
        ))}
      </div>
    </section>
  )
}

export default function Dashboard() {
  const [reports, setReports] = useState<ReliefWebItem[] | null>(null)
  const [events, setEvents] = useState<EonetEvent[] | null>(null)
  const [gdpSeries, setGdpSeries] = useState<WbPoint[] | null>(null)
  const [cpiSeries, setCpiSeries] = useState<WbPoint[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 📡 News flowing from the map
  const [mapNews, setMapNews] = useState<MapNewsItem[]>([])

  // 6-hour cache
  const TTL = 6 * 60 * 60 * 1000

  useEffect(() => {
    (async () => {
      try {
        // Try cache first
        const cgdp = getCache<WbPoint[]>('wld:gdp', TTL)
        const ccpi = getCache<WbPoint[]>('wld:cpi', TTL)
        const crw = getCache<ReliefWebItem[]>('rw:latest', TTL)

        if (cgdp) setGdpSeries(cgdp)
        if (ccpi) setCpiSeries(ccpi)
        if (crw) setReports(crw)

        // Load charts quickly (20y window is enough for trend)
        const [gdp, cpi] = await Promise.all([
          wbGetGlobalIndicator('NY.GDP.MKTP.KD.ZG', 20),
          wbGetGlobalIndicator('FP.CPI.TOTL.ZG', 20),
        ])
        const gdpS = toSeries(gdp)
        const cpiS = toSeries(cpi)
        setGdpSeries(gdpS); setCache('wld:gdp', gdpS)
        setCpiSeries(cpiS); setCache('wld:cpi', cpiS)

        // ReliefWeb feed (fallback content if map has nothing yet)
        if (!crw) {
          const rw = await getLatestReports(10)
          setReports(rw); setCache('rw:latest', rw)
        }
      } catch (e:any) {
        setError(e?.message || 'Failed to load data')
      }
    })()

    // Defer heavier EONET fetch to idle time for faster first paint
    ric(async () => {
      try {
        const cev = getCache<EonetEvent[]>('eonet:open', TTL)
        if (cev) setEvents(cev)
        const ev = await getOpenEvents()
        setEvents(ev); setCache('eonet:open', ev)
      } catch (e:any) {
        // ignore map errors in initial load
      }
    })
  }, [])

  const lastGDP = useMemo(() => gdpSeries?.filter(p => p.value !== null).slice(-1)[0], [gdpSeries])
  const lastCPI = useMemo(() => cpiSeries?.filter(p => p.value !== null).slice(-1)[0], [cpiSeries])

  const hasMapNews = mapNews.length > 0

  // Build carousel items (randomized), fallback to ReliefWeb if map has none
  const carouselItems: HeadlineItem[] = useMemo(() => {
    const base: HeadlineItem[] = hasMapNews
      ? mapNews.map(n => ({
          id: n.id,
          headline: n.headline,
          url: n.url,
          source: n.source,
          category: n.category,
          lat: n.lat,
          lon: n.lon
        }))
      : (reports || []).map(r => ({
          id: String(r.id),
          headline: r.fields.title,
          url: r.fields.url,
          source: new URL(r.fields.url).hostname.replace(/^www\./,''),
          category: 'Update'
        }))

    // Remove empties, shuffle, and cap to a sensible number to keep dots reasonable
    return shuffle(base.filter(b => b.headline && b.url)).slice(0, 12)
  }, [hasMapNews, mapNews, reports])

  return (
    <div className="space-y-6">
      {/* VERY LARGE front-page carousel (random map headlines) */}
      {carouselItems.length > 0 && (
        <NewsCarousel items={carouselItems} />
      )}

      {/* Intro (collapsible; collapsed by default; with collapsible subpanels) */}
      <CollapsibleSection
        title="About this dashboard"
        storageKey="intro:open"
        defaultOpen={false}
        rightHint="What it does · Who uses it · What it offers"
      >
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            This dashboard tracks <span className="font-medium">real-time socio-political signals</span> around the world and pairs them with a quick macro backdrop.
            Use it to scan what’s happening now, then drill into countries for context.
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
                <li>Latest headlines tied to pins</li>
                <li>GDP growth & CPI (World Bank)</li>
                <li>ReliefWeb updates (fallback)</li>
              </ul>
            </MiniSection>

            <MiniSection title="How to use it" storageKey="intro:how" defaultOpen={false}>
              <ul className="list-disc list-inside space-y-1">
                <li>Toggle categories in the legend</li>
                <li>Click pins to open sources</li>
                <li>Browse country drilldowns</li>
                <li>Compare with macro trends</li>
              </ul>
            </MiniSection>
          </div>
        </div>
      </CollapsibleSection>

      {/* Map */}
      <Card title="Global Socio-Political Events (Last 24h)">
        {!events ? <Loading label="Preparing map..." /> : <LazyEventMap events={events} onNews={setMapNews} />}
      </Card>

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

      {/* Headlines list (still collapsible & persisted; same as before) */}
      <CollapsibleSection
        title={mapNews.length ? 'Latest Headlines (from Map, 24h)' : 'Latest Humanitarian Updates (ReliefWeb)'}
        storageKey="news:list"
        defaultOpen={false}
        rightHint={mapNews.length ? `${mapNews.length} items` : (reports ? `${reports.length} items` : undefined)}
      >
        {!mapNews.length ? (
          !reports ? <Loading/> : (
            <ul className="divide-y">
              {reports.map(item => (
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
                      <div className="mt-1 text-xs text-slate-500 whitespace-normal break-words">
                        {new Date(item.fields.date.created).toLocaleString()} — {item.fields.country?.map(c=>c.name).join(', ') || 'Global'}
                      </div>
                    </div>
                    <a href={item.fields.url} target="_blank" rel="noreferrer" aria-label="Open link" className="mt-0.5 shrink-0">
                      <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : (
          <ul className="divide-y">
            {mapNews.slice(0, 40).map(item => (
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
            to provide a single view of emerging global dynamics.
          </p>

          <ul className="list-disc list-inside pl-2 space-y-1.5">
            <li>
              <span className="font-medium">Live incident map:</span> Global unrest, political, and security events via GDELT.
            </li>
            <li>
              <span className="font-medium">Macro backdrop:</span> GDP growth trends (World Bank, WLD series).
            </li>
            <li>
              <span className="font-medium">Inflation data:</span> Year-over-year CPI (World Bank, WLD series).
            </li>
            <li>
              <span className="font-medium">Humanitarian feed:</span> Latest situation reports (ReliefWeb API).
            </li>
            <li>
              <span className="font-medium">Country drilldowns:</span> Governance and development indicators by region.
            </li>
          </ul>

          {error && (
            <div className="pt-2">
              <ErrorState message={error} />
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
