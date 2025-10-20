import { useEffect, useMemo, useState } from 'react'
import { searchCountryByName } from '../services/restCountries'
import { wbGetCountryIndicator, toSeries } from '../services/worldBank'

export default function RegionalComparator({ countryName, indicator, label }:{
  countryName: string; indicator: string; label: string
}) {
  const [rows, setRows] = useState<{ name: string; value: number | null }[]>([])

  useEffect(() => {
    (async () => {
      const [c] = await searchCountryByName(countryName)
      if (!c) return
      const region = c.region
      // fetch region mates
      const mates = await fetch(`https://restcountries.com/v3.1/region/${encodeURIComponent(region)}?fields=name,cca3`)
        .then(r => r.json()) as { name:{common:string}, cca3:string }[]
      const latest = async (iso3: string) => {
        const s = toSeries(await wbGetCountryIndicator(iso3, indicator, 5))
        const v = s[s.length-1]?.value ?? null
        return v
      }
      const data = await Promise.all(mates.slice(0, 12).map(async m => ({ name: m.name.common, value: await latest(m.cca3)})))
      setRows(data.filter(r => r.value !== null))
    })()
  }, [countryName, indicator])

  const max = useMemo(() => Math.max(...rows.map(r => Number(r.value))), [rows])

  return (
    <div>
      <div className="mb-2 text-sm font-medium">{label}</div>
      <ul className="space-y-1.5">
        {rows.sort((a,b)=>Number(b.value)-Number(a.value)).map((r,i)=>(
          <li key={i} className="grid grid-cols-[1fr_auto] items-center gap-2">
            <div className="h-2 rounded bg-slate-100">
              <div className="h-2 rounded bg-slate-700" style={{ width: `${(Number(r.value)/max)*100}%` }} />
            </div>
            <div className="text-xs text-right w-24 truncate">{r.name}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}
