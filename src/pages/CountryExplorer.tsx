import { useEffect, useMemo, useState } from 'react'
import Card from '../components/Card'
import Loading from '../components/Loading'
import { searchCountryByName, Country } from '../services/restCountries'
import { wbGetCountryIndicator, wbGetGlobalIndicator, toSeries, WbPoint } from '../services/worldBank'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const INDICATORS = [
  { code: 'PV.EST', label: 'Political Stability (WGI, est.)' },
  { code: 'GE.EST', label: 'Government Effectiveness (WGI, est.)' },
  { code: 'CC.EST', label: 'Control of Corruption (WGI, est.)' },
  { code: 'NY.GDP.MKTP.KD.ZG', label: 'GDP Growth (annual %)' },
  { code: 'FP.CPI.TOTL.ZG', label: 'Inflation, CPI (annual %)' }
]

type SeriesBundle = {
  country: WbPoint[]
  world: WbPoint[]
}

export default function CountryExplorer() {
  const [query, setQuery] = useState('Canada')
  const [country, setCountry] = useState<Country | null>(null)
  const [series, setSeries] = useState<Record<string, SeriesBundle>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [regionalRows, setRegionalRows] = useState<{ name: string; value: number | null }[] | null>(null)
  const [neighbors, setNeighbors] = useState<string[] | null>(null)

  // fetch country, indicators (country + world), peers, neighbors
  useEffect(() => {
    (async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await searchCountryByName(query.trim())
        const pick = data[0]
        setCountry(pick || null)
        setNeighbors(null)
        setRegionalRows(null)

        if (pick?.cca3) {
          // country & world series for each indicator
          const [countrySets, worldSets] = await Promise.all([
            Promise.all(INDICATORS.map(ind => wbGetCountryIndicator(pick.cca3, ind.code, 30))),
            Promise.all(INDICATORS.map(ind => wbGetGlobalIndicator(ind.code, 30))),
          ])
          const mapped: Record<string, SeriesBundle> = {}
          for (let i = 0; i < INDICATORS.length; i++) {
            mapped[INDICATORS[i].code] = {
              country: toSeries(countrySets[i]),
              world: toSeries(worldSets[i]),
            }
          }
          setSeries(mapped)

          // neighbors (resolve border codes to names) — Country type doesn't declare 'borders', so read defensively
          const borderCodes = ((pick as any)?.borders as string[] | undefined) || []
          if (borderCodes.length) {
            try {
              const codes = borderCodes.join(',')
              const res = await fetch(`https://restcountries.com/v3.1/alpha?fields=name,cca3&codes=${encodeURIComponent(codes)}`)
              const js = await res.json() as { name: { common: string }, cca3: string }[]
              setNeighbors(js.map(x => x.name.common).sort())
            } catch { setNeighbors([]) }
          } else {
            setNeighbors([])
          }

          // regional comparator rows (Political Stability as default lens)
          if (pick.region) {
            try {
              const mates = await fetch(`https://restcountries.com/v3.1/region/${encodeURIComponent(pick.region)}?fields=name,cca3`)
                .then(r => r.json()) as { name:{common:string}, cca3:string }[]
              const latest = async (iso3: string) => {
                const s = toSeries(await wbGetCountryIndicator(iso3, 'PV.EST', 5))
                const len = s.length
                const v = len ? s[len - 1].value ?? null : null
                return v
              }
              const limited = mates.slice(0, 12)
              const rows = await Promise.all(limited.map(async m => ({ name: m.name.common, value: await latest(m.cca3) })))
              setRegionalRows(rows.filter(r => r.value !== null))
            } catch { setRegionalRows([]) }
          } else {
            setRegionalRows([])
          }
        } else {
          setSeries({})
        }
      } catch (e:any) {
        setError(e?.message || 'Lookup failed')
        setSeries({})
      } finally {
        setLoading(false)
      }
    })()
  }, [query])

  // facts table
  const facts = useMemo(() => {
    if (!country) return null
    return [
      ['Official name', country.name?.official],
      ['Region', country.region + (country.subregion ? ` — ${country.subregion}` : '')],
      ['Capital', (country.capital || ['—']).join(', ')],
      ['Population', country.population?.toLocaleString()],
      ['Area (km²)', country.area?.toLocaleString()],
      ['Currencies', country.currencies ? Object.values(country.currencies).map(c=>`${c.name} (${c.symbol||''})`).join(', ') : '—'],
      ['Languages', country.languages ? Object.values(country.languages).join(', ') : '—'],
      ['ISO2 / ISO3', `${country.cca2} / ${country.cca3}`],
    ]
  }, [country])

  // merge country+world by date for dual-series charts
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

  // simple trend arrow without using Array.prototype.at
  const trend = (arr: WbPoint[] | undefined) => {
    const vals = (arr || []).map(x => x.value).filter((v): v is number => v !== null)
    const len = vals.length
    if (len < 2) return '→'
    const d = vals[len - 1] - vals[len - 2]
    return d > 0 ? '↑' : d < 0 ? '↓' : '→'
  }

  return (
    <div className="space-y-6">
      {/* Search + facts */}
      <Card
        title="Country search"
        right={
          <div className="hidden md:block">
            <input
              value={query}
              onChange={e=>setQuery(e.target.value)}
              className="rounded-lg border px-3 py-1 text-sm w-72"
              placeholder="Try: Ukraine, Canada, China..."
            />
          </div>
        }
      >
        {/* Mobile input */}
        <div className="md:hidden mb-3">
          <input
            value={query}
            onChange={e=>setQuery(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Search a country..."
          />
        </div>

        {loading && <Loading/>}

        {country && (
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center min-w-0">
            {country.flags?.png && (
              <img
                src={country.flags.png}
                className="w-20 h-12 sm:w-24 sm:h-16 object-cover rounded-md border shrink-0"
                alt="flag"
                loading="lazy"
              />
            )}

            <div className="min-w-0 w-full">
              <div className="text-lg sm:text-xl font-semibold break-words">{country.name.common}</div>

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

              {/* Neighbors quick list */}
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

      {/* Regional Comparator (Political Stability vs region peers) */}
      {regionalRows && country?.name?.common && (
        <Card title={`Regional Comparator · Political Stability (WGI) — ${country.region}`}>
          {!regionalRows.length ? (
            <div className="text-sm text-slate-600">No regional data available.</div>
          ) : (
            <ul className="space-y-1.5">
              {(() => {
                const max = Math.max(...regionalRows.map(x => Number(x.value)))
                return regionalRows
                  .slice()
                  .sort((a,b)=>Number(b.value)-Number(a.value))
                  .map((r,i) => {
                    const pct = max > 0 ? (Number(r.value)/max)*100 : 0
                    const isFocus = r.name === country.name.common
                    return (
                      <li key={i} className="grid grid-cols-[1fr_auto] items-center gap-3">
                        <div className="h-2 rounded bg-slate-100">
                          <div
                            className={`h-2 rounded ${isFocus ? 'bg-slate-900' : 'bg-slate-600/80'}`}
                            style={{ width: `${pct}%` }}
                            title={`${r.name}: ${typeof r.value === 'number' ? r.value.toFixed(2) : r.value}`}
                          />
                        </div>
                        <div className={`text-xs w-32 text-right truncate ${isFocus ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                          {r.name}
                        </div>
                      </li>
                    )
                  })
              })()}
            </ul>
          )}
          <div className="mt-2 text-[11px] text-slate-500">
            Hint: The darker bar is the selected country. This frames a local situation inside its territorial cohort.
          </div>
        </Card>
      )}

      {/* Charts: Country vs World (dual-series). Card.title must be a string. */}
      <div className="grid grid-cols-1 md-grid-cols-2 md:grid-cols-2 gap-6">
        {INDICATORS.map(ind => {
          const bundle = series[ind.code]
          const merged = mergeCW(bundle)

          // latest values (avoid .at for older targets)
          const lastCountry = (bundle?.country || []).filter(p => p.value !== null)
          const lastWorld = (bundle?.world || []).filter(p => p.value !== null)
          const lc = lastCountry.length ? lastCountry[lastCountry.length - 1] : undefined
          const lw = lastWorld.length ? lastWorld[lastWorld.length - 1] : undefined

          const rightNode = (
            <div className="text-xs text-slate-500">
              {bundle?.country ? (
                <>
                  Country {trend(bundle.country)} {lc?.value !== null && lc ? <>· {lc.date}: {typeof lc.value === 'number' ? lc.value.toFixed(2) : '—'}</> : null}
                </>
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
