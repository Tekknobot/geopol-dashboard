import { useEffect, useState } from 'react'
import { searchCountryByName } from '../services/restCountries'
import { wbGetCountryIndicator, wbGetGlobalIndicator, toSeries } from '../services/worldBank'

export function EventContextChips({ countryName }: { countryName: string }) {
  const [chips, setChips] = useState<string[]>([])

  useEffect(() => {
    (async () => {
      const [c] = await searchCountryByName(countryName)
      if (!c) return
      const iso3 = c.cca3

      const [ge, geW, inf, infW] = await Promise.all([
        wbGetCountryIndicator(iso3, 'GE.EST', 10).then(toSeries),
        wbGetGlobalIndicator('GE.EST', 10).then(toSeries),
        wbGetCountryIndicator(iso3, 'FP.CPI.TOTL.ZG', 10).then(toSeries),
        wbGetGlobalIndicator('FP.CPI.TOTL.ZG', 10).then(toSeries),
      ])

      const last = (arr: any[]) => arr[arr.length - 1]?.value
      const chipA = `Govt effectiveness: ${fmtTrend(ge)} vs world ${fmtTrend(geW)}`
      const chipB = `Inflation: ${num(last(inf)) ?? '—'}% vs world ${num(last(infW)) ?? '—'}%`
      const chipC = c.region ? `Region: ${c.region}` : 'Region: —'
      setChips([chipA, chipB, chipC].filter(Boolean))
    })()
  }, [countryName])

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((t, i) => (
        <span key={i} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 ring-1 ring-slate-200">{t}</span>
      ))}
    </div>
  )
}

function num(v?: number | null) { return typeof v === 'number' ? Number(v).toFixed(1) : null }
function fmtTrend(series: { value: number | null }[]) {
  const values = series.map(s => s.value).filter((x): x is number => typeof x === 'number')
  if (values.length < 2) return '—'
  const d = values[values.length - 1] - values[values.length - 2]
  return d > 0 ? '↑' : d < 0 ? '↓' : '→'
}
