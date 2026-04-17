import { useEffect, useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import Card from '../components/Card'
import Loading from '../components/Loading'
import ErrorState from '../components/ErrorState'
import { fetchPins24h, type PinRow } from '../utils/pins'
import { normalizeExternalUrl } from '../utils/links'

const ALL_CATS = [
  'Flood',
  'Earthquake',
  'Storm/Cyclone',
  'Drought',
  'Health/Outbreak',
  'Food Security',
  'Conflict/Insecurity',
  'Displacement',
  'Governance/Corruption',
  'Other',
]

function buildHourly(rows: PinRow[], match?: (row: PinRow) => boolean) {
  const now = Date.now()
  const start = now - 23 * 60 * 60 * 1000
  const buckets = new Map<string, number>()
  for (let i = 0; i < 24; i++) {
    const d = new Date(start + i * 60 * 60 * 1000)
    const key = `${d.toISOString().slice(5, 13)}:00`
    buckets.set(key, 0)
  }
  for (const row of rows) {
    if (match && !match(row)) continue
    if (!row.created || row.created < start) continue
    const key = `${new Date(row.created).toISOString().slice(5, 13)}:00`
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + 1)
  }
  return Array.from(buckets.entries()).map(([date, count]) => ({ date, count }))
}

export default function EventsPage() {
  const [rows, setRows] = useState<PinRow[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [q, setQ] = useState('')
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
        setErr(e?.message || 'Failed to load ReliefWeb reports')
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
        (r.source || '').toLowerCase().includes(qq) ||
        r.countryGuess.toLowerCase().includes(qq) ||
        r.label.toLowerCase().includes(qq)
      )
    })
  }, [rows, q, cats])

  const byCountry = useMemo(() => {
    const m = new Map<string, PinRow[]>()
    for (const r of filtered) {
      const arr = m.get(r.countryGuess) || []
      arr.push(r)
      m.set(r.countryGuess, arr)
    }
    return Array.from(m.entries()).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
  }, [filtered])

  const trackerCards = useMemo(() => {
    if (!rows) return [] as Array<{ title: string; value: number; note: string }>
    const volatility = rows.length
    const corruption = rows.filter(r => r.category === 'Governance/Corruption').length
    const conflict = rows.filter(r => r.category === 'Conflict/Insecurity').length
    const outbreaks = rows.filter(r => r.category === 'Health/Outbreak').length
    return [
      { title: 'Volatility', value: volatility, note: 'All ReliefWeb reports mapped in the last 24h' },
      { title: 'Corruption / Governance', value: corruption, note: 'Reports tagged or inferred as governance and corruption related' },
      { title: 'Conflict / Insecurity', value: conflict, note: 'Conflict and security-related reports in the same 24h window' },
      { title: 'Health / Outbreak', value: outbreaks, note: 'Humanitarian health and outbreak coverage in the last 24h' },
    ]
  }, [rows])

  const volatilitySeries = useMemo(() => buildHourly(rows || []), [rows])
  const corruptionSeries = useMemo(() => buildHourly(rows || [], row => row.category === 'Governance/Corruption'), [rows])

  function toggleCat(cat: string) {
    setCats(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {trackerCards.map(card => (
          <Card key={card.title} title={card.title}>
            <div className="text-3xl font-semibold tracking-tight">{card.value}</div>
            <p className="mt-2 text-xs text-slate-600">{card.note}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card title="ReliefWeb Volatility Tracker (24h)">
          {!rows && !err ? <Loading label="Building volatility tracker…" /> : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={volatilitySeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={35} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" name="Reports" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="mt-2 text-xs text-slate-600">Hourly count of ReliefWeb reports published over the last 24 hours.</p>
        </Card>

        <Card title="Governance / Corruption Tracker (24h)">
          {!rows && !err ? <Loading label="Building governance tracker…" /> : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={corruptionSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={35} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" name="Reports" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="mt-2 text-xs text-slate-600">Subset of ReliefWeb reports whose themes or titles point to governance, accountability, or corruption issues.</p>
        </Card>
      </div>

      <Card title="ReliefWeb report browser (last 24h)">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search headlines, country, source…"
            className="w-full md:max-w-sm rounded border px-3 py-2 text-sm"
          />
          <div className="text-xs text-slate-600">{filtered.length} visible reports</div>
        </div>

        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {ALL_CATS.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => toggleCat(cat)}
              className={`truncate rounded border px-2 py-1 text-xs ${cats.has(cat) ? 'bg-white' : 'opacity-50'} hover:bg-slate-50`}
              title={cat}
            >
              {cat}
            </button>
          ))}
        </div>

        {!rows && !err && <div className="mt-4"><Loading label="Collecting ReliefWeb reports…" /></div>}
        {err && <div className="mt-4"><ErrorState message={err} /></div>}

        {byCountry.length > 0 && (
          <div className="mt-6 space-y-6">
            {byCountry.map(([country, items]) => (
              <section key={country} className="rounded-lg border">
                <header className="flex items-center justify-between px-3 py-2">
                  <h3 className="text-sm font-semibold">{country}</h3>
                  <span className="text-xs text-slate-600">{items.length} report{items.length !== 1 ? 's' : ''}</span>
                </header>
                <ul className="divide-y">
                  {items.map((item, i) => (
                    <li key={`${item.id}:${i}`} className="px-3 py-2">
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700 ring-1 ring-slate-200 mb-1">
                        {item.category}
                      </span>
                      <a
                        href={normalizeExternalUrl(item.url)}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-[15px] md:text-[17px] font-semibold leading-snug hover:underline whitespace-normal break-words"
                        title={item.headline}
                      >
                        {item.headline}
                      </a>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-600">
                        {item.source && <span className="shrink-0">{item.source}</span>}
                        <span className="opacity-50">·</span>
                        <span className="shrink-0">Lat/Lon: {item.lat.toFixed(2)}, {item.lon.toFixed(2)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
