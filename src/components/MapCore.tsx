import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { useEffect, useMemo, useState } from 'react'
import type { EonetEvent } from '../services/eonet' // prop compatibility

/** ---------- Inline SVG marker (no external assets) ---------- */
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

/** ---------- Icon mapping by category name ---------- */
function iconForCategory(cat: string) {
  const c = (cat || '').toLowerCase()
  if (c.includes('protest/strike'))            return svgMarker('#ef4444', '🪧')
  if (c.includes('coup'))                      return svgMarker('#a855f7', '🛡️')
  if (c.includes('sanctions'))                 return svgMarker('#0f766e', '🚫')
  if (c.includes('elections/politics'))        return svgMarker('#2563eb', '🗳️')
  if (c.includes('energy'))                    return svgMarker('#f59e0b', '⚡')
  if (c.includes('supply chain'))              return svgMarker('#22c55e', '🚢')
  if (c.includes('macro/finance'))             return svgMarker('#10b981', '💹')
  if (c.includes('security/conflict'))         return svgMarker('#ea580c', '🪖')
  if (c.includes('migration'))                 return svgMarker('#8b5cf6', '🧳')
  if (c.includes('cyber'))                     return svgMarker('#0891b2', '💻')
  if (c.includes('trade/export'))              return svgMarker('#16a34a', '🛃')
  if (c.includes('diplomacy/alliances'))       return svgMarker('#0ea5e9', '🕊️')
  if (c.includes('governance/corruption'))     return svgMarker('#9333ea', '🏛️')
  return svgMarker('#374151', '●') // Other
}

/** ---------- Types ---------- */
type SocioPoint = {
  lat: number
  lon: number
  label: string
  category: string
  headline?: string
  source?: string
  url?: string
}

/** Helpers */
function round2(n: number) { return Math.round(n * 100) / 100 }
const rgx = /-?\d+(\.\d+)?/g
function parseCoord(value: any): number | null {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const m = value.match(rgx)
    return m ? parseFloat(m[m.length - 1]) : (Number.isFinite(+value) ? +value : null)
  }
  return null
}
function validCoord(lat: number | null, lon: number | null) {
  if (lat === null || lon === null) return false
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return false
  if (lat === 0 && lon === 0) return false
  return true
}

/** Decode a few common HTML entities from GDELT snippets */
function decodeEntities(s: string) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

/** ---------- Ranked & sanitized news link extraction ---------- */
type PickedLink = { headline?: string; source?: string; url?: string; score: number; reason?: string };

const TRUSTED_DOMAINS = new Set([
  'reuters.com','apnews.com','bbc.com','theguardian.com','nytimes.com','washingtonpost.com',
  'ft.com','bloomberg.com','aljazeera.com','axios.com','npr.org','cnn.com','cnbc.com',
  'cbc.ca','ctvnews.ca','globalnews.ca','thestar.com','theglobeandmail.com','nationalpost.com','cp24.com',
  'france24.com','dw.com','elpais.com','lemonde.fr','scmp.com','straitstimes.com','abc.net.au'
])
const TLD_BONUS = new Set(['ca','com','org','net','gov','edu','int'])
const BLOCKED_PARTS = [
  /\.blogspot\./i, /medium\.com/i, /wordpress\.com/i, /substack\.com/i,
  /vk\.com/i, /\.ru$/i, /t\.me$/i, /telegraph\.co/i, /weebly\.com/i,
  /newsbreak\.com/i, /pressrelease/i, /prnews/i
]
const STRIP_PARAMS = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid','gclid','mc_cid','mc_eid']

function cleanUrl(u: URL) {
  STRIP_PARAMS.forEach(k => u.searchParams.delete(k))
  return u.toString()
}
function domainFrom(u: URL) { return u.hostname.toLowerCase().replace(/^www\./,'') }
function headlineFrom(html: string, fallback?: string) {
  const titleAttr = html.match(/title="([^"]+)"/i)?.[1]
  const aText = html.match(/<a [^>]*>(.*?)<\/a>/i)?.[1]
  const raw = titleAttr || aText || fallback || ''
  return decodeEntities(raw).trim().replace(/\s+/g,' ').slice(0, 160)
}
function scoreDomain(domain: string) {
  let score = 0
  if (TRUSTED_DOMAINS.has(domain)) score += 50
  const tld = domain.split('.').pop() || ''
  if (TLD_BONUS.has(tld)) score += 5
  if (domain.length > 25) score -= 2
  if ((domain.match(/-/g)||[]).length > 2) score -= 2
  if (/\d/.test(domain)) score -= 1
  if (BLOCKED_PARTS.some(rx => rx.test(domain))) score -= 25
  return score
}
function extractAllLinks(html: string): URL[] {
  const urls: URL[] = []
  const rx = /href="([^"]+)"/ig
  let m: RegExpExecArray | null
  while ((m = rx.exec(html))) {
    try {
      const u = new URL(m[1])
      if (u.protocol === 'http:' || u.protocol === 'https:') urls.push(u)
    } catch {}
  }
  return urls
}
function extractBestLink(html: string, fallbackName: string): PickedLink {
  if (!html) return { score: -999 }
  const links = extractAllLinks(html)
  if (!links.length) return { score: -999 }
  const ranked = links.map(u => {
    const domain = domainFrom(u)
    const score = scoreDomain(domain) + (u.protocol === 'https:' ? 2 : 0)
    return { url: cleanUrl(u), domain, score }
  }).sort((a,b) => b.score - a.score)
  const best = ranked[0]
  if (!best) return { score: -999 }
  const ACCEPT_THRESHOLD = 0
  if (best.score < ACCEPT_THRESHOLD) return { score: best.score }
  return {
    url: best.url,
    source: best.domain,
    headline: headlineFrom(html, fallbackName),
    score: best.score,
  }
}

