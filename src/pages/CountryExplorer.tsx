
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
      <Card title="Country search" right={
        <input
          value={query}
          onChange={e=>setQuery(e.target.value)}
          className="rounded-lg border px-3 py-1 text-sm"
          placeholder="Try: Ukraine, Canada, China..."
        />
      }>
        {loading && <Loading/>}
        {country && (
          <div className="flex gap-4 items-start">
            {country.flags?.png && <img src={country.flags.png} className="w-16 h-10 object-cover rounded-md border" alt="flag" />}
            <div>
              <div className="text-xl font-semibold">{country.name.common}</div>
              <div className="grid md:grid-cols-2 gap-x-6 gap-y-1 mt-2 text-sm">
                {facts?.map(([k,v]) => (
                  <div key={k} className="flex">
                    <div className="w-40 text-slate-500">{k}</div>
                    <div className="font-medium">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {INDICATORS.map(ind => (
          <Card key={ind.code} title={ind.label}>
            {!series[ind.code] ? <Loading/> :
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series[ind.code]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{fontSize: 10}}/>
                  <YAxis domain={['auto','auto']} tick={{fontSize: 10}}/>
                  <Tooltip />
                  <Line type="monotone" dataKey="value" />
                </LineChart>
              </ResponsiveContainer>
            </div>}
          </Card>
        ))}
      </div>
    </div>
  )
}
