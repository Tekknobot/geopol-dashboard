import { useEffect, useMemo, useState } from 'react'
import Card from './Card'
import { searchCountryByName, type Country } from '../services/restCountries'
import { wbGetCountryIndicator, wbGetGlobalIndicator, toSeries, type WbPoint } from '../services/worldBank'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

type Props = {
  countryName?: string  // plain name like "Bangladesh" or "Chile"
  onClose: () => void
}

const INDICATORS = [
  { code: 'PV.EST', label: 'Political Stability (WGI est.)' },
  { code: 'GE.EST', label: 'Government Effectiveness (WGI est.)' },
  { code: 'NY.GDP.MKTP.KD.ZG', label: 'GDP Growth (annual %)' },
  { code: 'FP.CPI.TOTL.ZG', label: 'Inflation, CPI (annual %)' },
]

function SeriesChart({ country, world, indicatorLabel }: { country: WbPoint[]; world: WbPoint[]; indicatorLabel: string }) {
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
    <div className="h-48">
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
      <div className="mt-1 text-xs text-slate-600">{indicatorLabel}</div>
    </div>
  )
}

export default function ContextSidebar({ countryName, onClose }: Props) {
  const [country, setCountry] = useState<Country | null>(null)
  const [series, setSeries] = useState<Record<string, WbPoint[]>>({})
  const [world, setWorld] = useState<Record<string, WbPoint[]>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!countryName) return
    (async () => {
      setLoading(true)
      try {
        const [match] = await searchCountryByName(countryName)
        if (!match) return
        setCountry(match)
        const iso3 = match.cca3
        const countryData = Object.fromEntries(
          await Promise.all(INDICATORS.map(async x => [x.code, toSeries(await wbGetCountryIndicator(iso3, x.code, 30))]))
        )
        const worldData = Object.fromEntries(
          await Promise.all(INDICATORS.map(async x => [x.code, toSeries(await wbGetGlobalIndicator(x.code, 30))]))
        )
        setSeries(countryData)
        setWorld(worldData)
      } finally {
        setLoading(false)
      }
    })()
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
              {INDICATORS.map(x => (
                <SeriesChart key={x.code} indicatorLabel={x.label} country={series[x.code] ?? []} world={world[x.code] ?? []} />
              ))}
            </div>
          }
        </Card>
      </div>
    </aside>
  )
}
