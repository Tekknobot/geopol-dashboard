import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { EonetEvent } from '../services/eonet'
import type { ReliefWebItem } from '../services/reliefweb'
import type { WorldNewsItem } from '../services/worldNews'
import { worldNewsCategory } from '../services/worldNews'
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
  if (c.includes('politic')) return svgMarker('#2563eb', '🏛️')
  if (c.includes('economy') || c.includes('market') || c.includes('trade')) return svgMarker('#059669', '💹')
  if (c.includes('energy')) return svgMarker('#f59e0b', '⚡')
  if (c.includes('technology') || c.includes('cyber')) return svgMarker('#0891b2', '💻')
  if (c.includes('diplomacy')) return svgMarker('#7c3aed', '🤝')
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
  'Politics',
  'Economy/Markets',
  'Energy',
  'Technology/Cyber',
  'Diplomacy',
  'Climate/Disaster',
  'Migration/Human Rights',
  'World News',
  'Other',
]

function inferReliefWebCategory(r: ReliefWebItem): string {
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
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return 'source' }
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

const COUNTRY_ALIASES: Array<[string, string]> = [
  ['united states', 'United States'], ['u.s.', 'United States'], ['us ', 'United States'], ['washington', 'United States'],
  ['canada', 'Canada'], ['ottawa', 'Canada'], ['toronto', 'Canada'],
  ['mexico', 'Mexico'], ['brazil', 'Brazil'], ['argentina', 'Argentina'], ['chile', 'Chile'], ['colombia', 'Colombia'], ['peru', 'Peru'], ['venezuela', 'Venezuela'], ['haiti', 'Haiti'],
  ['united kingdom', 'United Kingdom'], ['britain', 'United Kingdom'], ['uk ', 'United Kingdom'], ['london', 'United Kingdom'],
  ['france', 'France'], ['paris', 'France'], ['germany', 'Germany'], ['berlin', 'Germany'], ['italy', 'Italy'], ['rome', 'Italy'], ['spain', 'Spain'], ['madrid', 'Spain'],
  ['russia', 'Russia'], ['moscow', 'Russia'], ['ukraine', 'Ukraine'], ['kyiv', 'Ukraine'], ['poland', 'Poland'], ['brussels', 'Belgium'],
  ['israel', 'Israel'], ['gaza', 'Palestine'], ['west bank', 'Palestine'], ['palestinian', 'Palestine'], ['iran', 'Iran'], ['tehran', 'Iran'],
  ['iraq', 'Iraq'], ['baghdad', 'Iraq'], ['syria', 'Syria'], ['damascus', 'Syria'], ['lebanon', 'Lebanon'], ['beirut', 'Lebanon'],
  ['saudi', 'Saudi Arabia'], ['riyadh', 'Saudi Arabia'], ['uae', 'United Arab Emirates'], ['dubai', 'United Arab Emirates'], ['abu dhabi', 'United Arab Emirates'],
  ['yemen', 'Yemen'], ['sudan', 'Sudan'], ['khartoum', 'Sudan'], ['egypt', 'Egypt'], ['cairo', 'Egypt'], ['libya', 'Libya'],
  ['ethiopia', 'Ethiopia'], ['somalia', 'Somalia'], ['kenya', 'Kenya'], ['nigeria', 'Nigeria'], ['south africa', 'South Africa'], ['congo', 'DR Congo'],
  ['china', 'China'], ['beijing', 'China'], ['hong kong', 'Hong Kong'], ['taiwan', 'Taiwan'], ['taipei', 'Taiwan'], ['japan', 'Japan'], ['tokyo', 'Japan'],
  ['south korea', 'South Korea'], ['seoul', 'South Korea'], ['north korea', 'North Korea'], ['pyongyang', 'North Korea'], ['india', 'India'], ['delhi', 'India'],
  ['pakistan', 'Pakistan'], ['islamabad', 'Pakistan'], ['afghanistan', 'Afghanistan'], ['myanmar', 'Myanmar'], ['thailand', 'Thailand'], ['bangkok', 'Thailand'],
  ['philippines', 'Philippines'], ['manila', 'Philippines'], ['indonesia', 'Indonesia'], ['jakarta', 'Indonesia'], ['australia', 'Australia'], ['sydney', 'Australia'],
  ['new zealand', 'New Zealand'], ['singapore', 'Singapore'],
]

