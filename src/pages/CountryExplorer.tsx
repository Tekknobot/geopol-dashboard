import { useEffect, useMemo, useState } from 'react'
import Card from '../components/Card'
import Loading from '../components/Loading'
import { searchCountryByName, Country } from '../services/restCountries'
import { wbGetCountryIndicator, toSeries, WbPoint } from '../services/worldBank'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const INDICATORS = [
  { code: 'PV.EST', label: 'Political Stability (WGI, est.)' },
  { code: 'GE.EST', label: 'Government Effectiveness (WGI, est.)' },
  { code: 'CC.EST', label: 'Control of Corruption (WGI, est.)' },
  { code: 'NY.GDP.MKTP.KD.ZG', label: 'GDP Growth (annual %)' },
  { code: 'FP.CPI.TOTL.ZG', label: 'Inflation, CPI (annual %)' }
]

export default function CountryExplorer() {
  const [query, setQuery] = useState('Canada')
  const [country, setCountry] = useState<Country | null>(null)
  const [series, setSeries] = useState<Record<string, WbPoint[]>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const iso3 = country?.cca3?.toLowerCase()

  useEffect(() => {
    (async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await searchCountryByName(query)
        const pick = data[0]
        setCountry(pick)
        if (pick?.cca3) {
          const results = await Promise.all(INDICATORS.map(ind => wbGetCountryIndicator(pick.cca3, ind.code, 30)))
          const mapped: Record<string, WbPoint[]> = {}
          for (let i=0;i<INDICATORS.length;i++) {
            mapped[INDICATORS[i].code] = toSeries(results[i])
          }
          setSeries(mapped)
        } else {
          setSeries({})
        }
      } catch (e:any) {
        setError(e?.message || 'Lookup failed')
      } finally {
        setLoading(false)
      }
    })()
  }, [query])

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

  return (
    <div className="space-y-6">
      {/* Desktop header input stays in the Card header; on mobile we show an in-body input (below) */}
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
        {/* Mobile input: full width and stacked */}
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

              {/* On mobile use 1 column; from sm+ use 2 columns. Allow wrapping of long values */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mt-3 text-sm">
                {facts?.map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
                      <div className="text-slate-500 sm:w-44">{k}</div>
                      <div className="font-medium break-words">{v}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
      </Card>

      {/* Charts: keep as-is; they already scale with ResponsiveContainer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {INDICATORS.map(ind => (
          <Card key={ind.code} title={ind.label}>
            {!series[ind.code] ? (
              <Loading/>
            ) : (
              <div className="h-56 sm:h-64"> {/* slightly shorter on mobile to avoid vertical cram */}
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series[ind.code]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{fontSize: 10}}/>
                    <YAxis domain={['auto','auto']} tick={{fontSize: 10}}/>
                    <Tooltip />
                    <Line type="monotone" dataKey="value" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
