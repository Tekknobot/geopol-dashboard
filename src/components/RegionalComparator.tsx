import { useEffect, useMemo, useState } from 'react'
import { searchCountryByName } from '../services/restCountries'
import { wbGetCountryIndicator, toSeries } from '../services/worldBank'
import { ResponsiveContainer, ComposedChart, XAxis, YAxis, Tooltip, ReferenceArea, ReferenceLine, Scatter, CartesianGrid } from 'recharts'

type Row = { name: string; value: number | null; iso3?: string; isFocus?: boolean }

export default function RegionalComparator({
  countryName,
  indicator,
  label
}: {
  countryName: string
  indicator: string
  label: string
}) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        setLoading(true)
        const [c] = await searchCountryByName(countryName)
        if (!c) return
        const region = c.region
        const selISO3 = c.cca3

        // Get region mates (REST Countries). You can swap this to the WB-region approach you use in CountryExplorer.
        const mates = (await fetch(
          `https://restcountries.com/v3.1/region/${encodeURIComponent(region)}?fields=name,cca3`
        ).then(r => r.json())) as { name: { common: string }; cca3: string }[]

        // Pull last value for each mate
        const latest = async (iso3: string) => {
          const s = toSeries(await wbGetCountryIndicator(iso3, indicator, 6))
          const nonNull = s.filter(p => p.value !== null)
          const len = nonNull.length
          return len ? (nonNull[len - 1].value as number) : null
        }

        const data = await Promise.all(
          mates.map(async m => ({
            name: m.name.common,
            value: await latest(m.cca3),
            iso3: m.cca3,
            isFocus: m.cca3 === selISO3
          }))
        )

        // Keep those with any value (but keep selected even if null)
        const hasVal = data.filter(d => d.value !== null)
        const maybeSelected = data.find(d => d.iso3 === selISO3)
        const finalRows =
          maybeSelected && maybeSelected.value === null
            ? [...hasVal, maybeSelected]
            : hasVal

        // Sort by value desc for nicer reading
        finalRows.sort((a, b) => Number(b.value ?? -Infinity) - Number(a.value ?? -Infinity))

        setRows(finalRows)
      } finally {
        setLoading(false)
      }
    })()
  }, [countryName, indicator])

  const stats = useMemo(() => {
    const vals = rows.map(r => r.value).filter((v): v is number => v !== null).sort((a, b) => a - b)
    if (!vals.length) {
      return { min: 0, q1: 0, med: 0, q3: 0, max: 0 }
    }
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
  }, [rows])

  const dataForChart = useMemo(
    () =>
      rows.map(r => ({
        name: r.name,
        value: r.value,
        isFocus: !!r.isFocus
      })),
    [rows]
  )

  // Guard: if no values at all, show simple empty state
  if (!rows.length) {
    return (
      <div>
        <div className="mb-2 text-sm font-medium">{label}</div>
        <div className="text-sm text-slate-600">{loading ? 'Loading…' : 'No regional data available.'}</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-2 text-sm font-medium">{label}</div>
      <div className="h-[360px] w-full">
        <ResponsiveContainer>
          <ComposedChart
            layout="vertical"
            data={dataForChart}
            margin={{ top: 8, right: 24, bottom: 8, left: 120 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            {/* X: metric scale */}
            <XAxis
              type="number"
              domain={['auto', 'auto']}
              tick={{ fontSize: 11 }}
            />
            {/* Y: country names */}
            <YAxis
              type="category"
              dataKey="name"
              width={110}
              tick={{ fontSize: 11 }}
            />

            {/* Quartile shading */}
            {/* Low (min -> q1) */}
            <ReferenceArea x1={stats.min} x2={stats.q1} y1="dataMin" y2="dataMax" />
            {/* Middle (q1 -> q3) */}
            <ReferenceArea x1={stats.q1} x2={stats.q3} y1="dataMin" y2="dataMax" />
            {/* High (q3 -> max) */}
            <ReferenceArea x1={stats.q3} x2={stats.max} y1="dataMin" y2="dataMax" />

            {/* Median line */}
            <ReferenceLine x={stats.med} strokeDasharray="4 2" />

            {/* Dots (focus country rendered larger) */}
            <Scatter
              data={dataForChart}
              dataKey="value"
              shape={(props: any) => {
                const r = props.payload
                const size = r.isFocus ? 6 : 4
                return <circle cx={props.cx} cy={props.cy} r={size} />
              }}
            />

            <Tooltip
              formatter={(v: any) => (typeof v === 'number' ? v.toFixed(2) : '—')}
              labelFormatter={(name: any) => name}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 text-[11px] text-slate-500">
        Bands show regional quartiles (min–Q1, Q1–Q3, Q3–max). Vertical line marks the regional median. The larger dot is the selected country.
      </div>
    </div>
  )
}