function inferCountryHint(text: string): string | null {
  const hay = ` ${String(text || '').toLowerCase()} `
  for (const [alias, country] of COUNTRY_ALIASES) {
    if (hay.includes(` ${alias.toLowerCase()} `) || hay.includes(alias.toLowerCase())) return country
  }
  return null
}

export default function MapCore({
  events: _unused,
  reports = [],
  worldNews = [],
  onNews,
}: {
  events: EonetEvent[]
  reports?: ReliefWebItem[]
  worldNews?: WorldNewsItem[]
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

        const reliefRows = (reports || []).filter(r => r?.fields?.title && r?.fields?.url)
        const worldRows = (worldNews || []).filter(r => r?.title && r?.url)

        if (!reliefRows.length && !worldRows.length) {
          if (alive) {
            setPoints([])
            if (onNews) onNews([])
            setErr('No mappable headlines are available right now.')
          }
          return
        }

        const candidateCountries = new Set<string>()
        for (const r of reliefRows) {
          const country = r.fields.country?.[0]?.name?.trim()
          if (country) candidateCountries.add(country)
        }
        for (const item of worldRows) {
          const hint = inferCountryHint(`${item.title} ${item.description || ''}`)
          if (hint) candidateCountries.add(hint)
        }

        const coordMap = new Map<string, [number, number]>()
        await Promise.all(Array.from(candidateCountries).map(async (country) => {
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

        for (const r of reliefRows) {
          const country = r.fields.country?.[0]?.name?.trim()
          if (!country) continue
          const coords = coordMap.get(country)
          if (!coords) continue
          const [lat, lon] = coords
          const url = normalizeExternalUrl(r.fields.url)
          const headline = r.fields.title.trim()
          const category = inferReliefWebCategory(r)
          const key = `rw:${country}:${url}`
          if (seenPointKeys.has(key)) continue
          seenPointKeys.add(key)
          const source = sourceFromUrl(url)

          nextPoints.push({ lat, lon, label: country, category, headline, source, url })
          nextNews.push({ id: `rw:${r.id}`, headline, url, source, category, lat, lon })
        }

        for (const item of worldRows) {
          const country = inferCountryHint(`${item.title} ${item.description || ''}`)
          if (!country) continue
          const coords = coordMap.get(country)
          if (!coords) continue
          const [lat, lon] = coords
          const url = normalizeExternalUrl(item.url)
          const headline = item.title.trim()
          const category = worldNewsCategory(item)
          const key = `wn:${country}:${url}`
          if (seenPointKeys.has(key)) continue
          seenPointKeys.add(key)
          const source = item.source || sourceFromUrl(url)

          nextPoints.push({ lat, lon, label: country, category, headline, source, url })
          nextNews.push({ id: `wn:${item.id}`, headline, url, source, category, lat, lon })
        }

        if (!alive) return
        setPoints(nextPoints)
        if (onNews) onNews(dedupeNews(nextNews))
        if (!nextPoints.length) setErr('Headline feeds loaded, but none included usable country-based map locations.')
      } catch (e: any) {
        if (!alive) return
        setErr(e?.message || 'Failed to build map pins.')
      }
    }

    void buildPins()
    return () => { alive = false }
  }, [reports, worldNews, onNews])

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
            <span className="font-semibold">Legend (world news + ReliefWeb)</span>
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
                  className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-left transition ${on ? 'bg-slate-50 border-slate-300' : 'bg-white opacity-60 border-slate-200'}`}
                  title={on ? 'Hide category' : 'Show category'}
                >
                  <img src={icon.options.iconUrl as string} alt="" className="h-6 w-6 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{cat}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 ring-1 ring-slate-200">{n}</span>
                </button>
              )
            })}
          </div>
        </div>
      </details>

      {!hasPins && err && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {err}
        </div>
      )}
    </div>
  )
}
