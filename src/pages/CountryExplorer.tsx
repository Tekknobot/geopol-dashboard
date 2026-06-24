import { useEffect, useMemo, useRef, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import Card from '../components/Card'
import Loading from '../components/Loading'
import { getAllCountries, searchCountryByName, Country } from '../services/restCountries'
import { wbGetCountryIndicator, wbGetCountryIndicatorSeries, wbGetGlobalIndicatorSeries, toSeries, hasNumericPoints, latestNonNull, WbPoint } from '../services/worldBank'
import { getLatestReports, reliefWebCategory, reliefWebCountry, reliefWebSource, type ReliefWebItem } from '../services/reliefweb'
import { normalizeExternalUrl } from '../utils/links'
import { proxyUrl } from '../services/apiBases'

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

function flagEmoji(cca2?: string) {
  if (!cca2 || cca2.length !== 2) return '🏳️'
  return cca2
    .toUpperCase()
    .replace(/./g, char => String.fromCodePoint(127397 + char.charCodeAt(0)))
}

function countryFlagSrc(country: Country | null) {
  return country?.flags?.svg || country?.flags?.png || ''
}

function countrySearchText(country: Country) {
  return [
    country.name?.common,
    country.name?.official,
    country.cca2,
    country.cca3,
    country.region,
    country.subregion,
    ...(country.capital || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function filterCountries(countries: Country[], query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return countries
  return countries.filter(country => countrySearchText(country).includes(q))
}

function SearchSuggestions({ suggestions, choose, allCount, query }: { suggestions: Country[]; choose: (c: Country) => void; allCount: number; query: string }) {
  if (!suggestions.length) return null
  const showingFullList = !query.trim()
  return (
    <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <span>{showingFullList ? 'Flag navigator' : 'Flag matches'}</span>
        <span>{suggestions.length}{allCount ? ` / ${allCount}` : ''}</span>
      </div>
      <div className="max-h-[22rem] overflow-y-auto p-3">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
          {suggestions.map(s => (
            <button
              key={s.cca3 || s.name.common}
              type="button"
              title={`${s.name?.common || s.cca3} · ${s.region || 'Region unavailable'}${s.subregion ? ` · ${s.subregion}` : ''}`}
              className="group flex min-h-[96px] flex-col items-center justify-between rounded-2xl border border-slate-200 bg-white p-2 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-slate-200"
              onMouseDown={e => e.preventDefault()}
              onClick={() => choose(s)}
            >
              {countryFlagSrc(s) ? (
                <img src={countryFlagSrc(s)} alt="" className="h-9 w-14 rounded-md object-cover ring-1 ring-slate-200" loading="lazy" />
              ) : (
                <span className="flex h-9 w-14 items-center justify-center rounded-md bg-slate-100 text-2xl ring-1 ring-slate-200">{flagEmoji(s.cca2)}</span>
              )}
              <span className="mt-2 line-clamp-2 min-h-[2rem] text-xs font-semibold leading-tight text-slate-900">{s.name?.common}</span>
              <span className="mt-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200">{s.cca3}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
        Scroll the flag grid, or keep typing to narrow the country list.
      </div>
    </div>
  )
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
  const res = await fetch(proxyUrl('worldbank', '/v2/country', { format: 'json', per_page: 1000 }))
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
  const [allCountries, setAllCountries] = useState<Country[]>([])
  const [suggestions, setSuggestions] = useState<Country[]>([])
  const [searchingCountries, setSearchingCountries] = useState(false)
  const [countrySearchTouched, setCountrySearchTouched] = useState(false)
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false)
  const [selected, setSelected] = useState<Country | null>(null)

  const [series, setSeries] = useState<Record<string, SeriesBundle>>({})
  const [regionalRows, setRegionalRows] = useState<RegionalRow[] | null>(null)
  const [neighbors, setNeighbors] = useState<string[] | null>(null)
  const [reports, setReports] = useState<ReliefWebItem[]>([])
  const [reportsLoaded, setReportsLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadIdRef = useRef(0)
  const seriesCacheRef = useRef<Map<string, Record<string, SeriesBundle>>>(new Map())

  useEffect(() => {
    let alive = true
    ;(async () => {
      setSearchingCountries(true)
      try {
        const countries = await getAllCountries()
        if (!alive) return
        setAllCountries(countries)
        setSuggestions(filterCountries(countries, input))
      } catch {
        if (alive) setAllCountries([])
      } finally {
        if (alive) setSearchingCountries(false)
      }
    })()
    return () => { alive = false }
  }, [])

  useEffect(() => {
    let alive = true
    const timer = window.setTimeout(async () => {
      const query = input.trim()

      if (allCountries.length) {
        if (alive) setSuggestions(filterCountries(allCountries, query))
        return
      }

      if (!query) {
        if (alive) {
          setSuggestions([])
          setSearchingCountries(false)
        }
        return
      }

      if (alive) setSearchingCountries(true)
      try {
        const res = await searchCountryByName(query)
        if (alive) setSuggestions(res)
      } catch {
        if (alive) setSuggestions([])
      } finally {
        if (alive) setSearchingCountries(false)
      }
    }, 150)

    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [input, allCountries])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const latest = await getLatestReports(500)
        if (alive) setReports(latest)
      } catch {
        if (alive) setReports([])
      } finally {
        if (alive) setReportsLoaded(true)
      }
    })()
    return () => { alive = false }
  }, [])

  const choose = (c: Country) => {
    setSelected(c)
    setInput(c.name?.common || c.cca3 || '')
    setSuggestions([])
    setCountryDropdownOpen(false)
    void loadCountry(c)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (suggestions.length) choose(suggestions[0])
    }
  }

  const loadRegionalRows = async (c: Country, myLoadId: number) => {
    const selISO3 = c.cca3
    if (!c.region) {
      if (myLoadId === loadIdRef.current) setRegionalRows([])
      return
    }

    try {
      const wbCountries = await fetchWbCountryMeta()
      const selMeta = wbCountries.find(x => x.id === selISO3)
      const regionId = selMeta?.region?.id
      const regionIds = regionId ? [regionId] : mapRestRegionToWb(c.region)

      const allCandidates = wbCountries
        .filter(cc => regionIds.includes(cc.region.id))
        .map(cc => ({ name: cc.name, iso3: cc.id }))
        .filter(cc => /^[A-Z]{3}$/.test(cc.iso3))

      // Keep the comparator responsive. The old page waited on every country in a region,
      // which could leave Explorer looking like it was loading forever on slower API responses.
      const focus = allCandidates.find(x => x.iso3 === selISO3) || { name: c.name?.common || selISO3, iso3: selISO3 }
      const candidates = [
        focus,
        ...allCandidates.filter(x => x.iso3 !== selISO3).slice(0, 23),
      ]

      const settled = await Promise.allSettled(
        candidates.map(async cand => {
          const v = await latestNonNullValue(cand.iso3, 'PV.EST', 20)
          return { name: cand.name, iso3: cand.iso3, value: v, isFocus: cand.iso3 === selISO3 } as RegionalRow
        })
      )

      const rows = settled
        .filter((x): x is PromiseFulfilledResult<RegionalRow> => x.status === 'fulfilled')
        .map(x => x.value)

      const withData = rows.filter(r => r.value !== null)
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
        const indicatorResults = await Promise.allSettled(
          INDICATORS.map(async ind => {
            const [country, world] = await Promise.allSettled([
              wbGetCountryIndicatorSeries(iso3, ind.code),
              wbGetGlobalIndicatorSeries(ind.code),
            ])
            return {
              code: ind.code,
              country: country.status === 'fulfilled' ? country.value : [],
              world: world.status === 'fulfilled' ? world.value : [],
            }
          })
        )

        const m: Record<string, SeriesBundle> = {}
        for (const result of indicatorResults) {
          if (result.status === 'fulfilled') {
            m[result.value.code] = {
              country: result.value.country,
              world: result.value.world,
            }
          }
        }
        for (const ind of INDICATORS) {
          if (!m[ind.code]) m[ind.code] = { country: [], world: [] }
        }
        mapped = m
        seriesCacheRef.current.set(iso3, m)
      }

      if (myLoadId === loadIdRef.current) {
        setSeries(mapped)
        setLoading(false)
      }

      const borderCodes = ((c as any)?.borders as string[] | undefined) || []
      if (borderCodes.length) {
        try {
          const res = await fetch(proxyUrl('restcountries', '/v3.1/alpha', { fields: 'name,cca3', codes: borderCodes.join(',') }))
          const js = await res.json() as { name: { common: string }, cca3: string }[]
          if (myLoadId === loadIdRef.current) setNeighbors(js.map(x => x.name.common).sort())
        } catch { if (myLoadId === loadIdRef.current) setNeighbors([]) }
      } else {
        if (myLoadId === loadIdRef.current) setNeighbors([])
      }

      void loadRegionalRows(c, myLoadId)
    } catch (e: any) {
      if (myLoadId === loadIdRef.current) {
        setError(e?.message || 'Lookup failed')
        setLoading(false)
      }
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
        right={selected ? <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 md:inline-flex">{flagEmoji(selected.cca2)} {selected.cca3}</span> : undefined}
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="relative">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Explore a country</label>
            <div className="relative">
              <input
                value={input}
                onChange={e => { setInput(e.target.value); setCountrySearchTouched(true); setCountryDropdownOpen(true) }}
                onFocus={() => { setCountrySearchTouched(true); setCountryDropdownOpen(true); if (allCountries.length) setSuggestions(filterCountries(allCountries, input)) }}
                onBlur={() => window.setTimeout(() => setCountryDropdownOpen(false), 120)}
                onKeyDown={onKeyDown}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-24 text-sm shadow-sm outline-none ring-slate-300 transition focus:ring-4"
                placeholder="Search Canada, Ukraine, Sri Lanka, Palestine…"
              />
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center gap-2 text-xs text-slate-400">
                {searchingCountries ? 'Loading…' : countryDropdownOpen ? 'Scroll list' : 'Enter ↵'}
              </div>
            </div>
            {countryDropdownOpen && <SearchSuggestions suggestions={suggestions} choose={choose} allCount={allCountries.length} query={input} />}
            {countrySearchTouched && countryDropdownOpen && input.trim() && !searchingCountries && suggestions.length === 0 && (
              <div className="absolute z-20 mt-2 w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow">
                No country match yet. Try a common name like “United States” or “Congo”.
              </div>
            )}
          </div>

          {selected && (
            <div className="hidden min-w-[220px] rounded-2xl border border-slate-200 bg-slate-50 p-3 lg:block">
              <div className="flex items-center gap-3">
                {countryFlagSrc(selected) ? (
                  <img src={countryFlagSrc(selected)} className="h-11 w-16 rounded object-cover ring-1 ring-slate-200" alt={`${selected.name.common} flag`} loading="lazy" />
                ) : (
                  <span className="text-3xl">{flagEmoji(selected.cca2)}</span>
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">{selected.name.common}</div>
                  <div className="truncate text-xs text-slate-500">{selected.region}{selected.subregion ? ` · ${selected.subregion}` : ''}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {loading && <Loading />}

        {selected && (
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center min-w-0">
            {countryFlagSrc(selected) ? (
              <img src={countryFlagSrc(selected)} className="w-24 h-16 sm:w-28 sm:h-20 object-cover rounded-xl border shadow-sm shrink-0" alt={`${selected.name.common} flag`} loading="lazy" />
            ) : (
              <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-xl border bg-slate-50 text-4xl shadow-sm">{flagEmoji(selected.cca2)}</div>
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
          {!reportsLoaded ? <Loading label="Loading recent reports…" /> : countryReports.length === 0 ? (
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