/** ---------- Category inference (broadened) ---------- */
function inferCategory(name: string, html: string) {
  const s = (name + ' ' + html).toLowerCase()
  if (/\b(protest|demonstration|rally|march|mobiliza|manifest|huelga|strike|picket|union|walkout)\b/.test(s)) return 'Protest/Strike'
  if (/\b(coup|golpe|junta|seize power|overthrow|putsch)\b/.test(s)) return 'Coup'
  if (/\b(sanction|embargo|blacklist|asset freeze|export control|entity list|trade restriction)\b/.test(s)) return 'Sanctions'
  if (/\b(election|vote|polls|ballot|campaign|parliament|congress|senate|president|cabinet|assembly|council|budget)\b/.test(s)) return 'Elections/Politics'
  if (/\b(energy|oil|gas|lng|pipeline|refinery|power grid|electricity|fuel|diesel)\b/.test(s)) return 'Energy'
  if (/\b(supply chain|shipping|port|blockade|strait|canal|freight|container|logistics)\b/.test(s)) return 'Supply Chain'
  if (/\b(currency|fx|devaluation|inflation|interest rate|bond|debt|default|imf|world bank|tariff|gdp|recession)\b/.test(s)) return 'Macro/Finance'
  if (/\b(clash|unrest|riot|security|militia|insurg|airstrike|shelling|ceasefire|attack|terror|hostage|troop|shooting|stabbing|police|arrest|homicide|investigation)\b/.test(s)) return 'Security/Conflict'
  if (/\b(migrant|refugee|asylum|displacement|idp)\b/.test(s)) return 'Migration'
  if (/\b(cyber|hacker|ransomware|ddos|malware|data breach|phishing)\b/.test(s)) return 'Cyber'
  if (/\b(tariff|quota|anti-dumping|export ban|import ban|trade deal|fta|wto)\b/.test(s)) return 'Trade/Export Controls'
  if (/\b(summit|talks|negotiation|accord|treaty|alliance|normalization|dialogue|mediator)\b/.test(s)) return 'Diplomacy/Alliances'
  if (/\b(corruption|bribery|graft|kickback|impeachment|resign|no-confidence|ombudsman)\b/.test(s)) return 'Governance/Corruption'
  if (/\b(transit|subway|ttc|strike|bus|service disruption)\b/.test(s)) return 'Protest/Strike'
  return 'Other'
}

