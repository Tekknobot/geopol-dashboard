import { useEffect, useMemo, useRef, useState } from 'react'
import Card from '../components/Card'
import Loading from '../components/Loading'
import { searchCountryByName, Country } from '../services/restCountries'
import { wbGetCountryIndicator, wbGetGlobalIndicator, toSeries, WbPoint } from '../services/worldBank'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ComposedChart, Scatter, ReferenceArea, ReferenceLine
} from 'recharts'

const INDICATORS = [
  { code: 'PV.EST', label: 'Political Stability (WGI, est.)' },
  { code: 'GE.EST', label: 'Government Effectiveness (WGI, est.)' },
  { code: 'CC.EST', label: 'Control of Corruption (WGI, est.)' },
  { code: 'NY.GDP.MKTP.KD.ZG', label: 'GDP Growth (annual %)' },
  { code: 'FP.CPI.TOTL.ZG', label: 'Inflation, CPI (annual %)' }
]

type SeriesBundle = { country: WbPoint[]; world: WbPoint[] }
type WbCountryMeta = { id: string; name: string; region: { id: string; value: string } }
type RegionalRow = { name: string; value: number | null; iso3: string; isFocus?: boolean }

// ----- tiny utilities
const debounce = (fn: Function, ms: number) => {
  let t: any
  return (...args: any[]) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}

function mapRestRegionToWb(region: string): string[] {
  switch (region) {
    case 'Africa': return ['SSF']
    case 'Americas': return ['NAC', 'LCN'] // North America, Latin America & Caribbean
    case 'Asia': return ['EAS', 'SAS', 'MEA'] // MEA is MENA; WB uses 'MEA' on v2 meta
    case 'Europe': return ['ECS']
    case 'Oceania': return ['EAS']
    default: return []
  }
}

async function fetchWbCountryMeta(): Promise<WbCountryMeta[]> {
  const res = await fetch('https://api.worldbank.org/v2/country?format=json&per_page=1000')
  const json = await res.json()
  const data = (json?.[1] || []) as any[]
  return data.map(d => ({
    id: d.id as string,
    name: d.name as string,
    region: { id: d.region?.id, value: d.region?.value }
  }))
}

