import { useEffect, useMemo, useState } from 'react'
import Card from './Card'
import { searchCountryByName, type Country } from '../services/restCountries'
import {
  wbGetCountryIndicatorSeries,
  wbGetGlobalIndicatorSeries,
  latestNonNull,
  hasNumericPoints,
  type WbPoint,
} from '../services/worldBank'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

type Props = {
  countryName?: string
  onClose: () => void
}

const INDICATORS = [
  { code: 'PV.EST', label: 'Political Stability (WGI est.)' },
  { code: 'GE.EST', label: 'Government Effectiveness (WGI est.)' },
  { code: 'CC.EST', label: 'Control of Corruption (WGI est.)' },
  { code: 'NY.GDP.MKTP.KD.ZG', label: 'GDP Growth (annual %)' },
  { code: 'FP.CPI.TOTL.ZG', label: 'Inflation, CPI (annual %)' },
]

function EmptyChartState({
  indicatorLabel,
  countryLatest,
  worldLatest,
}: {
  indicatorLabel: string
  countryLatest: ReturnType<typeof latestNonNull>
  worldLatest: ReturnType<typeof latestNonNull>
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4">
      <div className="text-sm font-medium text-slate-800">{indicatorLabel}</div>
      <p className="mt-2 text-xs leading-5 text-slate-600">
        This chart is blank when the World Bank response has no usable time-series points for this country/benchmark pair.
        The panel now falls back to latest available values instead of showing an empty plot.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-xl border bg-white px-3 py-2">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Country</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            {countryLatest ? `${countryLatest.value.toFixed(2)} · ${countryLatest.date}` : 'No current series'}
          </div>
        </div>
        <div className="rounded-xl border bg-white px-3 py-2">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Global benchmark</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            {worldLatest ? `${worldLatest.value.toFixed(2)} · ${worldLatest.date}` : 'No current series'}
          </div>
        </div>
      </div>
    </div>
  )
}

function SeriesChart({ country, world, indicatorLabel }: { country: WbPoint[]; world: WbPoint[]; indicatorLabel: string }) {
  const data = useMemo(() => {
    const map = new Map<string, any>()
    world.forEach(p => {
      if (typeof p.value === 'number') map.set(p.date, { date: p.date, world: p.value })
    })
    country.forEach(p => {
      if (typeof p.value !== 'number') return
      const row = map.get(p.date) || { date: p.date }
      row.country = p.value
      map.set(p.date, row)
    })
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [country, world])

  const hasCountry = hasNumericPoints(country)
  const hasWorld = hasNumericPoints(world)
  const countryLatest = latestNonNull(country)
  const worldLatest = latestNonNull(world)

  if (!hasCountry && !hasWorld) {
    return <EmptyChartState indicatorLabel={indicatorLabel} countryLatest={countryLatest} worldLatest={worldLatest} />
  }

  return (
    <div className="rounded-2xl border border-slate-200 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium text-slate-800">{indicatorLabel}</div>
        <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
          <span className={`rounded-full px-2 py-0.5 ring-1 ${hasCountry ? 'bg-slate-100 ring-slate-200' : 'bg-amber-50 text-amber-800 ring-amber-200'}`}>
            {hasCountry ? 'Country series' : 'Country fallback only'}
          </span>
          <span className={`rounded-full px-2 py-0.5 ring-1 ${hasWorld ? 'bg-slate-100 ring-slate-200' : 'bg-amber-50 text-amber-800 ring-amber-200'}`}>
            {hasWorld ? 'Global series' : 'Global benchmark missing'}
          </span>
        </div>
      </div>

      <div className="h-48">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} width={38} />
            <Tooltip />
            {hasCountry && <Line type="monotone" dataKey="country" name="Country" dot={false} />}
            {hasWorld && <Line type="monotone" dataKey="world" name="World" strokeDasharray="4 2" dot={false} />}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {(!hasCountry || !hasWorld) && (
        <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-slate-600 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            Latest country value: {countryLatest ? `${countryLatest.value.toFixed(2)} (${countryLatest.date})` : 'unavailable'}
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            Latest global value: {worldLatest ? `${worldLatest.value.toFixed(2)} (${worldLatest.date})` : 'unavailable'}
          </div>
        </div>
      )}
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
    ;(async () => {
      setLoading(true)
      try {
        const [match] = await searchCountryByName(countryName)
        if (!match) return
        setCountry(match)
        const iso3 = match.cca3
        const countryData = Object.fromEntries(
          await Promise.all(INDICATORS.map(async x => [x.code, await wbGetCountryIndicatorSeries(iso3, x.code)]))
        )
        const worldData = Object.fromEntries(
          await Promise.all(INDICATORS.map(async x => [x.code, await wbGetGlobalIndicatorSeries(x.code)]))
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
    <aside className="fixed inset-y-0 right-0 z-40 h-[100dvh] w-full border-l bg-white shadow-2xl sm:max-w-xl xl:max-w-2xl">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b px-4 py-3 sm:px-5">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Country context</div>
            <h2 className="text-lg font-semibold sm:text-xl">{countryName}</h2>
          </div>
          <button onClick={onClose} className="rounded-xl bg-slate-100 px-3 py-1.5 text-sm hover:bg-slate-200">Close</button>
        </div>
        <div className="flex-1 min-h-0 space-y-4 overflow-y-auto overscroll-contain p-4 pb-[env(safe-area-inset-bottom)] sm:p-5">
          <Card title="Country facts">
            {!country ? <div className="text-sm text-slate-500">Loading…</div> :
              <ul className="grid grid-cols-1 gap-x-5 gap-y-2 text-sm sm:grid-cols-2">
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
      </div>
    </aside>
  )
}
