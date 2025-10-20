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

// Polyfill requestIdleCallback for Safari
const ric = (cb: () => void) => {
  const fn = (window as any).requestIdleCallback as any
  if (typeof fn === 'function') return fn(cb)
  return setTimeout(cb, 1)
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

  return (
    <div className="space-y-6">
      {/* Intro / What this site does (appears ABOVE the map) */}
      <Card title="About this dashboard">
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            This dashboard tracks <span className="font-medium">real-time socio-political signals</span> around the world and pairs them with a quick macro backdrop.
            Use it to scan what’s happening now, then drill into countries for context.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg border p-3">
              <div className="text-[13px] font-semibold mb-1">Who it’s for</div>
              <ul className="list-disc list-inside text-[13px] space-y-1">
                <li>Analysts & researchers</li>
                <li>Security & risk teams</li>
                <li>NGOs / humanitarian ops</li>
                <li>Journalists / editors</li>
              </ul>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-[13px] font-semibold mb-1">What it shows</div>
              <ul className="list-disc list-inside text-[13px] space-y-1">
                <li>Live map of incidents (last 24h)</li>
                <li>Latest headlines tied to pins</li>
                <li>GDP growth & CPI (World Bank)</li>
                <li>ReliefWeb updates (fallback)</li>
              </ul>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-[13px] font-semibold mb-1">How to use it</div>
              <ul className="list-disc list-inside text-[13px] space-y-1">
                <li>Toggle categories in the legend</li>
                <li>Click pins to open sources</li>
                <li>Browse country drilldowns</li>
                <li>Compare with macro trends</li>
              </ul>
            </div>
          </div>
        </div>
      </Card>

      {/* Map section */}
      <Card title="Global Socio-Political Events (Last 24h)">
        {!events ? <Loading label="Preparing map..." /> : <LazyEventMap events={events} onNews={setMapNews} />}
        {/* The map sources GDELT internally. */}
      </Card>

      {/* KPI charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Global GDP Growth (WLD)">
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
          {lastGDP && <div className="text-xs text-slate-600 mt-2">Latest: {lastGDP.date} — {lastGDP.value?.toFixed(2)}%</div>}
        </Card>

        <Card title="Global CPI (Inflation % YOY)">
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
          {lastCPI && <div className="text-xs text-slate-600 mt-2">Latest: {lastCPI.date} — {lastCPI.value?.toFixed(2)}%</div>}
        </Card>
      </div>

      {/* News list driven by the map; falls back to ReliefWeb if needed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card title={hasMapNews ? 'Latest Headlines (from Map, 24h)' : 'Latest Humanitarian Updates (ReliefWeb)'}>
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
          </Card>
        </div>

        <div className="lg:col-span-1">
          {/* What this app tracks */}
          <Card title="What this app tracks">
            <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
              <li>Real-time global incidents & unrest mapped from news signals (GDELT)</li>
              <li>Macro backdrop: World Bank GDP growth (WLD)</li>
              <li>Global inflation: World Bank CPI (YOY, WLD)</li>
              <li>Humanitarian situation updates (ReliefWeb latest reports)</li>
              <li>Country drilldowns for governance & development indicators</li>
            </ul>
            {error && (
              <div className="mt-3">
                <ErrorState message={error} />
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