export default function CountryExplorer() {
  // UI state
  const [input, setInput] = useState('Canada')
  const [suggestions, setSuggestions] = useState<Country[]>([])
  const [selected, setSelected] = useState<Country | null>(null)

  // data state
  const [series, setSeries] = useState<Record<string, SeriesBundle>>({})
  const [regionalRows, setRegionalRows] = useState<RegionalRow[] | null>(null)
  const [neighbors, setNeighbors] = useState<string[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // prevent out-of-order responses
  const loadIdRef = useRef(0)

  // cache per ISO3
  const seriesCacheRef = useRef<Map<string, Record<string, SeriesBundle>>>(new Map())

  // ---- search suggestions (debounced)
  useEffect(() => {
    const run = debounce(async (q: string) => {
      if (!q.trim()) { setSuggestions([]); return }
      try {
        const res = await searchCountryByName(q.trim())
        setSuggestions(res.slice(0, 8))
      } catch {
        setSuggestions([])
      }
    }, 250)
    run(input)
  }, [input])

  // choose a country
  const choose = (c: Country) => {
    setSelected(c)
    setInput(c.name?.common || c.cca3 || '')
    void loadCountry(c)
  }

  // enter picks first suggestion
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (suggestions.length) choose(suggestions[0])
    }
  }

  // ---- main loader (race-proof, cached)
  const loadCountry = async (c: Country) => {
    const iso3 = c.cca3
    setError(null)
    setNeighbors(null)
    setRegionalRows(null)
    setSeries({})
    setLoading(true)
    const myLoadId = ++loadIdRef.current

    try {
      // cache
      const cached = seriesCacheRef.current.get(iso3)
      let mapped: Record<string, SeriesBundle> | null = cached || null

      if (!mapped) {
        const [countrySets, worldSets] = await Promise.all([
          Promise.all(INDICATORS.map(ind => wbGetCountryIndicator(iso3, ind.code, 30))),
          Promise.all(INDICATORS.map(ind => wbGetGlobalIndicator(ind.code, 30))),
        ])
        const m: Record<string, SeriesBundle> = {}
        for (let i = 0; i < INDICATORS.length; i++) {
          m[INDICATORS[i].code] = {
            country: toSeries(countrySets[i]),
            world: toSeries(worldSets[i]),
          }
        }
        mapped = m
        seriesCacheRef.current.set(iso3, m)
      }

      // neighbors (Country may not declare 'borders')
      const borderCodes = ((c as any)?.borders as string[] | undefined) || []
      if (borderCodes.length) {
        try {
          const res = await fetch(`https://restcountries.com/v3.1/alpha?fields=name,cca3&codes=${encodeURIComponent(borderCodes.join(','))}`)
          const js = await res.json() as { name: { common: string }, cca3: string }[]
          if (myLoadId === loadIdRef.current) setNeighbors(js.map(x => x.name.common).sort())
        } catch { if (myLoadId === loadIdRef.current) setNeighbors([]) }
      } else {
        if (myLoadId === loadIdRef.current) setNeighbors([])
      }

      // regional comparator using WB region of the selected country (industry-style dot plot)
      if (c.region) {
        try {
          const wbCountries = await fetchWbCountryMeta()
          const selISO3 = c.cca3
          const selMeta = wbCountries.find(x => x.id === selISO3)
          const regionId = selMeta?.region?.id
          const regionIds = regionId ? [regionId] : mapRestRegionToWb(c.region)

          let candidates = wbCountries
            .filter(cc => regionIds.includes(cc.region.id))
            .map(cc => ({ name: cc.name, iso3: cc.id }))

          // ensure selected is present
          if (!candidates.some(x => x.iso3 === selISO3)) {
            candidates.push({ name: c.name?.common || selISO3, iso3: selISO3 })
          }

          const rows = await Promise.all(
            candidates.map(async cand => {
              const s = toSeries(await wbGetCountryIndicator(cand.iso3, 'PV.EST', 6))
              const nonNull = s.filter(p => p.value !== null)
              const v = nonNull.length ? (nonNull[nonNull.length - 1].value as number) : null
              return { name: cand.name, iso3: cand.iso3, value: v, isFocus: cand.iso3 === selISO3 } as RegionalRow
            })
          )

          // sort (desc), keep tidy list
          const withData = rows.filter(r => r.value !== null) as RegionalRow[]
          withData.sort((a,b)=> (b.value as number) - (a.value as number))
          const TOP = 20
          let top = withData.slice(0, TOP)

          if (!top.some(r => r.iso3 === selISO3)) {
            const me = rows.find(r => r.iso3 === selISO3)
            if (me) top = [...top, me]
          }

          if (myLoadId === loadIdRef.current) setRegionalRows(top)
        } catch {
          if (myLoadId === loadIdRef.current) setRegionalRows([])
        }
      } else {
        if (myLoadId === loadIdRef.current) setRegionalRows([])
      }

      if (myLoadId === loadIdRef.current) setSeries(mapped!)
    } catch (e: any) {
      if (myLoadId === loadIdRef.current) setError(e?.message || 'Lookup failed')
    } finally {
      if (myLoadId === loadIdRef.current) setLoading(false)
    }
  }

  // facts
  const facts = useMemo(() => {
    if (!selected) return null
    return [
      ['Official name', selected.name?.official],
      ['Region', selected.region + (selected.subregion ? ` — ${selected.subregion}` : '')],
      ['Capital', (selected.capital || ['—']).join(', ')],
      ['Population', selected.population?.toLocaleString()],
      ['Area (km²)', selected.area?.toLocaleString()],
      ['Currencies', selected.currencies ? Object.values(selected.currencies).map(c=>`${c.name} (${c.symbol||''})`).join(', ') : '—'],
      ['Languages', selected.languages ? Object.values(selected.languages).join(', ') : '—'],
      ['ISO2 / ISO3', `${selected.cca2} / ${selected.cca3}`],
    ]
  }, [selected])

  // merge country+world by date
  const mergeCW = (bund: SeriesBundle | undefined) => {
    if (!bund) return []
    const map = new Map<string, any>()
    bund.world.forEach(p => map.set(p.date, { date: p.date, world: p.value }))
    bund.country.forEach(p => {
      const row = map.get(p.date) || { date: p.date }
      row.country = p.value
      map.set(p.date, row)
    })
    return Array.from(map.values()).sort((a,b)=>a.date.localeCompare(b.date))
  }

  const trend = (arr: WbPoint[] | undefined) => {
    const vals = (arr || []).map(x => x.value).filter((v): v is number => v !== null)
    const len = vals.length
    if (len < 2) return '→'
    const d = vals[len - 1] - vals[len - 2]
    return d > 0 ? '↑' : d < 0 ? '↓' : '→'
  }

  // initial load
  useEffect(() => {
    if (!selected && input) {
      (async () => {
        try {
          const res = await searchCountryByName(input.trim())
          if (res[0]) {
            setSelected(res[0])
            await loadCountry(res[0])
          }
        } catch {}
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // quartiles for comparator
  const comparatorStats = useMemo(() => {
    const vals = (regionalRows || [])
      .map(r => r.value)
      .filter((v): v is number => v !== null)
      .sort((a,b)=>a-b)
    if (!vals.length) return { min: 0, q1: 0, med: 0, q3: 0, max: 0 }
    const q = (p: number) => {
      const pos = (vals.length - 1) * p
      const base = Math.floor(pos)
      const rest = pos - base
      return vals[base] + (vals[base + 1] !== undefined ? rest * (vals[base + 1] - vals[base]) : 0)
    }
    return {
      min: vals[0],
      q1: q(0.25),
      med: q(0.5),
      q3: q(0.75),
      max: vals[vals.length - 1]
    }
  }, [regionalRows])

  return (
    <div className="space-y-6">
      {/* Search + facts */}
      <Card
        title="Country search"
        right={
          <div className="hidden md:block relative">
            <input
              value={input}
              onChange={e=>setInput(e.target.value)}
              onKeyDown={onKeyDown}
              className="rounded-lg border px-3 py-1 text-sm w-72"
              placeholder="Type to search…"
            />
            {suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-72 max-h-64 overflow-auto rounded-lg border bg-white shadow">
                {suggestions.map(s => (
                  <li
                    key={s.cca3}
                    className="cursor-pointer px-3 py-2 text-sm hover:bg-slate-50"
                    onClick={() => choose(s)}
                  >
                    {s.name?.common} <span className="text-slate-500">({s.region}{s.subregion ? ` — ${s.subregion}` : ''})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        }
      >
        {/* Mobile input */}
        <div className="md:hidden mb-3">
          <div className="relative">
            <input
              value={input}
              onChange={e=>setInput(e.target.value)}
              onKeyDown={onKeyDown}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Search a country…"
            />
            {suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full max-h-64 overflow-auto rounded-lg border bg-white shadow">
                {suggestions.map(s => (
                  <li
                    key={s.cca3}
                    className="cursor-pointer px-3 py-2 text-sm hover:bg-slate-50"
                    onClick={() => choose(s)}
                  >
                    {s.name?.common} <span className="text-slate-500">({s.region}{s.subregion ? ` — ${s.subregion}` : ''})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {loading && <Loading/>}

        {selected && (
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center min-w-0">
            {selected.flags?.png && (
              <img
                src={selected.flags.png}
                className="w-20 h-12 sm:w-24 sm:h-16 object-cover rounded-md border shrink-0"
                alt="flag"
                loading="lazy"
              />
            )}

            <div className="min-w-0 w-full">
              <div className="text-lg sm:text-xl font-semibold break-words">{selected.name.common}</div>

              {/* Facts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-2 mt-3 text-sm">
                {facts?.map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
                      <div className="text-slate-500 sm:w-44">{k}</div>
                      <div className="font-medium break-words">{v}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Neighbors */}
              {neighbors && (
                <div className="mt-3 text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">Neighbors:</span>{' '}
                  {neighbors.length ? neighbors.join(', ') : '—'}
                </div>
              )}
            </div>
          </div>
        )}

        {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
      </Card>

      {/* Regional Comparator — Dot plot with quartiles + median */}
      {regionalRows && selected?.name?.common && (
        <Card title={`Regional Comparator · Political Stability (WGI) — ${selected.region}`}>
          {!regionalRows.length ? (
            <div className="text-sm text-slate-600">No regional data available.</div>
          ) : (
            <div className="h-[360px] w-full">
              <ResponsiveContainer>
                <ComposedChart
                  layout="vertical"
                  data={regionalRows.map(r => ({ name: r.name, value: r.value, isFocus: r.iso3 === selected.cca3 }))}
                  margin={{ top: 8, right: 24, bottom: 8, left: 140 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={['auto','auto']} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />

                  {/* Quartile shading */}
                  <ReferenceArea x1={comparatorStats.min} x2={comparatorStats.q1} y1="dataMin" y2="dataMax" />
                  <ReferenceArea x1={comparatorStats.q1} x2={comparatorStats.q3} y1="dataMin" y2="dataMax" />
                  <ReferenceArea x1={comparatorStats.q3} x2={comparatorStats.max} y1="dataMin" y2="dataMax" />

                  {/* Median */}
                  <ReferenceLine x={comparatorStats.med} strokeDasharray="4 2" />

                  {/* Dots */}
                  <Scatter
                    dataKey="value"
                    shape={(p: any) => {
                      const r = p.payload
                      const size = r.isFocus ? 6 : 4
                      return <circle cx={p.cx} cy={p.cy} r={size} />
                    }}
                  />

                  <Tooltip
                    formatter={(v: any) => (typeof v === 'number' ? v.toFixed(2) : '—')}
                    labelFormatter={(n: any) => n}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-2 text-[11px] text-slate-500">
            Bands show regional quartiles (min–Q1, Q1–Q3, Q3–max). The vertical line is the regional median. The larger dot is the selected country.
          </div>
        </Card>
      )}

      {/* Charts: Country vs World (dual-series) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {INDICATORS.map(ind => {
          const bundle = series[ind.code]
          const merged = mergeCW(bundle)
          const lastCountry = (bundle?.country || []).filter(p => p.value !== null)
          const lastWorld = (bundle?.world || []).filter(p => p.value !== null)
          const lc = lastCountry.length ? lastCountry[lastCountry.length - 1] : undefined
          const lw = lastWorld.length ? lastWorld[lastWorld.length - 1] : undefined

          const rightNode = (
            <div className="text-xs text-slate-500">
              {bundle?.country ? (
                <>Country {trend(bundle.country)} {lc?.value !== null && lc ? <>· {lc.date}: {typeof lc.value === 'number' ? lc.value.toFixed(2) : '—'}</> : null}</>
              ) : null}
              {lw ? <> &nbsp;&nbsp;|&nbsp;&nbsp; World · {lw.date}: {typeof lw.value === 'number' ? lw.value.toFixed(2) : '—'}</> : null}
            </div>
          )

          return (
            <Card key={ind.code} title={ind.label} right={rightNode}>
              {!bundle ? (
                <Loading/>
              ) : (
                <div className="h-56 sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={merged}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{fontSize: 10}}/>
                      <YAxis domain={['auto','auto']} tick={{fontSize: 10}}/>
                      <Tooltip />
                      <Line type="monotone" dataKey="country" name="Country" dot={false} />
                      <Line type="monotone" dataKey="world" name="World" strokeDasharray="4 2" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
