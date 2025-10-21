// src/utils/pins.ts
import type { MapNewsItem } from "../components/MapCore"

type SocioPoint = {
  lat: number
  lon: number
  label: string
  category: string
  headline?: string
  source?: string
  url?: string
}

const TRUSTED_DOMAINS = new Set([
  "reuters.com","apnews.com","bbc.com","theguardian.com","nytimes.com","washingtonpost.com",
  "ft.com","bloomberg.com","aljazeera.com","axios.com","npr.org","cnn.com","cnbc.com",
  "cbc.ca","ctvnews.ca","globalnews.ca","thestar.com","theglobeandmail.com","nationalpost.com","cp24.com",
  "france24.com","dw.com","elpais.com","lemonde.fr","scmp.com","straitstimes.com","abc.net.au"
])
const BLOCKED_PARTS = [
  /\.blogspot\./i, /medium\.com/i, /wordpress\.com/i, /substack\.com/i,
  /vk\.com/i, /\.ru$/i, /t\.me$/i, /telegraph\.co/i, /weebly\.com/i,
  /newsbreak\.com/i, /pressrelease/i, /prnews/i
]
const STRIP_PARAMS = ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","fbclid","gclid","mc_cid","mc_eid"]

function cleanUrl(u: URL) { STRIP_PARAMS.forEach(k => u.searchParams.delete(k)); return u.toString() }
function domainFrom(u: URL) { return u.hostname.toLowerCase().replace(/^www\./,"") }
function decodeEntities(s: string) { return s.replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">") }
function headlineFrom(html: string, fallback?: string) {
  const titleAttr = html.match(/title="([^"]+)"/i)?.[1]
  const aText = html.match(/<a [^>]*>(.*?)<\/a>/i)?.[1]
  const raw = titleAttr || aText || fallback || ""
  return decodeEntities(raw).trim().replace(/\s+/g," ").slice(0,160)
}
function scoreDomain(domain: string) {
  let score = 0
  if (TRUSTED_DOMAINS.has(domain)) score += 50
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
      if (u.protocol === "http:" || u.protocol === "https:") urls.push(u)
    } catch {}
  }
  return urls
}
function extractBestLink(html: string, fallbackName: string) {
  const links = extractAllLinks(html)
  if (!links.length) return { score: -999 as number }
  const ranked = links.map(u => {
    const domain = domainFrom(u)
    const score = scoreDomain(domain) + (u.protocol === "https:" ? 2 : 0)
    return { url: cleanUrl(u), domain, score }
  }).sort((a,b) => b.score - a.score)
  const best = ranked[0]
  if (!best) return { score: -999 as number }
  if (best.score < 0) return { score: best.score }
  return { url: best.url, source: best.domain, headline: fallbackName, score: best.score }
}

