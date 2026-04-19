import { useEffect, useMemo, useRef, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import Card from '../components/Card'
import Loading from '../components/Loading'
import { searchCountryByName, Country } from '../services/restCountries'
import { wbGetCountryIndicator, wbGetCountryIndicatorSeries, wbGetGlobalIndicatorSeries, toSeries, hasNumericPoints, latestNonNull, WbPoint } from '../services/worldBank'
import { getLatestReports, reliefWebCategory, reliefWebCountry, reliefWebSource, type ReliefWebItem } from '../services/reliefweb'
import { normalizeExternalUrl } from '../utils/links'

const INDICATORS = [
  { code: 'PV.EST', label: 'Political Stability (WGI, est.)' },
  { code: 'GE.EST', label: 'Government Effectiveness (WGI, est.)' },
  { code: 'CC.EST', label: 'Control of Corruption (WGI, est.)' },
  { code: 'NY.GDP.MKTP.KD.ZG', label: 'GDP Growth (annual %)' },
  { code: 'FP.CPI.TOTL.ZG', label: 'Inflation, CPI (annual %)' },
]

type SeriesBundle = { country: WbPoint[]; world: WbPoint[] }
type WbCountryMeta = { id: string; name: string; region: { id: string; value: string } }
type RegionalRow = { name: string; value: number | null; iso3: string; isFocus?: boolean }

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
    case 'Americas': return ['NAC', 'LCN']
    case 'Asia': return ['EAS', 'SAS', 'MEA']
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
    region: { id: d.region?.id, value: d.region?.value },
  }))
}

async function latestNonNullValue(iso3: string, indicator: string, years = 20): Promise<number | null> {
  const s = toSeries(await wbGetCountryIndicator(iso3, indicator, years))
  for (let i = s.length - 1; i >= 0; i--) {
    const v = s[i].value
    if (typeof v === 'number') return v
  }
  return null
}

function IndicatorFallback({ label, bundle }: { label: string; bundle?: SeriesBundle }) {
  const countryLatest = latestNonNull(bundle?.country || [])
  const worldLatest = latestNonNull(bundle?.world || [])
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4">
      <div className="text-sm font-medium text-slate-800">{label}</div>
      <p className="mt-2 text-xs leading-5 text-slate-600">
        The time-series for this indicator is missing from the current World Bank response.
        Showing the latest available snapshot instead of an empty chart.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-xl border bg-white px-3 py-2 text-sm">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Country</div>
          <div className="mt-1 font-semibold text-slate-900">{countryLatest ? `${countryLatest.value.toFixed(2)} · ${countryLatest.date}` : 'Unavailable'}</div>
        </div>
        <div className="rounded-xl border bg-white px-3 py-2 text-sm">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">World</div>
          <div className="mt-1 font-semibold text-slate-900">{worldLatest ? `${worldLatest.value.toFixed(2)} · ${worldLatest.date}` : 'Unavailable'}</div>
        </div>
      </div>
    </div>
  )
}

