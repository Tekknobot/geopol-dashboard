import { useEffect, useMemo, useState } from 'react'
import Card from '../components/Card'
import Loading from '../components/Loading'
import ErrorState from '../components/ErrorState'
import { getLatestReports, ReliefWebItem } from '../services/reliefweb'
import { getOpenEvents, EonetEvent } from '../services/eonet'
import { wbGetGlobalIndicator, toSeries, WbPoint } from '../services/worldBank'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import LazyEventMap from '../components/LazyEventMap'
import { getCache, setCache } from '../services/cache'
import { Newspaper, ExternalLink, Tag as TagIcon } from 'lucide-react'
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

// ---------- Simple digest utilities (keywordy, no extra deps)
const STOP = new Set([
  'the','a','an','and','or','of','in','on','to','for','by','with','at','from','as','that','this',
  'is','are','be','was','were','will','after','amid','over','into','new','latest','report','reports'
])

function words(s: string) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function topN<T>(entries: [T, number][], n: number) {
  return entries.sort((a,b) => b[1]-a[1]).slice(0, n).map(([k]) => k)
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

  // ---------- Build a lightweight digest paragraph + bullet picks
  const digest = useMemo(() => {
    // Use map headlines if present; else ReliefWeb titles as fallback
    const items = hasMapNews
      ? mapNews.map(n => ({ title: n.headline, category: n.category, source: n.source || '' }))
      : (reports || []).map(r => ({
          title: r.fields.title,
          category: (r.fields?.theme?.[0]?.name || 'Update'),
          source: new URL(r.fields.url).hostname.replace(/^www\./,'')
        }))

    if (!items.length) return null

    // Category frequency
    const catCount = new Map<string, number>()
    // Source frequency
    const srcCount = new Map<string, number>()
    // Keyword frequency (from titles, crude but useful)
    const kw = new Map<string, number>()

    for (const it of items) {
      catCount.set(it.category, (catCount.get(it.category) || 0) + 1)
      if (it.source) srcCount.set(it.source, (srcCount.get(it.source) || 0) + 1)
      for (const w of words(it.title)) {
        if (STOP.has(w) || w.length < 3) continue
        kw.set(w, (kw.get(w) || 0) + 1)
      }
    }

    const topCats = topN(Array.from(catCount.entries()), 3)
    const topSrcs = topN(Array.from(srcCount.entries()), 3)
    const topKws  = topN(Array.from(kw.entries()), 6)

    // Pick a few notable headlines (dedupe by title)
    const seen = new Set<string>()
    const picks = items.filter(it => {
      const key = it.title.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).slice(0, 6)

    const summary = [
      'Past 24h highlights:',
      topCats.length ? `top categories: ${topCats.join(', ')}.` : '',
      topSrcs.length ? `notable coverage: ${topSrcs.join(', ')}.` : '',
      topKws.length  ? `common keywords: ${topKws.join(', ')}.` : ''
    ].filter(Boolean).join(' ')

    return { summary, picks }
  }, [hasMapNews, mapNews, reports])

  return (
    <div className="space-y-6">
      {/* Auto summary ABOVE the info panel (collapsed by default, remembers state) */}
      <CollapsibleSection
        title="Today’s map summary (auto-generated)"
        storageKey="digest:open"
        defaultOpen={false}
        rightHint={hasMapNews ? `${mapNews.length} headlines` : (reports ? `${reports.length} reports` : undefined)}
      >
        {!digest ? (
          <div className="text-sm text-slate-500">Loading a summary…</div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">{digest.summary}</p>
            <ul className="space-y-2">
              {(hasMapNews ? mapNews : (reports || []).map(r => ({
                id: String(r.id),
                headline: r.fields.title,
                url: r.fields.url,
                source: new URL(r.fields.url).hostname.replace(/^www\./,''),
                category: (r.fields?.theme?.[0]?.name || 'Update')
              })))
                .slice(0, 6)
                .map((item) => (
                <li key={item.id} className="flex items-start gap-2">
                  <Newspaper className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
                  <div className="min-w-0 flex-1">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block font-medium leading-snug hover:underline whitespace-normal break-words"
                      title={item.headline}
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
                    </div>
                  </div>
                  <a href={item.url} target="_blank" rel="noreferrer" aria-label="Open link" className="mt-0.5 shrink-0">
                    <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CollapsibleSection>

      {/* Intro (collapsed by default, with collapsible subpanels) */}
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

      {/* Map (not collapsed; primary interactive surface) */}
      <Card title="Global Socio-Political Events (Last 24h)">
        {!events ? <Loading label="Preparing map..." /> : <LazyEventMap events={events} onNews={setMapNews} />}
      </Card>

      {/* KPI charts — both collapsible & persisted */}
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

      {/* Headlines — collapsible & persisted; still falls back to ReliefWeb */}
      <CollapsibleSection
        title={hasMapNews ? 'Latest Headlines (from Map, 24h)' : 'Latest Humanitarian Updates (ReliefWeb)'}
        storageKey="news:list"
        defaultOpen={false}
        rightHint={hasMapNews ? `${mapNews.length} items` : (reports ? `${reports.length} items` : undefined)}
      >
        {!hasMapNews ? (
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

      {/* Side note card (clean formatted list) */}
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
