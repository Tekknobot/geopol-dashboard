import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { EonetEvent } from '../services/eonet'
import type { ReliefWebItem } from '../services/reliefweb'
import type { WorldNewsItem } from '../services/worldNews'
import { worldNewsCategory } from '../services/worldNews'
import { searchCountryByName } from '../services/restCountries'
import { normalizeExternalUrl } from '../utils/links'

function svgMarker(color: string, emoji: string, count?: number) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity="0.28"/>
        </filter>
      </defs>
      <g filter="url(#shadow)">
        <circle cx="24" cy="24" r="17" fill="white" opacity="0.98" />
        <circle cx="24" cy="24" r="14" fill="${color}" />
        <text x="24" y="28" text-anchor="middle" font-size="17" font-family="system-ui, -apple-system, Segoe UI, Emoji">${emoji}</text>
        ${count && count > 1 ? `<circle cx="36" cy="12" r="9" fill="#0f172a" />
        <text x="36" y="15" text-anchor="middle" font-size="10" font-weight="800" fill="white" font-family="system-ui, -apple-system, Segoe UI">${count > 99 ? '99+' : String(count)}</text>` : ''}
      </g>
    </svg>
  `.trim()

  return L.icon({
    iconUrl: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -19],
  })
}

function iconForCategory(cat: string, count?: number) {
  const c = (cat || '').toLowerCase()
  if (c.includes('flood')) return svgMarker('#0ea5e9', '🌊', count)
  if (c.includes('earthquake')) return svgMarker('#b45309', '🪨', count)
  if (c.includes('drought')) return svgMarker('#ca8a04', '☀️', count)
  if (c.includes('storm') || c.includes('cyclone') || c.includes('hurricane') || c.includes('typhoon')) return svgMarker('#7c3aed', '🌀', count)
  if (c.includes('outbreak') || c.includes('health')) return svgMarker('#dc2626', '🩺', count)
  if (c.includes('food') || c.includes('nutrition') || c.includes('famine')) return svgMarker('#16a34a', '🌾', count)
  if (c.includes('conflict') || c.includes('violence') || c.includes('security')) return svgMarker('#ea580c', '🪖', count)
  if (c.includes('displacement') || c.includes('migration') || c.includes('rights')) return svgMarker('#0284c7', '🧭', count)
  if (c.includes('governance') || c.includes('corruption') || c.includes('politics')) return svgMarker('#475569', '🏛️', count)
  if (c.includes('economy') || c.includes('markets')) return svgMarker('#059669', '📈', count)
  if (c.includes('energy')) return svgMarker('#b91c1c', '⚡', count)
  if (c.includes('technology') || c.includes('cyber')) return svgMarker('#4338ca', '💻', count)
  if (c.includes('diplomacy')) return svgMarker('#0f766e', '🤝', count)
  if (c.includes('climate') || c.includes('disaster')) return svgMarker('#2563eb', '🌍', count)
  return svgMarker('#64748b', '•', count)
}

function inferReliefWebCategory(r: ReliefWebItem): string {
  const hay = [
    r.fields.title,
    ...(r.fields.theme || []).map((x) => x?.name || ''),
    ...(r.fields.disaster_type || []).map((x) => x?.name || ''),
  ].join(' | ').toLowerCase()

  if (/(flood|flooding)/i.test(hay)) return 'Flood'
  if (/(earthquake|seismic)/i.test(hay)) return 'Earthquake'
  if (/(drought|heatwave|dry spell)/i.test(hay)) return 'Drought'
  if (/(cyclone|storm|hurricane|typhoon)/i.test(hay)) return 'Storm/Cyclone'
  if (/(cholera|measles|outbreak|health|epidemic|pandemic|disease)/i.test(hay)) return 'Health/Outbreak'
  if (/(food security|nutrition|famine|ipc|hunger)/i.test(hay)) return 'Food Security'
  if (/(conflict|violence|security|attack|armed|hostilities|protection)/i.test(hay)) return 'Conflict/Insecurity'
  if (/(displacement|refugee|migration|idp|returnee)/i.test(hay)) return 'Displacement'
  if (/(corruption|bribery|governance|oversight|accountability|anti-corruption)/i.test(hay)) return 'Governance/Corruption'
  return 'Other'
}

function sourceFromUrl(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return 'news' }
}

export type MapNewsItem = {
  id: string
  headline: string
  url: string
  source: string
  category: string
  lat?: number
  lon?: number
}

type SocioPoint = { lat: number; lon: number; label: string; category: string; headline: string; source: string; url: string }
type GroupedPoint = { lat: number; lon: number; label: string; category: string; items: SocioPoint[] }

function coordKey(lat: number, lon: number) { return `${lat.toFixed(4)},${lon.toFixed(4)}` }

function groupPointsByLocation(points: SocioPoint[]): GroupedPoint[] {
  const groups = new Map<string, GroupedPoint>()
  for (const point of points) {
    const key = `${coordKey(point.lat, point.lon)}::${point.category}`
    const existing = groups.get(key)
    if (existing) existing.items.push(point)
    else groups.set(key, { lat: point.lat, lon: point.lon, label: point.label, category: point.category, items: [point] })
  }
  return Array.from(groups.values())
    .map(group => ({ ...group, items: [...group.items].sort((a, b) => a.headline.localeCompare(b.headline)) }))
    .sort((a, b) => b.items.length - a.items.length)
}

const ALL_CATEGORIES = [
  'Politics', 'Economy/Markets', 'Energy', 'Technology/Cyber', 'Diplomacy', 'Climate/Disaster',
  'Migration/Human Rights', 'Conflict/Security', 'Flood', 'Earthquake', 'Storm/Cyclone',
  'Drought', 'Health/Outbreak', 'Food Security', 'Conflict/Insecurity', 'Displacement',
  'Governance/Corruption', 'Other', 'World News', 'Health'
]

function dedupeNews(items: MapNewsItem[]) {
  const seen = new Set<string>()
  const out: MapNewsItem[] = []
  for (const item of items) {
    const key = `${item.url}::${item.category}`
    if (!item.url || seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

const COUNTRY_ALIASES: Array<[string, string]> = [
  ['u.s.', 'United States'], ['u.s', 'United States'], ['us ', 'United States'], [' usa', 'United States'], ['united states', 'United States'], ['america', 'United States'],
  ['uk', 'United Kingdom'], ['u.k.', 'United Kingdom'], ['britain', 'United Kingdom'], ['united kingdom', 'United Kingdom'], ['england', 'United Kingdom'],
  ['eu', 'European Union'], ['european union', 'European Union'], ['uae', 'United Arab Emirates'], ['emirates', 'United Arab Emirates'],
  ['russia', 'Russia'], ['ukraine', 'Ukraine'], ['china', 'China'], ['taiwan', 'Taiwan'], ['japan', 'Japan'], ['south korea', 'South Korea'], ['north korea', 'North Korea'],
  ['india', 'India'], ['pakistan', 'Pakistan'], ['afghanistan', 'Afghanistan'], ['iran', 'Iran'], ['iraq', 'Iraq'], ['israel', 'Israel'], ['gaza', 'Palestine'], ['palestinian', 'Palestine'], ['palestine', 'Palestine'], ['lebanon', 'Lebanon'], ['syria', 'Syria'], ['yemen', 'Yemen'], ['saudi', 'Saudi Arabia'], ['qatar', 'Qatar'], ['oman', 'Oman'], ['jordan', 'Jordan'], ['turkey', 'Turkey'],
  ['sudan', 'Sudan'], ['south sudan', 'South Sudan'], ['ethiopia', 'Ethiopia'], ['somalia', 'Somalia'], ['kenya', 'Kenya'], ['uganda', 'Uganda'], ['tanzania', 'Tanzania'], ['congo', 'DR Congo'], ['dr congo', 'DR Congo'], ['drc', 'DR Congo'], ['nigeria', 'Nigeria'], ['ghana', 'Ghana'], ['cameroon', 'Cameroon'], ['mali', 'Mali'], ['niger', 'Niger'], ['burkina faso', 'Burkina Faso'], ['chad', 'Chad'],
  ['france', 'France'], ['germany', 'Germany'], ['spain', 'Spain'], ['italy', 'Italy'], ['portugal', 'Portugal'], ['greece', 'Greece'], ['poland', 'Poland'], ['romania', 'Romania'], ['hungary', 'Hungary'], ['serbia', 'Serbia'],
  ['canada', 'Canada'], ['mexico', 'Mexico'], ['brazil', 'Brazil'], ['argentina', 'Argentina'], ['chile', 'Chile'], ['colombia', 'Colombia'], ['venezuela', 'Venezuela'], ['peru', 'Peru'], ['ecuador', 'Ecuador'], ['haiti', 'Haiti'], ['cuba', 'Cuba'],
  ['australia', 'Australia'], ['new zealand', 'New Zealand'], ['philippines', 'Philippines'], ['indonesia', 'Indonesia'], ['thailand', 'Thailand'], ['myanmar', 'Myanmar'], ['burma', 'Myanmar'], ['vietnam', 'Vietnam'], ['laos', 'Laos'], ['cambodia', 'Cambodia'], ['singapore', 'Singapore'], ['malaysia', 'Malaysia'],
  ['brussels', 'Belgium'], ['moscow', 'Russia'], ['washington', 'United States'], ['beijing', 'China'], ['taipei', 'Taiwan'], ['tokyo', 'Japan'], ['london', 'United Kingdom'], ['paris', 'France'], ['berlin', 'Germany'], ['rome', 'Italy'], ['ottawa', 'Canada'], ['mexico city', 'Mexico'], ['kyiv', 'Ukraine'], ['kiev', 'Ukraine'], ['jerusalem', 'Israel'], ['tehran', 'Iran'], ['baghdad', 'Iraq'], ['damascus', 'Syria'], ['beirut', 'Lebanon'], ['cairo', 'Egypt'], ['khartoum', 'Sudan'], ['addis ababa', 'Ethiopia'], ['nairobi', 'Kenya'], ['lagos', 'Nigeria'], ['johannesburg', 'South Africa'], ['pretoria', 'South Africa'], ['canberra', 'Australia'], ['wellington', 'New Zealand'], ['manila', 'Philippines'], ['jakarta', 'Indonesia'], ['bangkok', 'Thailand'], ['hanoi', 'Vietnam'],
  ['eu leaders', 'European Union'], ['europe', 'Europe'], ['asia', 'Asia'], ['africa', 'Africa'], ['latin america', 'Brazil'], ['white house', 'United States'], ['congress', 'United States'], ['pentagon', 'United States'], ['kremlin', 'Russia'], ['donbas', 'Ukraine'], ['gulf', 'Middle East'], ['red sea', 'Middle East'], ['hong kong', 'China'], ['xinjiang', 'China'], ['west bank', 'Palestine'], ['nato', 'Belgium'], ['un ', 'United States'], ['united nations', 'United States'],
  ['zelensky', 'Ukraine'], ['putin', 'Russia'], ['trump', 'United States'], ['biden', 'United States'], ['modi', 'India'], ['netanyahu', 'Israel'], ['xi', 'China'],
  ['st petersburg', 'Russia'], ['odesa', 'Ukraine'], ['kharkiv', 'Ukraine'], ['tel aviv', 'Israel'], ['gaza strip', 'Palestine'], ['ramallah', 'Palestine'], ['dubai', 'United Arab Emirates'], ['abu dhabi', 'United Arab Emirates'], ['riyadh', 'Saudi Arabia'], ['doha', 'Qatar'], ['istanbul', 'Turkey'], ['ankara', 'Turkey'], ['mumbai', 'India'], ['delhi', 'India'], ['shanghai', 'China'], ['shenzhen', 'China'], ['seoul', 'South Korea'], ['pyongyang', 'North Korea'],
  ['euro zone', 'Europe'], ['eurozone', 'Europe'], ['european commission', 'Belgium'], ['ecb', 'Germany'], ['brics', 'South Africa'], ['asean', 'Indonesia'], ['whitehall', 'United Kingdom'], ['downing street', 'United Kingdom'], ['capitol hill', 'United States'], ['wall street', 'United States'], ['silicon valley', 'United States'], ['hollywood', 'United States'], ['vatican', 'Italy'], ['taiwan strait', 'Taiwan'], ['south china sea', 'Asia'], ['indo-pacific', 'Asia'], ['sahel', 'Africa'], ['horn of africa', 'Africa'], ['balkans', 'Europe'], ['caucasus', 'Asia'], ['central asia', 'Asia'], ['southeast asia', 'Asia'],
]

const URL_HINTS: Array<[RegExp, string]> = [[/\/world\/us-?canada\//i, 'United States'], [/\/news\/world-us-canada\//i, 'United States'], [/\/news\/world-asia/i, 'Asia'], [/\/news\/world-middle-east/i, 'Middle East'], [/\/news\/world-europe/i, 'Europe'], [/\/news\/world-africa/i, 'Africa']]
const REGION_FALLBACKS: Record<string, [number, number]> = { Europe: [54, 15], Africa: [2, 20], Asia: [34, 100], 'Middle East': [29, 45], 'European Union': [50, 10], 'Latin America': [-15, -60], 'North America': [45, -100], 'World': [20, 0] }

function inferCountryHint(text: string, url?: string): string | null {
  const hay = ` ${String(text || '').toLowerCase()} `
  for (const [alias, country] of COUNTRY_ALIASES) if (hay.includes(` ${alias.toLowerCase()} `) || hay.includes(alias.toLowerCase())) return country
  const rawUrl = String(url || '')
  for (const [pattern, place] of URL_HINTS) if (pattern.test(rawUrl)) return place
  return null
}

async function resolveCoords(place: string, coordMap: Map<string, [number, number]>) {
  if (coordMap.has(place)) return
  if (REGION_FALLBACKS[place]) { coordMap.set(place, REGION_FALLBACKS[place]); return }
  try {
    const results = await searchCountryByName(place)
    const best = results.find(c => Array.isArray(c.latlng) && c.latlng.length >= 2)
    if (best?.latlng) coordMap.set(place, [best.latlng[0], best.latlng[1]])
  } catch {}
}

async function resolveInBatches(places: string[], coordMap: Map<string, [number, number]>, batchSize = 8) {
  for (let i = 0; i < places.length; i += batchSize) await Promise.all(places.slice(i, i + batchSize).map((place) => resolveCoords(place, coordMap)))
}

function FitBounds({ groups, version }: { groups: GroupedPoint[]; version: number }) {
  const map = useMap()
  useEffect(() => {
    if (!groups.length) return
    const bounds = L.latLngBounds(groups.map(g => [g.lat, g.lon] as [number, number]))
    if (bounds.isValid()) map.fitBounds(bounds.pad(0.22), { animate: true, maxZoom: groups.length === 1 ? 4 : 5 })
  }, [groups, map, version])
  return null
}

function ResetMapButton({ groups, onReset }: { groups: GroupedPoint[]; onReset: () => void }) {
  const map = useMap()
  return (
    <button
      type="button"
      onClick={() => {
        if (groups.length) {
          const bounds = L.latLngBounds(groups.map(g => [g.lat, g.lon] as [number, number]))
          if (bounds.isValid()) map.fitBounds(bounds.pad(0.22), { animate: true, maxZoom: groups.length === 1 ? 4 : 5 })
        } else map.setView([20, 0], 2)
        onReset()
      }}
      className="rounded-full border border-white/70 bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur hover:bg-slate-50"
    >
      Fit pins
    </button>
  )
}

export default function MapCore({ events: _unused, reports = [], worldNews = [], onNews }: { events: EonetEvent[]; reports?: ReliefWebItem[]; worldNews?: WorldNewsItem[]; onNews?: (items: MapNewsItem[]) => void }) {
  const [points, setPoints] = useState<SocioPoint[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [activeCats, setActiveCats] = useState<Set<string>>(new Set(ALL_CATEGORIES))
  const [query, setQuery] = useState('')
  const [fitVersion, setFitVersion] = useState(0)
  const userTouchedFilters = useRef(false)

  useEffect(() => {
    let alive = true
    async function buildPins() {
      try {
        setErr(null)
        const reliefRows = (reports || []).filter(r => r?.fields?.title && r?.fields?.url)
        const worldRows = (worldNews || []).filter(r => r?.title && r?.url)
        if (!reliefRows.length && !worldRows.length) {
          if (alive) { setPoints([]); if (onNews) onNews([]); setErr('No mappable headlines are available right now.') }
          return
        }
        const reliefCandidates = reliefRows.map((r) => r.fields.country?.[0]?.name?.trim()).filter((value): value is string => Boolean(value))
        const worldPlaceById = new Map<string, string>()
        for (const item of worldRows) {
          const place = inferCountryHint(`${item.title} ${item.description || ''}`, item.url)
          if (place) worldPlaceById.set(item.id, place)
        }
        const candidatePlaces = Array.from(new Set([...reliefCandidates, ...worldPlaceById.values()]))
        const coordMap = new Map<string, [number, number]>()
        await resolveInBatches(candidatePlaces, coordMap, 8)
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
          const place = worldPlaceById.get(item.id)
          if (!place) continue
          const coords = coordMap.get(place)
          if (!coords) continue
          const [lat, lon] = coords
          const url = normalizeExternalUrl(item.url)
          const headline = item.title.trim()
          const category = worldNewsCategory(item)
          const key = `wn:${place}:${url}`
          if (seenPointKeys.has(key)) continue
          seenPointKeys.add(key)
          const source = item.source || sourceFromUrl(url)
          nextPoints.push({ lat, lon, label: place, category, headline, source, url })
          nextNews.push({ id: `wn:${item.id}`, headline, url, source, category, lat, lon })
        }
        if (!alive) return
        setPoints(nextPoints)
        setFitVersion(v => v + 1)
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

  useEffect(() => {
    if (userTouchedFilters.current) return
    const available = Object.keys(counts)
    if (!available.length) return
    setActiveCats(new Set(available))
  }, [counts])

  const search = query.trim().toLowerCase()
  const shownPoints = useMemo(() => points.filter(p => {
    if (!activeCats.has(p.category)) return false
    if (!search) return true
    return `${p.label} ${p.category} ${p.headline} ${p.source}`.toLowerCase().includes(search)
  }), [points, activeCats, search])
  const groupedShownPoints = useMemo(() => groupPointsByLocation(shownPoints), [shownPoints])
  const total = points.length
  const shown = shownPoints.length
  const shownMarkers = groupedShownPoints.length
  const hasPins = shownPoints.length > 0
  const availableCats = Object.keys(counts).sort((a, b) => counts[b] - counts[a])
  const topLocations = useMemo(() => {
    const byPlace = new Map<string, number>()
    for (const p of shownPoints) byPlace.set(p.label, (byPlace.get(p.label) || 0) + 1)
    return Array.from(byPlace.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [shownPoints])

  function toggleCat(cat: string) {
    userTouchedFilters.current = true
    setActiveCats(prev => { const next = new Set(prev); next.has(cat) ? next.delete(cat) : next.add(cat); return next })
  }
  function selectAll() { userTouchedFilters.current = true; setActiveCats(new Set(availableCats.length ? availableCats : ALL_CATEGORIES)) }
  function clearAll() { userTouchedFilters.current = true; setActiveCats(new Set()) }
  function focusPlace(place: string) { setQuery(place); setFitVersion(v => v + 1) }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-2 shadow-sm">
        <div className="relative h-[560px] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
          <MapContainer center={[20, 0]} zoom={2} minZoom={2} scrollWheelZoom worldCopyJump style={{ height: '100%', width: '100%' }}>
            <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <FitBounds groups={groupedShownPoints} version={fitVersion} />
            <div className="leaflet-top leaflet-right">
              <div className="leaflet-control m-3 flex flex-col gap-2">
                <ResetMapButton groups={groupedShownPoints} onReset={() => setFitVersion(v => v + 1)} />
              </div>
            </div>
            {groupedShownPoints.map((group, idx) => (
              <Marker key={`${group.label}-${group.category}-${idx}`} position={[group.lat, group.lon]} icon={iconForCategory(group.category, group.items.length)}>
                <Popup className="geopol-popup">
                  <div className="min-w-[270px] max-w-[360px] space-y-3">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{group.category}</div>
                          <div className="text-base font-extrabold leading-tight text-slate-950">{group.label}</div>
                        </div>
                        <div className="rounded-full bg-slate-900 px-2 py-1 text-[11px] font-bold text-white">{group.items.length}</div>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">Grouped headlines at this mapped location</div>
                    </div>
                    <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                      {group.items.map((item, itemIdx) => (
                        <a key={`${item.url}-${itemIdx}`} href={item.url} target="_blank" rel="noreferrer" className="block rounded-xl border border-slate-200 bg-white px-3 py-2 hover:border-slate-300 hover:bg-slate-50">
                          <div className="text-sm font-semibold leading-snug text-slate-900">{item.headline || item.label}</div>
                          <div className="mt-1 text-[11px] text-slate-500">{item.source ? `${item.source} · ` : ''}{item.label}</div>
                        </a>
                      ))}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          <div className="pointer-events-none absolute left-3 top-3 z-[500] max-w-[calc(100%-1.5rem)]">
            <div className="pointer-events-auto rounded-2xl border border-white/70 bg-white/95 p-3 shadow-lg backdrop-blur md:w-[360px]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Live map view</div>
                  <div className="mt-1 text-lg font-extrabold leading-none text-slate-950">{shown} of {total} headlines</div>
                </div>
                <div className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">{shownMarkers} pins</div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-xl bg-slate-50 px-2 py-2 ring-1 ring-slate-200"><div className="font-bold text-slate-950">{availableCats.length}</div><div className="text-slate-500">topics</div></div>
                <div className="rounded-xl bg-slate-50 px-2 py-2 ring-1 ring-slate-200"><div className="font-bold text-slate-950">{topLocations.length ? topLocations[0][0] : '—'}</div><div className="text-slate-500">top place</div></div>
                <div className="rounded-xl bg-slate-50 px-2 py-2 ring-1 ring-slate-200"><div className="font-bold text-slate-950">{activeCats.size}</div><div className="text-slate-500">active</div></div>
              </div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search country, source, headline…"
                className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-0 placeholder:text-slate-400 focus:border-slate-400"
              />
            </div>
          </div>

          {topLocations.length > 0 && (
            <div className="pointer-events-none absolute bottom-3 left-3 z-[500] hidden max-w-[calc(100%-1.5rem)] md:block">
              <div className="pointer-events-auto rounded-2xl border border-white/70 bg-white/95 p-3 shadow-lg backdrop-blur md:w-[360px]">
                <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold uppercase tracking-wide text-slate-500">Hotspots</span>
                  <button type="button" onClick={() => { setQuery(''); setFitVersion(v => v + 1) }} className="rounded-full px-2 py-1 text-slate-600 hover:bg-slate-100">clear</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {topLocations.map(([place, count]) => (
                    <button key={place} type="button" onClick={() => focusPlace(place)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50">
                      {place} <span className="text-slate-400">{count}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <details className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-[12px] shadow-sm" open>
        <summary className="cursor-pointer list-none select-none">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">Map filters</span>
            <span className="text-slate-600">Headlines: {shown}/{total} · Markers: {shownMarkers}</span>
          </div>
        </summary>
        <div className="mt-3">
          <div className="mb-3 flex flex-wrap gap-2">
            <button onClick={selectAll} className="rounded-full border px-3 py-1.5 font-semibold hover:bg-slate-50" type="button">All topics</button>
            <button onClick={clearAll} className="rounded-full border px-3 py-1.5 font-semibold hover:bg-slate-50" type="button">None</button>
            {query && <button onClick={() => setQuery('')} className="rounded-full border px-3 py-1.5 font-semibold hover:bg-slate-50" type="button">Clear search</button>}
          </div>
          <div className="flex flex-wrap gap-2">
            {availableCats.map(cat => {
              const n = counts[cat] || 0
              const icon = iconForCategory(cat)
              const on = activeCats.has(cat)
              return (
                <button key={cat} type="button" onClick={() => toggleCat(cat)} className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-left transition ${on ? 'border-slate-300 bg-slate-50 text-slate-900 shadow-sm' : 'border-slate-200 bg-white text-slate-500 opacity-60'}`} title={on ? 'Hide category' : 'Show category'}>
                  <img src={icon.options.iconUrl as string} alt="" className="h-5 w-5 shrink-0" />
                  <span className="max-w-[160px] truncate">{cat}</span>
                  <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200">{n}</span>
                </button>
              )
            })}
          </div>
        </div>
      </details>

      {!hasPins && err && <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{err}</div>}
    </div>
  )
}
