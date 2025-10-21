// src/pages/Events.tsx
import { useEffect, useMemo, useState } from "react"
import Card from "../components/Card"
import Loading from "../components/Loading"
import ErrorState from "../components/ErrorState"
import { fetchPins24h, type PinRow } from "../utils/pins"

const ALL_CATS = [
  "Protest/Strike","Coup","Sanctions","Elections/Politics","Energy","Supply Chain",
  "Macro/Finance","Security/Conflict","Migration","Cyber","Trade/Export Controls",
  "Diplomacy/Alliances","Governance/Corruption","Other"
]

function truncate(s: string, n = 110) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s
}

export default function EventsPage() {
  const [rows, setRows] = useState<PinRow[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [q, setQ] = useState("")
  const [cats, setCats] = useState<Set<string>>(new Set(ALL_CATS))

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const data = await fetchPins24h()
        if (!alive) return
        setRows(data)
      } catch (e: any) {
        if (!alive) return
        setErr(e?.message || "Failed to load pins")
      }
    })()
    return () => { alive = false }
  }, [])

  const filtered = useMemo(() => {
    if (!rows) return []
    const qq = q.trim().toLowerCase()
    return rows.filter(r => {
      if (!cats.has(r.category)) return false
      if (!qq) return true
      return (
        r.headline.toLowerCase().includes(qq) ||
        (r.source || "").toLowerCase().includes(qq) ||
        r.countryGuess.toLowerCase().includes(qq) ||
        r.label.toLowerCase().includes(qq)
      )
    })
  }, [rows, q, cats])

  const byCountry = useMemo(() => {
    const m = new Map<string, PinRow[]>()
    for (const r of filtered) {
      const key = r.countryGuess
      const arr = m.get(key) || []
      arr.push(r)
      m.set(key, arr)
    }
    // sort countries by number of pins desc
    return Array.from(m.entries()).sort((a,b) => b[1].length - a[1].length)
  }, [filtered])

  // Simple "top headlines" strip (take first N from filtered)
  const topStrip = useMemo(() => filtered.slice(0, 8), [filtered])

  function toggleCat(cat: string) {
    setCats(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat); else next.add(cat)
      return next
    })
  }
  function selectAll() { setCats(new Set(ALL_CATS)) }
  function clearAll() { setCats(new Set()) }

  return (
    <div className="space-y-6">
      <Card title="Event Pins (Last 24h)">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search headlines, country, source…"
            className="w-full md:max-w-sm rounded border px-3 py-2 text-sm"
          />
          <div className="flex items-center gap-2 text-xs">
            <button onClick={selectAll} className="rounded border px-2 py-1 hover:bg-slate-50" type="button">All</button>
            <button onClick={clearAll} className="rounded border px-2 py-1 hover:bg-slate-50" type="button">None</button>
          </div>
        </div>

        {/* Category filters */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {ALL_CATS.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => toggleCat(cat)}
              className={`truncate rounded border px-2 py-1 text-xs ${cats.has(cat) ? "bg-white" : "opacity-50"} hover:bg-slate-50`}
              title={cat}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Loading / error */}
        {!rows && !err && <div className="mt-4"><Loading label="Collecting pins…" /></div>}
        {err && <div className="mt-4"><ErrorState message={err} /></div>}

        {/* Top headlines strip */}
        {topStrip.length > 0 && (
          <div className="mt-6 rounded-lg border p-3">
            <div className="text-xs font-semibold text-slate-700 mb-2">Top Headlines</div>
            <ul className="flex flex-wrap gap-2">
              {topStrip.map((h, i) => (
                <li key={`${h.id}:top:${i}`} className="max-w-full">
                  <a
                    href={h.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-2 py-1 text-[12px] ring-1 ring-slate-200 hover:bg-white hover:shadow-sm"
                    title={h.headline}
                  >
                    <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-700">
                      {h.countryGuess}
                    </span>
                    <span className="truncate">{truncate(h.headline, 80)}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Grouped by country, with the country's top headline in the header */}
        {byCountry.length > 0 && (
          <div className="mt-6 space-y-6">
            {byCountry.map(([country, items]) => {
              const top = items[0] // first is fine (already sorted globally); could sort per-country differently if you want
              return (
                <section key={country} className="rounded-lg border">
                  <header className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className="text-sm font-semibold shrink-0">{country}</h3>
                      <span className="text-xs text-slate-500 shrink-0">· {items.length} pin{items.length !== 1 ? "s" : ""}</span>
                    </div>
                    {/* Top headline inline (clickable, truncated) */}
                    {top && (
                      <a
                        href={top.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-slate-700 hover:underline truncate"
                        title={top.headline}
                      >
                        {truncate(top.headline, 120)}
                      </a>
                    )}
                  </header>

                  <ul className="divide-y">
                    {items.map((item, i) => (
                      <li key={`${item.id}:${i}`} className="px-3 py-2">
                        <div className="flex items-start gap-2">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700 ring-1 ring-slate-200 shrink-0">
                            {item.category}
                          </span>
                          <div className="min-w-0 flex-1">
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              className="block font-medium leading-snug hover:underline whitespace-normal break-words"
                              title={item.headline}
                            >
                              {item.headline}
                            </a>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-600">
                              {item.source && <span className="shrink-0">{item.source}</span>}
                              <span className="opacity-50">·</span>
                              <span className="shrink-0">Lat/Lon: {item.lat.toFixed(2)}, {item.lon.toFixed(2)}</span>
                              <span className="opacity-50">·</span>
                              <span className="truncate">Loc: {item.label}</span>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