export default function CountryExplorer() {
  const [input, setInput] = useState('Canada')
  const [suggestions, setSuggestions] = useState<Country[]>([])
  const [selected, setSelected] = useState<Country | null>(null)

  const [series, setSeries] = useState<Record<string, SeriesBundle>>({})
  const [regionalRows, setRegionalRows] = useState<RegionalRow[] | null>(null)
  const [neighbors, setNeighbors] = useState<string[] | null>(null)
  const [reports, setReports] = useState<ReliefWebItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadIdRef = useRef(0)
  const seriesCacheRef = useRef<Map<string, Record<string, SeriesBundle>>>(new Map())

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

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const latest = await getLatestReports(500)
        if (alive) setReports(latest)
      } catch {}
    })()
    return () => { alive = false }
  }, [])

  const choose = (c: Country) => {
    setSelected(c)
    setInput(c.name?.common || c.cca3 || '')
    void loadCountry(c)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (suggestions.length) choose(suggestions[0])
    }
  }

  const loadCountry = async (c: Country) => {
    const iso3 = c.cca3
    setError(null)
    setNeighbors(null)
    setRegionalRows(null)
    setSeries({})
    setLoading(true)
    const myLoadId = ++loadIdRef.current

    try {
      const cached = seriesCacheRef.current.get(iso3)
      let mapped: Record<string, SeriesBundle> | null = cached || null

      if (!mapped) {
        const [countrySets, worldSets] = await Promise.all([
          Promise.all(INDICATORS.map(ind => wbGetCountryIndicatorSeries(iso3, ind.code))),
          Promise.all(INDICATORS.map(ind => wbGetGlobalIndicatorSeries(ind.code))),
        ])
        const m: Record<string, SeriesBundle> = {}
        for (let i = 0; i < INDICATORS.length; i++) {
          m[INDICATORS[i].code] = {
            country: countrySets[i],
            world: worldSets[i],
          }
        }
        mapped = m
        seriesCacheRef.current.set(iso3, m)
      }

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

          if (!candidates.some(x => x.iso3 === selISO3)) {
            candidates.push({ name: c.name?.common || selISO3, iso3: selISO3 })
          }

          const rows = await Promise.all(
            candidates.map(async cand => {
              const v = await latestNonNullValue(cand.iso3, 'PV.EST', 20)
              return { name: cand.name, iso3: cand.iso3, value: v, isFocus: cand.iso3 === selISO3 } as RegionalRow
            })
          )

          const withData = rows.filter(r => r.value !== null) as RegionalRow[]
          withData.sort((a, b) => (b.value as number) - (a.value as number))
          let top = withData.slice(0, 20)
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

  useEffect(() => {
    if (!selected && input) {
      ;(async () => {
        try {
          const res = await searchCountryByName(input.trim())
          if (res[0]) {
            setSelected(res[0])
            await loadCountry(res[0])
          }
        } catch {}
      })()
    }
  }, [])

  const facts = useMemo(() => {
    if (!selected) return null
    return [
      ['Official name', selected.name?.official],
      ['Region', selected.region + (selected.subregion ? ` — ${selected.subregion}` : '')],
      ['Capital', (selected.capital || ['—']).join(', ')],
      ['Population', selected.population?.toLocaleString()],
      ['Area (km²)', selected.area?.toLocaleString()],
      ['Currencies', selected.currencies ? Object.values(selected.currencies).map(c => `${c.name} (${c.symbol || ''})`).join(', ') : '—'],
      ['Languages', selected.languages ? Object.values(selected.languages).join(', ') : '—'],
      ['ISO2 / ISO3', `${selected.cca2} / ${selected.cca3}`],
    ]
  }, [selected])

  const mergeCW = (bund: SeriesBundle | undefined) => {
    if (!bund) return []
    const map = new Map<string, any>()
    bund.world.forEach(p => map.set(p.date, { date: p.date, world: p.value }))
    bund.country.forEach(p => {
      const row = map.get(p.date) || { date: p.date }
      row.country = p.value
      map.set(p.date, row)
    })
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
  }

  const trend = (arr: WbPoint[] | undefined) => {
    const vals = (arr || []).map(x => x.value).filter((v): v is number => v !== null)
    const len = vals.length
    if (len < 2) return '→'
    const d = vals[len - 1] - vals[len - 2]
    return d > 0 ? '↑' : d < 0 ? '↓' : '→'
  }

  const comparatorStats = useMemo(() => {
    const vals = (regionalRows || []).map(r => r.value).filter((v): v is number => v !== null).sort((a, b) => a - b)
    if (!vals.length) return { min: 0, med: 0, max: 0 }
    const q = (p: number) => {
      const pos = (vals.length - 1) * p
      const base = Math.floor(pos)
      const rest = pos - base
      return vals[base] + (vals[base + 1] !== undefined ? rest * (vals[base + 1] - vals[base]) : 0)
    }
    return { min: vals[0], med: q(0.5), max: vals[vals.length - 1] }
  }, [regionalRows])

  const pct = (val: number | null) => {
    if (val === null) return 0
    const { min, max } = comparatorStats
    if (max === min) return 50
    return ((val - min) / (max - min)) * 100
  }
  const medPct = pct(comparatorStats.med)

  const [countrySpecificReports, setCountrySpecificReports] = useState<ReliefWebItem[]>([])

  useEffect(() => {
    let alive = true

    ;(async () => {
      if (!selected) {
        setCountrySpecificReports([])
        return
      }

      try {
        // Use latest global reports
        const latest = await getLatestReports(1000)

        const common = selected.name.common.toLowerCase()
        const official = selected.name.official?.toLowerCase() || ''

        const filtered = latest.filter(r => {
          const country = (reliefWebCountry(r) || '').toLowerCase()

          return (
            country === common ||
            country === official ||
            country.includes(common) ||
            common.includes(country)
          )
        })

        if (alive) {
          setCountrySpecificReports(
            filtered
              .sort(
                (a, b) =>
                  Date.parse(b.fields.date.created) -
                  Date.parse(a.fields.date.created)
              )
              .slice(0, 40)
          )
        }

      } catch {
        if (alive) setCountrySpecificReports([])
      }
    })()

    return () => { alive = false }

  }, [selected?.cca3])
  
  const countryReports = useMemo(() => {
    if (countrySpecificReports.length) {
      return countrySpecificReports
        .sort((a, b) => Date.parse(b.fields.date.created) - Date.parse(a.fields.date.created))
        .slice(0, 18)
    }
    if (!selected) return []
    const common = selected.name.common.toLowerCase()
    const official = selected.name.official?.toLowerCase() || ''
    return reports
      .filter(r => {
        const country = (reliefWebCountry(r) || '').toLowerCase()
        return country === common || country === official || country.includes(common) || common.includes(country)
      })
      .sort((a, b) => Date.parse(b.fields.date.created) - Date.parse(a.fields.date.created))
      .slice(0, 18)
  }, [countrySpecificReports, reports, selected])

  const countryTrackerCards = useMemo(() => {
    const corruption = countryReports.filter(r => reliefWebCategory(r) === 'Governance/Corruption').length
    const conflict = countryReports.filter(r => reliefWebCategory(r) === 'Conflict/Insecurity').length
    const displacement = countryReports.filter(r => reliefWebCategory(r) === 'Displacement').length
    const outbreaks = countryReports.filter(r => reliefWebCategory(r) === 'Health/Outbreak').length
    const food = countryReports.filter(r => reliefWebCategory(r) === 'Food Security').length
    const pv = series['PV.EST']?.country?.filter(p => p.value !== null).slice(-1)[0]?.value ?? null
    const ge = series['GE.EST']?.country?.filter(p => p.value !== null).slice(-1)[0]?.value ?? null
    const cc = series['CC.EST']?.country?.filter(p => p.value !== null).slice(-1)[0]?.value ?? null
    const gdp = series['NY.GDP.MKTP.KD.ZG']?.country?.filter(p => p.value !== null).slice(-1)[0]?.value ?? null
    const cpi = series['FP.CPI.TOTL.ZG']?.country?.filter(p => p.value !== null).slice(-1)[0]?.value ?? null
    return [
      {
        title: 'Volatility',
        value: countryReports.length > 0 ? String(countryReports.length) : (pv != null ? pv.toFixed(2) : '—'),
        note: countryReports.length > 0 ? 'Live ReliefWeb report count in the current 24-hour window.' : 'Backfilled with World Bank political stability estimate.',
        source: countryReports.length > 0 ? 'ReliefWeb' : 'World Bank',
      },
      {
        title: 'Conflict / Insecurity',
        value: String(conflict),
        note: 'Conflict and insecurity-related ReliefWeb reporting.',
        source: 'ReliefWeb',
      },
      {
        title: 'Governance effectiveness',
        value: ge != null ? ge.toFixed(2) : '—',
        note: 'World Bank governance effectiveness estimate.',
        source: 'World Bank',
      },
      {
        title: 'Corruption control',
        value: corruption > 0 ? String(corruption) : (cc != null ? cc.toFixed(2) : '—'),
        note: corruption > 0 ? 'Live governance / corruption reporting in ReliefWeb.' : 'Backfilled with World Bank control-of-corruption estimate.',
        source: corruption > 0 ? 'ReliefWeb' : 'World Bank',
      },
      {
        title: 'Economic stress',
        value: cpi != null ? `${cpi.toFixed(1)}%` : '—',
        note: 'Latest available World Bank CPI inflation reading.',
        source: 'World Bank',
      },
      {
        title: 'Humanitarian pressure',
        value: String(displacement + outbreaks + food),
        note: 'Combined displacement, outbreak, and food-security ReliefWeb reports.',
        source: 'ReliefWeb',
      },
      {
        title: 'GDP growth',
        value: gdp != null ? `${gdp.toFixed(1)}%` : '—',
        note: 'Latest available World Bank GDP growth reading.',
        source: 'World Bank',
      },
    ]
  }, [countryReports, series])

  return (
    <div className="space-y-6">
      <Card
        title="Country search"
        right={
          <div className="hidden md:block relative">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              className="rounded-lg border px-3 py-1 text-sm w-72"
              placeholder="Type to search…"
            />
            {suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-72 max-h-64 overflow-auto rounded-lg border bg-white shadow">
                {suggestions.map(s => (
                  <li key={s.cca3} className="cursor-pointer px-3 py-2 text-sm hover:bg-slate-50" onClick={() => choose(s)}>
                    {s.name?.common} <span className="text-slate-500">({s.region}{s.subregion ? ` — ${s.subregion}` : ''})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        }
      >
        <div className="md:hidden mb-3 relative">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Search a country…"
          />
          {suggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full max-h-64 overflow-auto rounded-lg border bg-white shadow">
              {suggestions.map(s => (
                <li key={s.cca3} className="cursor-pointer px-3 py-2 text-sm hover:bg-slate-50" onClick={() => choose(s)}>
                  {s.name?.common} <span className="text-slate-500">({s.region}{s.subregion ? ` — ${s.subregion}` : ''})</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {loading && <Loading />}

        {selected && (
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center min-w-0">
            {selected.flags?.png && (
              <img src={selected.flags.png} className="w-20 h-12 sm:w-24 sm:h-16 object-cover rounded-md border shrink-0" alt="flag" loading="lazy" />
            )}
            <div className="min-w-0 w-full">
              <div className="text-lg sm:text-xl font-semibold break-words">{selected.name.common}</div>
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
              {neighbors && (
                <div className="mt-3 text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">Neighbors:</span> {neighbors.length ? neighbors.join(', ') : '—'}
                </div>
              )}
            </div>
          </div>
        )}

        {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
      </Card>

      {selected && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {countryTrackerCards.map(card => (
            <Card key={card.title} title={card.title}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-3xl font-semibold tracking-tight">{card.value}</div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700 ring-1 ring-slate-200">{card.source}</span>
              </div>
              <p className="mt-2 text-xs text-slate-600">{card.note}</p>
            </Card>
          ))}
        </div>
      )}

      {regionalRows && selected?.name?.common && (
        <Card title={`Regional Comparator · Political Stability (WGI) — ${selected.region}`}>
          {!regionalRows.length ? (
            <div className="text-sm text-slate-600">No regional data available.</div>
          ) : (
            <ul className="space-y-2">
              {regionalRows.map((r, i) => {
                const isFocus = r.iso3 === selected.cca3
                const hasData = typeof r.value === 'number'
                const placeholderPct = 30
                const widthPct = hasData ? Math.max(0, Math.min(100, pct(r.value!))) : placeholderPct
                return (
                  <li key={i} className="grid grid-cols-[160px_1fr_56px] items-center gap-3">
                    <div className={`text-xs truncate ${isFocus ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                      {r.name}{!hasData ? ' (no data)' : ''}
                    </div>
                    <div className="relative h-3 rounded bg-slate-100">
                      <div className={`absolute left-0 top-0 h-3 rounded ${isFocus ? 'bg-slate-900' : 'bg-slate-600/80'} ${!hasData ? 'opacity-40' : ''}`} style={{ width: `${widthPct}%` }} />
                      <div className="absolute top-[-2px] w-0.5 h-4 bg-slate-400/80" style={{ left: `${medPct}%` }} />
                    </div>
                    <div className="text-xs text-right tabular-nums text-slate-600">{hasData ? Number(r.value).toFixed(2) : '—'}</div>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="mt-2 text-[11px] text-slate-500">Bars show country scores; the thin tick marks the regional median.</div>
        </Card>
      )}

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
              {bundle?.country ? <>Country {trend(bundle.country)} {lc?.value !== null && lc ? <>· {lc.date}: {typeof lc.value === 'number' ? lc.value.toFixed(2) : '—'}</> : null}</> : null}
              {lw ? <> &nbsp;&nbsp;|&nbsp;&nbsp; World · {lw.date}: {typeof lw.value === 'number' ? lw.value.toFixed(2) : '—'}</> : null}
            </div>
          )

          const hasCountry = hasNumericPoints(bundle?.country || [])
          const hasWorld = hasNumericPoints(bundle?.world || [])

          return (
            <Card key={ind.code} title={ind.label} right={rightNode}>
              {!bundle ? <Loading /> : (!hasCountry && !hasWorld) ? (
                <IndicatorFallback label={ind.label} bundle={bundle} />
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
                    <span className={`rounded-full px-2 py-0.5 ring-1 ${hasCountry ? 'bg-slate-100 ring-slate-200' : 'bg-amber-50 text-amber-800 ring-amber-200'}`}>
                      {hasCountry ? 'Country series loaded' : 'Country fallback only'}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 ring-1 ${hasWorld ? 'bg-slate-100 ring-slate-200' : 'bg-amber-50 text-amber-800 ring-amber-200'}`}>
                      {hasWorld ? 'World series loaded' : 'World comparison missing'}
                    </span>
                  </div>
                  <div className="h-56 sm:h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={merged}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        {hasCountry && <Line type="monotone" dataKey="country" name="Country" dot={false} />}
                        {hasWorld && <Line type="monotone" dataKey="world" name="World" strokeDasharray="4 2" dot={false} />}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  {(!hasCountry || !hasWorld) && (
                    <div className="grid grid-cols-1 gap-2 text-xs text-slate-600 sm:grid-cols-2">
                      <div className="rounded-xl bg-slate-50 px-3 py-2">
                        Latest country value: {lc && typeof lc.value === 'number' ? `${lc.value.toFixed(2)} (${lc.date})` : 'unavailable'}
                      </div>
                      <div className="rounded-xl bg-slate-50 px-3 py-2">
                        Latest world value: {lw && typeof lw.value === 'number' ? `${lw.value.toFixed(2)} (${lw.date})` : 'unavailable'}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {selected && (
        <Card title={`ReliefWeb reports · ${selected.name.common}`} right={<span className="text-xs text-slate-500">Links open the source article</span>}>
          {!reports.length ? <Loading label="Loading recent reports…" /> : countryReports.length === 0 ? (
            <div className="text-sm text-slate-600">No mapped ReliefWeb reports were found for this country in the current 24-hour report window.</div>
          ) : (
            <ul className="divide-y">
              {countryReports.map(report => (
                <li key={String(report.id)} className="py-3">
                  <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700 ring-1 ring-slate-200 mb-1">
                    {reliefWebCategory(report)}
                  </span>
                  <a href={normalizeExternalUrl(report.fields.url)} target="_blank" rel="noreferrer" className="block text-[15px] md:text-[17px] font-semibold leading-snug hover:underline">
                    {report.fields.title}
                  </a>
                  <div className="mt-1 text-[11px] text-slate-600">
                    {reliefWebSource(report.fields.url)} · {new Date(report.fields.date.created).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  )
}
