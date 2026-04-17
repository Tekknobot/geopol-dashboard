import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { EonetEvent } from '../services/eonet'
import type { ReliefWebItem } from '../services/reliefweb'
import { searchCountryByName } from '../services/restCountries'
import { normalizeExternalUrl } from '../utils/links'

function svgMarker(color: string, emoji: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.25"/>
        </filter>
      </defs>
      <g filter="url(#shadow)">
        <circle cx="24" cy="24" r="16" fill="${color}" />
        <text x="24" y="28" text-anchor="middle" font-size="18" font-family="system-ui, -apple-system, Segoe UI, Emoji">${emoji}</text>
      </g>
    </svg>
  `.trim()

  return L.icon({
    iconUrl: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  })
}

function iconForCategory(cat: string) {
  const c = (cat || '').toLowerCase()
  if (c.includes('flood')) return svgMarker('#0ea5e9', '🌊')
  if (c.includes('earthquake')) return svgMarker('#b45309', '🪨')
  if (c.includes('drought')) return svgMarker('#ca8a04', '☀️')
  if (c.includes('storm') || c.includes('cyclone') || c.includes('hurricane') || c.includes('typhoon')) return svgMarker('#7c3aed', '🌀')
  if (c.includes('outbreak') || c.includes('health')) return svgMarker('#dc2626', '🩺')
  if (c.includes('food') || c.includes('nutrition') || c.includes('famine')) return svgMarker('#16a34a', '🌾')
  if (c.includes('conflict') || c.includes('violence') || c.includes('security')) return svgMarker('#ea580c', '🪖')
  if (c.includes('displacement') || c.includes('migration') || c.includes('refugee')) return svgMarker('#8b5cf6', '🧳')
  return svgMarker('#374151', '●')
}

type SocioPoint = {
  lat: number
  lon: number
  label: string
  category: string
  headline?: string
  source?: string
  url?: string
}
export type MapNewsItem = {
  id: string
  headline: string
  url: string
  source?: string
  category: string
  lat: number
  lon: number
}

const ALL_CATEGORIES = [
  'Flood',
  'Earthquake',
  'Storm/Cyclone',
  'Drought',
  'Health/Outbreak',
  'Food Security',
  'Conflict/Insecurity',
  'Displacement',
  'Other',
]

function inferCategory(r: ReliefWebItem): string {
  const themes = (r.fields.theme || []).map(x => x?.name || '').join(' | ')
  const disasters = (r.fields.disaster_type || []).map(x => x?.name || '').join(' | ')
  const title = r.fields.title || ''
  const hay = `${themes} | ${disasters} | ${title}`.toLowerCase()

  if (/(flood|flooding)/i.test(hay)) return 'Flood'
  if (/(earthquake|seismic)/i.test(hay)) return 'Earthquake'
  if (/(cyclone|storm|hurricane|typhoon)/i.test(hay)) return 'Storm/Cyclone'
  if (/(drought|heatwave|dry spell)/i.test(hay)) return 'Drought'
  if (/(cholera|measles|outbreak|health|epidemic|pandemic|disease)/i.test(hay)) return 'Health/Outbreak'
  if (/(food security|nutrition|famine|ipc|hunger)/i.test(hay)) return 'Food Security'
  if (/(conflict|violence|security|attack|armed|hostilities|protection)/i.test(hay)) return 'Conflict/Insecurity'
  if (/(displacement|refugee|migration|idp|returnee)/i.test(hay)) return 'Displacement'
  return 'Other'
}

function sourceFromUrl(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return 'reliefweb.int' }
}

function dedupeNews(items: MapNewsItem[]) {
  const seen = new Set<string>()
  const out: MapNewsItem[] = []
  for (const item of items) {
    const key = item.url || item.id
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

export default function MapCore({
  events: _unused,
  reports = [],
  onNews,
}: {
  events: EonetEvent[]
  reports?: ReliefWebItem[]
  onNews?: (items: MapNewsItem[]) => void
}) {
  const [points, setPoints] = useState<SocioPoint[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [activeCats, setActiveCats] = useState<Set<string>>(new Set(ALL_CATEGORIES))
  const userTouchedFilters = useRef(false)

  useEffect(() => {
    let alive = true

    async function buildPins() {
      try {
        setErr(null)
        const rows = (reports || []).filter(r => r?.fields?.title && r?.fields?.url)
        if (!rows.length) {
          if (alive) {
            setPoints([])
            if (onNews) onNews([])
            setErr('No ReliefWeb headlines are available right now.')
          }
          return
        }

        const uniqueCountries = Array.from(new Set(
          rows
            .map(r => r.fields.country?.[0]?.name?.trim())
            .filter((v): v is string => !!v)
        ))

        const coordMap = new Map<string, [number, number]>()
        await Promise.all(uniqueCountries.map(async (country) => {
          try {
            const results = await searchCountryByName(country)
            const best = results.find(c => Array.isArray(c.latlng) && c.latlng.length >= 2)
            if (best?.latlng) coordMap.set(country, [best.latlng[0], best.latlng[1]])
          } catch {}
        }))

        if (!alive) return

        const nextPoints: SocioPoint[] = []
        const nextNews: MapNewsItem[] = []
        const seenPointKeys = new Set<string>()

        for (const r of rows) {
          const country = r.fields.country?.[0]?.name?.trim()
          if (!country) continue
          const coords = coordMap.get(country)
          if (!coords) continue

          const [lat, lon] = coords
          const url = normalizeExternalUrl(r.fields.url)
          const headline = r.fields.title.trim()
          const category = inferCategory(r)
          const key = `${country}:${url}`
          if (seenPointKeys.has(key)) continue
          seenPointKeys.add(key)

          nextPoints.push({
            lat,
            lon,
            label: country,
            category,
            headline,
            source: sourceFromUrl(url),
            url,
          })

          nextNews.push({
            id: String(r.id),
            headline,
            url,
            source: sourceFromUrl(url),
            category,
            lat,
            lon,
          })
        }

        if (!alive) return

        setPoints(nextPoints)
        if (onNews) onNews(dedupeNews(nextNews))
        if (!nextPoints.length) setErr('ReliefWeb returned headlines, but none included usable country-based map locations.')
      } catch (e: any) {
        if (!alive) return
        setErr(e?.message || 'Failed to build ReliefWeb map pins.')
      }
    }

    void buildPins()
    return () => { alive = false }
  }, [reports, onNews])

  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const p of points) m[p.category] = (m[p.category] || 0) + 1
    return m
  }, [points])

  const shownPoints = useMemo(() => points.filter(p => activeCats.has(p.category)), [points, activeCats])
  const total = points.length
  const shown = shownPoints.length
  const hasPins = shownPoints.length > 0

  function toggleCat(cat: string) {
    userTouchedFilters.current = true
    setActiveCats(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }
  function selectAll() { userTouchedFilters.current = true; setActiveCats(new Set(Object.keys(counts).length ? Object.keys(counts) : ALL_CATEGORIES)) }
  function clearAll() { userTouchedFilters.current = true; setActiveCats(new Set()) }

  return (
    <div className="space-y-3">
      <div className="h-[520px] overflow-hidden rounded-xl border">
        <MapContainer center={[20, 0]} zoom={2} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {shownPoints.map((p, idx) => (
            <Marker key={`${p.url || p.label}-${idx}`} position={[p.lat, p.lon]} icon={iconForCategory(p.category)}>
              <Popup>
                <div className="space-y-1 min-w-[220px]">
                  <div className="text-xs font-semibold text-slate-500">{p.category}</div>
                  <div className="font-semibold leading-snug">{p.headline || p.label}</div>
                  <div className="text-xs text-slate-600">{p.label}{p.source ? ` • ${p.source}` : ''}</div>
                  {p.url && (
                    <a href={p.url} target="_blank" rel="noreferrer" className="text-sm underline underline-offset-2">
                      Open headline
                    </a>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <details className="bg-white rounded-xl border shadow-sm px-3 py-3 text-[12px] md:open">
        <summary className="cursor-pointer list-none select-none">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">Legend (ReliefWeb headlines)</span>
            <span className="text-slate-600">Shown: {shown}/{total}</span>
          </div>
        </summary>

        <div className="mt-3">
          <div className="flex gap-2 mb-3">
            <button onClick={selectAll} className="px-2 py-1 rounded border hover:bg-slate-50" type="button">All</button>
            <button onClick={clearAll} className="px-2 py-1 rounded border hover:bg-slate-50" type="button">None</button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {Object.keys(counts).sort().map(cat => {
              const n = counts[cat] || 0
              if (!n) return null
              const icon = iconForCategory(cat)
              const on = activeCats.has(cat)
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCat(cat)}
                  className={`flex items-center justify-between gap-2 rounded px-2 py-1 border transition ${on ? 'bg-white' : 'opacity-50'} hover:bg-slate-50`}
                  title={`${cat} — ${n} pin(s)`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <img src={icon.options.iconUrl as string} alt="" width={14} height={14} className="inline-block" />
                    <span className="truncate">{cat}</span>
                  </span>
                  <span className="tabular-nums">{n}</span>
                </button>
              )
            })}
          </div>
        </div>
      </details>

      {!hasPins && !err && <div className="text-xs text-slate-500">Loading ReliefWeb headline pins…</div>}
      {err && (
        <div className="text-xs text-red-600">
          {err}
          <div className="mt-1 text-[11px] text-slate-500">
            The map now uses ReliefWeb headlines only and does not fall back to GDELT or natural-disaster feeds.
          </div>
        </div>
      )}
    </div>
  )
}