const rgx = /-?\d+(\.\d+)?/g
function parseCoord(v: any): number | null {
  if (typeof v === "number") return v
  if (typeof v === "string") {
    const m = v.match(rgx)
    return m ? parseFloat(m[m.length - 1]) : (Number.isFinite(+v) ? +v : null)
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

function inferCategory(name: string, html: string) {
  const s = (name + " " + html).toLowerCase()
  if (/\b(protest|demonstration|strike|rally|march|walkout)\b/.test(s)) return "Protest/Strike"
  if (/\b(coup|junta|overthrow|putsch)\b/.test(s)) return "Coup"
  if (/\b(sanction|embargo|blacklist|export control)\b/.test(s)) return "Sanctions"
  if (/\b(election|vote|ballot|campaign|parliament|congress|president)\b/.test(s)) return "Elections/Politics"
  if (/\b(energy|oil|gas|pipeline|refinery|electricity|fuel)\b/.test(s)) return "Energy"
  if (/\b(supply chain|shipping|blockade|strait|canal|freight|logistics)\b/.test(s)) return "Supply Chain"
  if (/\b(currency|inflation|interest rate|debt|imf|gdp|recession)\b/.test(s)) return "Macro/Finance"
  if (/\b(riot|unrest|militia|airstrike|ceasefire|attack|terror|shooting|police|arrest)\b/.test(s)) return "Security/Conflict"
  if (/\b(migrant|refugee|asylum|displacement)\b/.test(s)) return "Migration"
  if (/\b(cyber|ransomware|ddos|malware|data breach|phishing)\b/.test(s)) return "Cyber"
  if (/\b(tariff|export ban|import ban|trade deal|wto)\b/.test(s)) return "Trade/Export Controls"
  if (/\b(summit|talks|treaty|alliance|normalization|dialogue)\b/.test(s)) return "Diplomacy/Alliances"
  if (/\b(corruption|bribery|impeachment|no-confidence|resign)\b/.test(s)) return "Governance/Corruption"
  return "Other"
}

async function fetchGeo(query: string, timespan = "24h", maxpoints = 900) {
  const base = "https://api.gdeltproject.org"
  const url = `${base}/api/v2/geo/geo?query=${encodeURIComponent(query)}&mode=PointData&format=GeoJSON&timespan=${encodeURIComponent(timespan)}&maxpoints=${maxpoints}`
  const res = await fetch(url, { headers: { Accept: "application/json, text/plain;q=0.9,*/*;q=0.8" } })
  const text = await res.text()
  if (!res.ok) return []
  try {
    const gj = JSON.parse(text)
    return Array.isArray(gj?.features) ? gj.features : []
  } catch {
    const start = text.indexOf("{"); const end = text.lastIndexOf("}")
    if (start !== -1 && end !== -1 && end > start) {
      try {
        const gj = JSON.parse(text.slice(start, end + 1))
        return Array.isArray(gj?.features) ? gj.features : []
      } catch {}
    }
    return []
  }
}

function featureToPoint(f: any): SocioPoint | null {
  const coords = f?.geometry?.coordinates
  const props = f?.properties || {}
  const lat = parseCoord(coords?.[1]); const lon = parseCoord(coords?.[0])
  if (!validCoord(lat, lon)) return null
  const name = (props.name || "").toString(); const html = (props.html || "").toString()
  const category = inferCategory(name, html)
  const best = extractBestLink(html, name)
  const isOther = category === "Other"
  const trustworthy = (best.score ?? -999) >= 10 || (best as any).source && TRUSTED_DOMAINS.has((best as any).source)
  if (isOther && !trustworthy) return null
  const headline = (best as any).headline ?? name
  const source = (best as any).source
  const url     = (best as any).url
  return { lat: lat!, lon: lon!, label: name || category, category, headline, source, url }
}

function guessCountryFromLabel(label: string): string | null {
  // Heuristic: use the last comma-separated token (e.g., "Lahore, Pakistan" → "Pakistan")
  const parts = label.split(",").map(s => s.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const last = parts[parts.length - 1]
    if (last.length >= 3 && /^[\p{L}\s.'-]+$/u.test(last)) return last
  }
  // Fallback: common " - Country" suffix
  const dash = label.split(" - ").map(s => s.trim())
  if (dash.length >= 2) {
    const last = dash[dash.length - 1]
    if (last.length >= 3 && /^[\p{L}\s.'-]+$/u.test(last)) return last
  }
  return null
}

export type PinRow = MapNewsItem & { label: string; countryGuess: string }

export async function fetchPins24h(): Promise<PinRow[]> {
  const Q1 = '(protest OR strike OR coup OR sanctions OR election OR energy OR oil OR gas OR shipping OR blockade OR "supply chain" OR tariff OR "export control" OR ransomware OR cyber OR refugee OR migration OR summit OR treaty OR alliance OR corruption OR impeachment)'
  const Q2 = '(protest OR strike OR coup OR sanctions OR election OR energy OR shipping OR tariff OR cyber OR refugee OR summit OR corruption)'
  const Q3 = '(politics OR government OR protest OR security)'

  const [f1, f2, f3] = await Promise.all([fetchGeo(Q1), fetchGeo(Q2), fetchGeo(Q3)])
  const dedupe = new Set<string>()
  const rows: PinRow[] = []

  for (const f of [...f1, ...f2, ...f3]) {
    const pt = featureToPoint(f)
    if (!pt || !pt.url) continue
    const key = pt.url || `${pt.lat.toFixed(3)},${pt.lon.toFixed(3)}:${pt.label}`
    if (dedupe.has(key)) continue
    dedupe.add(key)
    const countryGuess = guessCountryFromLabel(pt.label) ?? "Other / Unknown"
    rows.push({
      id: `${pt.category}:${pt.url}`,
      headline: pt.headline || pt.label,
      url: pt.url!,
      source: pt.source,
      category: pt.category,
      lat: pt.lat,
      lon: pt.lon,
      label: pt.label,
      countryGuess,
    })
  }

  // Sort by country then category then headline
  rows.sort((a,b) =>
    a.countryGuess.localeCompare(b.countryGuess) ||
    a.category.localeCompare(b.category) ||
    a.headline.localeCompare(b.headline)
  )

  return rows
}
