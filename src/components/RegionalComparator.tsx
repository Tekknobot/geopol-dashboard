import { useEffect, useMemo, useState } from 'react'
import { searchCountryByName } from '../services/restCountries'
import { wbGetCountryIndicator, toSeries } from '../services/worldBank'

type Row = { name: string; value: number | null; iso3: string; isFocus?: boolean }

// Most-recent non-null indicator value. Scan farther back to avoid "null" bars.
async function latestNonNull(iso3: string, indicator: string, years = 40): Promise<number | null> {
  const s = toSeries(await wbGetCountryIndicator(iso3, indicator, years))
  for (let i = s.length - 1; i >= 0; i--) {
    const v = s[i].value
    if (typeof v === 'number') return v
  }
  return null
}

export default function RegionalComparator({
  countryName,
  indicator,
  label,
  placeholderPct = 30,       // width % when truly no data
}: {
  countryName: string
  indicator: string
  label: string
  placeholderPct?: number
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

        // Region peers (REST Countries). Swap to WB-region if you prefer.
        const mates = (await fetch(
          `https://restcountries.com/v3.1/region/${encodeURIComponent(region)}?fields=name,cca3`
        ).then(r => r.json())) as { name: { common: string }; cca3: string }[]

        const data = await Promise.all(
          mates.map(async m => ({
            name: m.name.common,
            value: await latestNonNull(m.cca3, indicator, 40), // look back further
            iso3: m.cca3,
            isFocus: m.cca3 === selISO3,
          }))
        )

        // sort by value desc, keep only those with data; then append selected if missing
        const withVal = data.filter(d => d.value !== null) as Row[]
        withVal.sort((a, b) => Number(b.value) - Number(a.value))
        const me = data.find(d => d.iso3 === selISO3) // may be null-valued
        setRows(me && !withVal.some(d => d.iso3 === selISO3) ? [...withVal, me] : withVal)
      } finally {
        setLoading(false)
      }
    })()
  }, [countryName, indicator])

  // Stats for scaling + median tick
  const stats = useMemo(() => {
    const vals = rows.map(r => r.value).filter((v): v is number => v !== null).sort((a,b)=>a-b)
    if (!vals.length) return { min: 0, med: 0, max: 0 }
    const q = (p: number) => {
      const pos = (vals.length - 1) * p
      const base = Math.floor(pos)
      const rest = pos - base
      return vals[base] + (vals[base + 1] !== undefined ? rest * (vals[base + 1] - vals[base]) : 0)
    }
    return { min: vals[0], med: q(0.5), max: vals[vals.length - 1] }
  }, [rows])

  // Percent helper (safe for min==max)
  const pct = (val: number | null) => {
    if (val === null) return 0
    const { min, max } = stats
    if (max === min) return 50
    return ((val - min) / (max - min)) * 100
  }
  const medPct = pct(stats.med)

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
      <ul className="space-y-2">
        {rows.map((r, i) => {
          const isFocus = !!r.isFocus
          const hasData = typeof r.value === 'number'

          // Ensure the selected/last row never looks "empty":
          //  - draw a visible placeholder bar if no data
          //  - give it a min visual width so it’s always noticeable
          const widthPct = hasData ? Math.max(0, Math.min(100, pct(r.value!))) : placeholderPct

          return (
            <li key={`${r.iso3}-${i}`} className="grid grid-cols-[160px_1fr_56px] items-center gap-3">
              {/* Name */}
              <div className={`text-xs truncate ${isFocus ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                {r.name}{!hasData ? ' (no data)' : ''}
              </div>

              {/* Bar with median tick */}
              <div className="relative h-3 rounded bg-slate-100">
                {/* filled segment */}
                <div
                  className={[
                    'absolute left-0 top-0 h-3 rounded',
                    isFocus ? 'bg-slate-900' : (hasData ? 'bg-slate-600/80' : 'bg-slate-400'), // placeholder darker + no extra opacity
                    'min-w-[14px]', // ensure always visible even at very small % or no data
                  ].join(' ')}
                  style={{ width: `${widthPct}%` }}
                  title={hasData ? `${r.name}: ${Number(r.value).toFixed(2)}` : `${r.name}: No recent value`}
                />
                {/* median tick */}
                <div
                  className="absolute top-[-2px] w-0.5 h-4 bg-slate-400/80"
                  style={{ left: `${medPct}%` }}
                  title={`Regional median: ${Number(stats.med).toFixed(2)}`}
                />
              </div>

              {/* Value */}
              <div className="text-xs text-right tabular-nums text-slate-600">
                {hasData ? Number(r.value).toFixed(2) : '—'}
              </div>
            </li>
          )
        })}
      </ul>

      <div className="mt-2 text-[11px] text-slate-500">
        Bars show country scores; thin tick marks the regional median. Selected country is bold and darker. “(no data)” rows show a faint placeholder bar.
      </div>
    </div>
  )
}