/** ---------- Robust fetch (direct to GDELT) ---------- */
async function fetchGeo(query: string, timespan = '24h', maxpoints = 700) {
  const base = "https://api.gdeltproject.org"
  const url = `${base}/api/v2/geo/geo?query=${encodeURIComponent(query)}&mode=PointData&format=GeoJSON&timespan=${encodeURIComponent(timespan)}&maxpoints=${maxpoints}`
  const controller = new AbortController()
  const to = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json, text/plain;q=0.9,*/*;q=0.8' }
    })
    const text = await res.text()
    if (!res.ok) return []
    try {
      const gj = JSON.parse(text)
      return Array.isArray(gj?.features) ? gj.features : []
    } catch {
      const start = text.indexOf('{'); const end = text.lastIndexOf('}')
      if (start !== -1 && end !== -1 && end > start) {
        try {
          const gj = JSON.parse(text.slice(start, end + 1))
          return Array.isArray(gj?.features) ? gj.features : []
        } catch {}
      }
      return []
    }
  } catch {
    return []
  } finally {
    clearTimeout(to)
  }
}

/** ---------- Progressive queries (24h) ---------- */
async function fetchSocio24h(): Promise<SocioPoint[]> {
  const Q1 = '(protest OR strike OR coup OR sanctions OR election OR energy OR oil OR gas OR shipping OR blockade OR "supply chain" OR tariff OR "export control" OR ransomware OR cyber OR refugee OR migration OR summit OR treaty OR alliance OR corruption OR impeachment)'
  const Q2 = '(protest OR strike OR coup OR sanctions OR election OR energy OR shipping OR tariff OR cyber OR refugee OR summit OR corruption)'
  const Q3 = '(politics OR government OR protest OR security)'
  for (const q of [Q1, Q2, Q3]) {
    const feats = await fetchGeo(q, '24h', 900)
    if (feats.length) {
      const pts = feats.map((f: any) => {
        const coords = f?.geometry?.coordinates
        const props = f?.properties || {}
        const lat = parseCoord(coords?.[1]); const lon = parseCoord(coords?.[0])
        if (!validCoord(lat, lon)) return null
        const name = (props.name || '').toString(); const html = (props.html || '').toString()
        const category = inferCategory(name, html)
        const label = name || category
        const best = extractBestLink(html, name)
        const isOther = category === 'Other'
        const trustworthy = (best.score >= 10) || (best.source ? TRUSTED_DOMAINS.has(best.source) : false)
        if (isOther && !trustworthy) return null
        const showLink = best.score >= 0
        const headline = showLink ? best.headline : undefined
        const source = showLink ? best.source : undefined
        const url     = showLink ? best.url     : undefined
        return { lat: lat!, lon: lon!, label, category, headline, source, url }
      }).filter(Boolean) as SocioPoint[]
      if (pts.length) return pts
    }
  }
  return []
}

/** ---------- Component (socio only, 24h) ---------- */
export default function MapCore({ events: _unused }: { events: EonetEvent[] }) {
  const [points, setPoints] = useState<SocioPoint[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [activeCats, setActiveCats] = useState<Set<string>>(new Set()) // legend filters

  useEffect(() => {
    let alive = true
    const id = requestAnimationFrame(async () => {
      try {
        const pts = await fetchSocio24h()
        if (!alive) return
        setPoints(pts)
        const all = new Set(pts.map(p => p.category))
        setActiveCats(all)
      } catch (e: any) {
        if (!alive) return
        setErr(e?.message || 'Failed to load socio-political layer')
      }
    })
    return () => { alive = false; cancelAnimationFrame(id) }
  }, [])

  const counts = useMemo(() => {
    const acc: Record<string, number> = {}
    for (const p of points || []) acc[p.category] = (acc[p.category] || 0) + 1
    return acc
  }, [points])

  const LEGEND_ORDER = [
    'Protest/Strike', 'Coup', 'Sanctions', 'Elections/Politics',
    'Energy', 'Supply Chain', 'Macro/Finance', 'Security/Conflict',
    'Migration', 'Cyber', 'Trade/Export Controls',
    'Diplomacy/Alliances', 'Governance/Corruption', 'Other'
  ]

  const visible = useMemo(() => {
    if (!points) return []
    if (activeCats.size === 0) return []
    return points.filter(p => activeCats.has(p.category))
  }, [points, activeCats])

  const total = points?.length ?? 0
  const shown = visible.length
  const hasPins = shown > 0

  function toggleCat(cat: string) {
    setActiveCats(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat); else next.add(cat)
      return next
    })
  }
  function selectAll() { setActiveCats(new Set(Object.keys(counts))) }
  function clearAll() { setActiveCats(new Set()) }

  return (
    <div className="space-y-3">
      {/* Map: give it as much viewport as possible across devices */}
      <div
        className="
          min-h-[360px]
          h-[70svh] sm:h-[74svh] md:h-[80svh] lg:h-[84svh] xl:h-[88svh]
          [height:70dvh] sm:[height:74dvh] md:[height:80dvh] lg:[height:84dvh] xl:[height:88dvh]
          rounded-xl overflow-hidden border
        "
      >
        <MapContainer
          center={[39, -98]}   // North America default
          zoom={4}
          scrollWheelZoom={true}
          worldCopyJump={true}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {visible.map((p, idx) => (
            <Marker key={'soc-'+idx} position={[p.lat, p.lon]} icon={iconForCategory(p.category)}>
              <Popup>
                <div className="space-y-1">
                  <div className="font-semibold text-sm">{p.label}</div>
                  <div className="text-xs text-slate-600">{p.category}</div>

                  {p.headline && p.url ? (
                    <div className="text-[11px]">
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow ugc"
                        className="text-blue-600 underline"
                        title={p.headline}
                      >
                        {p.headline}
                      </a>
                      {p.source ? <span className="text-slate-500"> — {p.source}</span> : null}
                    </div>
                  ) : (
                    <div className="text-[11px] text-amber-600">Unverified source</div>
                  )}

                  <div className="text-[11px] text-slate-500">Lat/Lon: {round2(p.lat)}, {round2(p.lon)}</div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Legend: collapses on small screens, always open on md+ to save clicks */}
      <details
        className="bg-white rounded-xl border shadow-sm px-3 py-3 text-[12px] md:open"
      >
        <summary className="cursor-pointer list-none select-none">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">Socio (24h)</span>
            <span className="text-slate-600">Shown: {shown}/{total}</span>
          </div>
        </summary>

        <div className="mt-3">
          <div className="flex gap-2 mb-3">
            <button onClick={selectAll} className="px-2 py-1 rounded border hover:bg-slate-50" type="button">All</button>
            <button onClick={clearAll} className="px-2 py-1 rounded border hover:bg-slate-50" type="button">None</button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {LEGEND_ORDER.map(cat => {
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

      {!hasPins && !err && (
        <div className="text-xs text-slate-500">No pins visible — toggle categories above.</div>
      )}
      {err && <div className="text-xs text-red-600">{err}</div>}
    </div>
  )
}
