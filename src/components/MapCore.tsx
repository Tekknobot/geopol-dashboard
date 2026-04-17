// src/components/MapCore.tsx
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { EonetEvent } from '../services/eonet' // prop compatibility
import { normalizeExternalUrl } from '../utils/links'

// Safe "are we in dev?" check for browser builds (Vite/CRA)
// Put this just below your imports.
const IS_DEV = (() => {
  try {
    // Vite: import.meta.env.DEV
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && (import.meta as any).env && typeof (import.meta as any).env.DEV === 'boolean') {
      // @ts-ignore
      return (import.meta as any).env.DEV as boolean
    }
  } catch {}
  try {
    // Fallback: localhost heuristic
    return !!(typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname))
  } catch {}
  return false
})();

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
  `.trim();

  return L.icon({
    iconUrl: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
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
export type MapNewsItem = {
  id: string
  headline: string
  url: string
  source?: string
  category: string
  lat: number
  lon: number
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

function flattenCoords(input: any, out: Array<[number, number]> = []): Array<[number, number]> {
  if (!Array.isArray(input)) return out
  if (input.length >= 2 && typeof input[0] === 'number' && typeof input[1] === 'number') {
    out.push([Number(input[0]), Number(input[1])])
    return out
  }
  for (const part of input) flattenCoords(part, out)
  return out
}

function centroidFromGeometry(geometry: any): { lat: number | null; lon: number | null } {
  const type = geometry?.type
  const coords = geometry?.coordinates

  if (type === 'Point') {
    const lat = parseCoord(coords?.[1])
    const lon = parseCoord(coords?.[0])
    return { lat, lon }
  }

  const pts = flattenCoords(coords).filter(([lon, lat]) => validCoord(lat, lon))
  if (!pts.length) return { lat: null, lon: null }

  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity
  let sumLon = 0, sumLat = 0
  for (const [lon, lat] of pts) {
    minLon = Math.min(minLon, lon)
    maxLon = Math.max(maxLon, lon)
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
    sumLon += lon
    sumLat += lat
  }

  const boxLon = Number.isFinite(minLon) && Number.isFinite(maxLon) ? (minLon + maxLon) / 2 : null
  const boxLat = Number.isFinite(minLat) && Number.isFinite(maxLat) ? (minLat + maxLat) / 2 : null
  if (validCoord(boxLat, boxLon)) return { lat: boxLat, lon: boxLon }

  const avgLon = sumLon / pts.length
  const avgLat = sumLat / pts.length
  return { lat: avgLat, lon: avgLon }
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

/** ---------- Ranked & sanitized news link extraction (English-biased) ---------- */
type PickedLink = { headline?: string; source?: string; url?: string; score: number; reason?: string };

const TRUSTED_DOMAINS = new Set([
  'reuters.com','apnews.com','bbc.com','theguardian.com','nytimes.com','washingtonpost.com',
  'ft.com','bloomberg.com','aljazeera.com','axios.com','npr.org','cnn.com','cnbc.com',
  'cbc.ca','ctvnews.ca','globalnews.ca','thestar.com','theglobeandmail.com','nationalpost.com','cp24.com',
  'france24.com','dw.com','elpais.com','lemonde.fr','scmp.com','straitstimes.com','abc.net.au'
])

// (Optional) give extra love to English-language outlets
const EN_PREFERRED_DOMAINS = new Set([
  'reuters.com','apnews.com','bbc.com','theguardian.com','nytimes.com','washingtonpost.com',
  'ft.com','bloomberg.com','axios.com','npr.org','cnn.com','cnbc.com',
  'cbc.ca','ctvnews.ca','globalnews.ca','thestar.com','theglobeandmail.com','nationalpost.com','cp24.com',
  'abc.net.au'
])

const TLD_BONUS = new Set(['ca','com','org','net','gov','edu','int'])
const EN_TLDS = new Set(['com','org','net','gov','edu','int','uk','us','ca','au','ie','nz'])
const BLOCKED_PARTS = [
  /\.blogspot\./i, /medium\.com/i, /wordpress\.com/i, /substack\.com/i,
  /vk\.com/i, /\.ru$/i, /t\.me$/i, /telegraph\.co/i, /weebly\.com/i,
  /newsbreak\.com/i, /pressrelease/i, /prnews/i
]
const STRIP_PARAMS = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid','gclid','mc_cid','mc_eid']

function cleanUrl(u: URL) { STRIP_PARAMS.forEach(k => u.searchParams.delete(k)); return u.toString() }
function domainFrom(u: URL) { return u.hostname.toLowerCase().replace(/^www\./,'') }

// Prefer the most informative text we can find per anchor
function bestTextForAnchor(aText?: string, titleAttr?: string, fallback?: string) {
  const raw = (titleAttr || aText || fallback || '').trim()
  return decodeEntities(raw).replace(/\s+/g,' ').slice(0, 160)
}

// Lightweight “is this English-ish?” heuristic
function englishnessScore(text: string, domain: string): number {
  if (!text) return 0
  let s = 0

  // Script heuristic: heavy Latin/ASCII is a good sign
  const ascii = text.replace(/[^\x00-\x7F]/g, '')
  const ratio = ascii.length / Math.max(text.length, 1)
  if (ratio > 0.95) s += 12
  else if (ratio > 0.85) s += 7
  else if (ratio > 0.70) s += 3
  else s -= 4

  // Common English stopwords give another hint
  const common = /\b(the|and|of|to|in|for|on|with|from|over|new|after|as|at|by|amid)\b/i
  if (common.test(text)) s += 4

  // Domain/TLD nudge
  const tld = domain.split('.').pop() || ''
  if (EN_TLDS.has(tld)) s += 3
  if (EN_PREFERRED_DOMAINS.has(domain)) s += 10

  return s
}

function headlineFromText(aText?: string, titleAttr?: string, fallback?: string) {
  return bestTextForAnchor(aText, titleAttr, fallback)
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
  // Extra nudge for preferred English outlets
  if (EN_PREFERRED_DOMAINS.has(domain)) score += 8
  return score
}

// Parse anchors with href + inner text + title
type RawAnchor = { url: URL; aText?: string; titleAttr?: string }
function extractAllAnchors(html: string): RawAnchor[] {
  const anchors: RawAnchor[] = []
  const rx = /<a\s+[^>]*href=(["'])(.*?)\1[^>]*>(.*?)<\/a>/ig
  let m: RegExpExecArray | null
  while ((m = rx.exec(html))) {
    const href = m[2]
    const inner = m[3]?.replace(/<[^>]+>/g, '') // strip nested tags
    // title="..."
    const titleAttr = (m[0].match(/title="([^"]+)"/i)?.[1]) ?? undefined
    try {
      const u = new URL(href)
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        anchors.push({ url: u, aText: inner, titleAttr })
      }
    } catch {}
  }
  // Also handle bare href attr cases (no closing </a> found above)
  const rxHref = /href=(["'])(.*?)\1/ig
  let m2: RegExpExecArray | null
  while ((m2 = rxHref.exec(html))) {
    try {
      const u = new URL(m2[2])
      if (!anchors.some(a => a.url.toString() === u.toString())) {
        anchors.push({ url: u })
      }
    } catch {}
  }
  return anchors
}

function extractBestLink(html: string, fallbackName: string): PickedLink {
  if (!html) return { score: -999 }
  const anchors = extractAllAnchors(html)
  if (!anchors.length) return { score: -999 }

  const ranked = anchors.map(a => {
    const domain = domainFrom(a.url)
    const base = scoreDomain(domain) + (a.url.protocol === 'https:' ? 2 : 0)
    const headline = headlineFromText(a.aText, a.titleAttr, fallbackName)
    const en = englishnessScore(headline, domain)
    // Final score: reputation + Englishness (cap the language boost to avoid overpowering trust)
    const score = base + Math.min(en, 15)
    return {
      url: normalizeExternalUrl(cleanUrl(a.url)),
      domain,
      headline,
      score,
      reason: `domain=${base}, en=${en}`
    }
  })
  .sort((a,b) => b.score - a.score)

  const best = ranked[0]
  if (!best) return { score: -999 }

  // Acceptance threshold slightly higher if not English-biased enough
  const ACCEPT_THRESHOLD = 0
  if (best.score < ACCEPT_THRESHOLD) return { score: best.score, reason: 'below threshold' }

  return {
    url: best.url,
    source: best.domain,
    headline: best.headline,
    score: best.score,
    reason: best.reason
  }
}

/** ---------- Category inference (scoring, more precise) ---------- */

/** Normalize: lowercase + strip diacritics */
function norm(text: string): string {
  try {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
  } catch {
    // Fallback without Unicode property escapes
    return text.toLowerCase()
  }
}

type Cat =
  | 'Protest/Strike'
  | 'Coup'
  | 'Sanctions'
  | 'Elections/Politics'
  | 'Energy'
  | 'Supply Chain'
  | 'Macro/Finance'
  | 'Security/Conflict'
  | 'Migration'
  | 'Cyber'
  | 'Trade/Export Controls'
  | 'Diplomacy/Alliances'
  | 'Governance/Corruption'
  | 'Other'

type Rule = {
  cat: Cat
  // phrases: exact word-boundary phrases (weighted)
  phrases?: Array<{ p: RegExp; w: number }>
  // keywords: single tokens (weighted, multiplicative by occurrences)
  keywords?: Array<{ k: RegExp; w: number; cap?: number }>
  // exclude patterns reduce score (or block)
  excludes?: Array<{ rx: RegExp; w?: number }>
  // global boost/cap
  base?: number
  cap?: number
}

let CATEGORY_RULES: Rule[] | null = null

function buildRules(): Rule[] {
  // Word-boundary helpers (safe for ASCII-latin; we already normalize and strip diacritics)
  const wb = (s: string) => new RegExp(`\\b${s.replace(/\s+/g, '\\s+')}\\b`, 'i')

  const kw = (s: string) => new RegExp(`\\b${s}\\b`, 'i')

  // Shared token lists
  const violence = /(clash|unrest|riot|insurg|airstrike|shell(?:ing)?|ceasefire|attack|terror|hostage|troop|shoot(?:ing)?|stab(?:bing)?|police|arrest|homicide|explosion|bomb|raid|militia|artillery|drone)/i
  const energyInfra = /(pipeline|refinery|lng|rig|wellhead|terminal|grid|substation|power plant|refineri)/i
  const shipping = /(shipping|port|blockade|strait|canal|freight|container|logistics|suez|panama)/i
  const economy = /(currency|fx|devaluat|inflation|interest rate|bond|debt|default|imf|world bank|gdp|recession|budget|tariff|fiscal|monetary|central bank)/i
  const cyberTerms = /(cyber|hacker|ransomware|ddos|malware|data breach|phishing|botnet|exfiltrat|encryption key)/i

  return [
    {
      cat: 'Protest/Strike',
      base: 0,
      phrases: [
        { p: wb('general strike'), w: 8 },
        { p: wb('mass protest'), w: 7 },
        { p: wb('walkout'), w: 6 },
        { p: wb('picket line'), w: 5 },
      ],
      keywords: [
        { k: kw('protest'), w: 5, cap: 3 },
        { k: kw('demonstration'), w: 5, cap: 2 },
        { k: kw('rally'), w: 3, cap: 2 },
        { k: kw('march'), w: 3, cap: 2 },
        { k: kw('strike'), w: 6, cap: 3 },
        { k: kw('union'), w: 3, cap: 2 },
        { k: kw('walkout'), w: 5, cap: 2 },
        // transit-specific
        { k: kw('transit'), w: 2, cap: 2 },
        { k: kw('subway'), w: 2, cap: 2 },
        { k: kw('ttc'), w: 2, cap: 1 },
        { k: kw('bus'), w: 1, cap: 2 },
        { k: wb('service disruption'), w: 3 },
      ],
      excludes: [
        { rx: wb('election day'), w: -4 }, // avoid mislabeling election-day “rallies”
      ],
      cap: 24,
    },
    {
      cat: 'Coup',
      phrases: [{ p: wb('seize power'), w: 8 }, { p: wb('military junta'), w: 10 }],
      keywords: [
        { k: kw('coup'), w: 10, cap: 3 },
        { k: kw('junta'), w: 6, cap: 2 },
        { k: kw('overthrow'), w: 6, cap: 2 },
        { k: kw('putsch'), w: 6, cap: 2 },
      ],
      cap: 22,
    },
    {
      cat: 'Sanctions',
      phrases: [
        { p: wb('asset freeze'), w: 8 },
        { p: wb('export control'), w: 8 },
        { p: wb('entity list'), w: 7 },
        { p: wb('trade restriction'), w: 6 },
      ],
      keywords: [
        { k: kw('sanction'), w: 8, cap: 3 },
        { k: kw('embargo'), w: 7, cap: 2 },
        { k: kw('blacklist'), w: 6, cap: 2 },
      ],
      cap: 22,
    },
    {
      cat: 'Elections/Politics',
      phrases: [
        { p: wb('no-confidence'), w: 7 },
        { p: wb('cabinet reshuffle'), w: 6 },
      ],
      keywords: [
        { k: kw('election'), w: 7, cap: 3 },
        { k: kw('vote'), w: 4, cap: 3 },
        { k: kw('polls'), w: 3, cap: 2 },
        { k: kw('ballot'), w: 4, cap: 2 },
        { k: kw('campaign'), w: 3, cap: 2 },
        { k: kw('parliament'), w: 4, cap: 2 },
        { k: kw('congress'), w: 4, cap: 2 },
        { k: kw('senate'), w: 3, cap: 2 },
        { k: kw('president'), w: 3, cap: 2 },
        { k: kw('cabinet'), w: 3, cap: 2 },
        { k: kw('assembly'), w: 3, cap: 2 },
        { k: kw('council'), w: 2, cap: 2 },
        { k: kw('budget'), w: 3, cap: 2 },
      ],
      cap: 22,
    },
    {
      cat: 'Energy',
      phrases: [
        { p: wb('power grid'), w: 7 },
        { p: wb('oil refinery'), w: 7 },
      ],
      keywords: [
        { k: kw('energy'), w: 4, cap: 3 },
        { k: kw('oil'), w: 3, cap: 3 },
        { k: kw('gas'), w: 3, cap: 3 },
        { k: kw('lng'), w: 5, cap: 2 },
        { k: kw('pipeline'), w: 7, cap: 3 },
        { k: kw('refinery'), w: 6, cap: 2 },
        { k: kw('electricity'), w: 4, cap: 2 },
        { k: kw('fuel'), w: 3, cap: 2 },
        { k: kw('diesel'), w: 3, cap: 2 },
        { k: kw('grid'), w: 3, cap: 2 },
        { k: kw('substation'), w: 4, cap: 2 },
      ],
      cap: 22,
    },
    {
      cat: 'Supply Chain',
      phrases: [
        { p: wb('supply chain'), w: 8 },
        { p: wb('port closure'), w: 7 },
      ],
      keywords: [
        { k: kw('shipping'), w: 5, cap: 3 },
        { k: kw('port'), w: 4, cap: 3 },
        { k: kw('blockade'), w: 6, cap: 2 },
        { k: kw('strait'), w: 5, cap: 2 },
        { k: kw('canal'), w: 4, cap: 2 },
        { k: kw('freight'), w: 4, cap: 2 },
        { k: kw('container'), w: 4, cap: 2 },
        { k: kw('logistics'), w: 4, cap: 2 },
      ],
      cap: 22,
    },
    {
      cat: 'Macro/Finance',
      keywords: [
        { k: kw('currency'), w: 5, cap: 3 },
        { k: kw('fx'), w: 4, cap: 2 },
        { k: kw('devaluation'), w: 6, cap: 2 },
        { k: kw('inflation'), w: 6, cap: 3 },
        { k: kw('interest rate'), w: 6, cap: 2 },
        { k: kw('bond'), w: 4, cap: 2 },
        { k: kw('debt'), w: 4, cap: 2 },
        { k: kw('default'), w: 6, cap: 2 },
        { k: wb('imf'), w: 5 },
        { k: wb('world bank'), w: 4 },
        { k: kw('gdp'), w: 5, cap: 2 },
        { k: kw('recession'), w: 6, cap: 2 },
        { k: kw('budget'), w: 4, cap: 2 },
        { k: kw('tariff'), w: 4, cap: 2 }, // if no explicit trade/export cues, keep as macro
      ],
      excludes: [
        { rx: energyInfra, w: -4 }, // steer energy infra to Energy
        { rx: shipping, w: -3 },    // steer maritime to Supply Chain
      ],
      cap: 22,
    },
    {
      cat: 'Security/Conflict',
      base: 1,
      keywords: [
        { k: kw('security'), w: 2, cap: 2 },
        { k: kw('police'), w: 3, cap: 3 },
        { k: kw('arrest'), w: 3, cap: 3 },
        { k: kw('ceasefire'), w: 4, cap: 2 },
        // violence bucket (multi-match)
        { k: violence, w: 4, cap: 4 },
      ],
      phrases: [
        { p: wb('air strike'), w: 7 },
        { p: wb('armed group'), w: 6 },
      ],
      cap: 26,
    },
    {
      cat: 'Migration',
      keywords: [
        { k: kw('migrant'), w: 6, cap: 3 },
        { k: kw('refugee'), w: 6, cap: 3 },
        { k: kw('asylum'), w: 5, cap: 2 },
        { k: kw('displacement'), w: 5, cap: 2 },
        { k: kw('idp'), w: 5, cap: 2 },
      ],
      cap: 20,
    },
    {
      cat: 'Cyber',
      keywords: [
        { k: cyberTerms, w: 7, cap: 4 },
        { k: wb('data breach'), w: 8, cap: 2 },
        { k: wb('ransom note'), w: 6, cap: 1 },
      ],
      excludes: [
        { rx: wb('cyber monday'), w: -20 }, // avoid retail noise
      ],
      cap: 24,
    },
    {
      cat: 'Trade/Export Controls',
      phrases: [
        { p: wb('export ban'), w: 8 },
        { p: wb('import ban'), w: 7 },
        { p: wb('anti-dumping'), w: 8 },
        { p: wb('trade deal'), w: 6 },
        { p: wb('free trade agreement'), w: 7 },
      ],
      keywords: [
        { k: kw('tariff'), w: 6, cap: 3 },
        { k: kw('quota'), w: 5, cap: 2 },
        { k: kw('wto'), w: 5, cap: 2 },
        { k: kw('fta'), w: 5, cap: 2 },
      ],
      cap: 24,
    },
    {
      cat: 'Diplomacy/Alliances',
      phrases: [
        { p: wb('normalization of ties'), w: 8 },
        { p: wb('peace talks'), w: 7 },
      ],
      keywords: [
        { k: kw('summit'), w: 6, cap: 2 },
        { k: kw('talks'), w: 5, cap: 3 },
        { k: kw('negotiation'), w: 5, cap: 2 },
        { k: kw('accord'), w: 5, cap: 2 },
        { k: kw('treaty'), w: 6, cap: 2 },
        { k: kw('alliance'), w: 6, cap: 2 },
        { k: kw('dialogue'), w: 4, cap: 2 },
        { k: kw('mediator'), w: 4, cap: 2 },
      ],
      cap: 22,
    },
    {
      cat: 'Governance/Corruption',
      phrases: [{ p: wb('no-confidence'), w: 7 }],
      keywords: [
        { k: kw('corruption'), w: 7, cap: 3 },
        { k: kw('bribery'), w: 7, cap: 2 },
        { k: kw('graft'), w: 6, cap: 2 },
        { k: kw('kickback'), w: 6, cap: 2 },
        { k: kw('impeachment'), w: 7, cap: 2 },
        { k: kw('resign'), w: 5, cap: 2 },
        { k: kw('ombudsman'), w: 5, cap: 2 },
      ],
      cap: 22,
    },
  ]
}

function countMatches(text: string, rx: RegExp): number {
  let c = 0
  const g = new RegExp(rx.source, rx.flags.includes('g') ? rx.flags : rx.flags + 'g')
  let m: RegExpExecArray | null
  while ((m = g.exec(text))) c++
  return c
}

function scoreWith(rule: Rule, text: string): number {
  let s = rule.base ?? 0

  if (rule.phrases) {
    for (const { p, w } of rule.phrases) {
      const hits = countMatches(text, p)
      if (hits) s += Math.min(hits * w, (rule.cap ?? 1e9))
    }
  }

  if (rule.keywords) {
    for (const { k, w, cap } of rule.keywords) {
      const hits = countMatches(text, k)
      if (hits) {
        const add = cap ? Math.min(hits, cap) * w : hits * w
        s += add
      }
    }
  }

  if (rule.excludes) {
    for (const { rx, w = -3 } of rule.excludes) {
      if (rx.test(text)) s += w
    }
  }

  if (rule.cap !== undefined) s = Math.min(s, rule.cap)
  return s
}

/** Main: compute per-category scores, then apply tie-breakers */
function inferCategory(name: string, html: string): Cat {
  const s = norm(`${name || ''} ${html || ''}`)

  if (!CATEGORY_RULES) CATEGORY_RULES = buildRules()

  // Score all categories
  const scored = CATEGORY_RULES.map(r => ({ cat: r.cat, score: scoreWith(r, s) }))

  // Primary pick
  scored.sort((a, b) => b.score - a.score)
  const top = scored[0]

  // Threshold: require some minimal evidence
  const MIN_ACCEPT = 6
  if (!top || top.score < MIN_ACCEPT) return 'Other'

  // Tie-breakers when scores are close (±2)
  const near = scored.filter(x => x !== top && Math.abs(x.score - top.score) <= 2)
  if (near.length) {
    // If any strong violence signals, prefer Security/Conflict
    const violent = /(air ?strike|shelling|artillery|drone|explosion|bomb|militia|ceasefire|hostage|crossfire)/i.test(s)
    if (violent) {
      const sec = scored.find(x => x.cat === 'Security/Conflict')
      if (sec && sec.score >= top.score - 2) return 'Security/Conflict'
    }
    // Energy infra words → Energy
    if (/(pipeline|refinery|lng|substation|grid)/i.test(s)) {
      const en = scored.find(x => x.cat === 'Energy')
      if (en && en.score >= top.score - 2) return 'Energy'
    }
    // Maritime chokepoints → Supply Chain
    if (/(strait|canal|port|shipping|blockade)/i.test(s)) {
      const sc = scored.find(x => x.cat === 'Supply Chain')
      if (sc && sc.score >= top.score - 2) return 'Supply Chain'
    }
    // Explicit sanctions words → Sanctions over Trade/Macro
    if (/(sanction|embargo|asset freeze|entity list|export control)/i.test(s)) {
      const sanc = scored.find(x => x.cat === 'Sanctions')
      if (sanc && sanc.score >= top.score - 2) return 'Sanctions'
    }
  }

  return top.cat
}


/** ---------- Progressive fetch & batch-yield from GDELT ---------- */
const LEGEND_QUERIES: Record<string, string> = {
  'Protest/Strike': '(protest OR strike OR walkout OR demonstration OR rally)',
  'Coup': '(coup OR junta OR overthrow OR putsch)',
  'Sanctions': '(sanctions OR embargo OR "asset freeze" OR blacklist OR "entity list")',
  'Elections/Politics': '(election OR vote OR ballot OR campaign OR parliament OR senate OR president OR cabinet)',
  'Energy': '(energy OR oil OR gas OR lng OR pipeline OR refinery OR electricity OR grid OR fuel)',
  'Supply Chain': '("supply chain" OR shipping OR port OR blockade OR freight OR logistics OR container OR canal OR strait)',
  'Macro/Finance': '(inflation OR currency OR debt OR default OR recession OR GDP OR budget OR "interest rate" OR bond OR IMF)',
  'Security/Conflict': '(war OR conflict OR attack OR ceasefire OR bombing OR shelling OR militia OR troops OR police OR violence)',
  'Migration': '(refugee OR migrant OR asylum OR displacement OR IDP)',
  'Cyber': '(cyber OR ransomware OR malware OR "data breach" OR hacker OR DDoS OR phishing)',
  'Trade/Export Controls': '(tariff OR quota OR WTO OR "export control" OR "export ban" OR "import ban" OR "trade restriction")',
  'Diplomacy/Alliances': '(summit OR treaty OR alliance OR talks OR negotiation OR accord OR diplomacy)',
  'Governance/Corruption': '(corruption OR bribery OR graft OR impeachment OR resignation OR ombudsman)',
}

async function fetchGeo(
  controller: AbortController,
  query: string,
  timespan = "24h",
  maxpoints = 900
) {
  const base = (import.meta as any)?.env?.VITE_GDELT_PROXY_URL || "/api/gdelt";

  const attempts = [
    { query, mode: 'PointData', format: 'GeoJSON', timespan, maxpoints, geores: 1 },
    { query, mode: 'PointData', format: 'GeoJSON', timespan: '72h', maxpoints, geores: 1 },
    { query, mode: 'PointData', format: 'GeoJSON', timespan: '168h', maxpoints, geores: 1 },
    { query, mode: 'PointData', format: 'GeoJSON', timespan: '168h', maxpoints: Math.min(maxpoints, 600), geores: 0 },
    { query: '(protest OR strike OR coup OR sanctions OR election OR war OR conflict)', mode: 'PointData', format: 'GeoJSON', timespan: '72h', maxpoints: Math.min(maxpoints, 600), geores: 0 },
    { query: '(politics OR government OR security OR conflict)', mode: 'PointData', format: 'GeoJSON', timespan: '168h', maxpoints: Math.min(maxpoints, 600), geores: 0 },
    { query, mode: 'country', format: 'GeoJSON', timespan: '72h', maxpoints: Math.min(maxpoints, 250) },
    { query, mode: 'country', format: 'GeoJSON', timespan: '168h', maxpoints: Math.min(maxpoints, 250) },
    { query: '(protest OR strike OR coup OR sanctions OR election OR war OR conflict)', mode: 'country', format: 'GeoJSON', timespan: '168h', maxpoints: 200 },
  ];

  let lastProblem = 'No usable GeoJSON payload returned';

  for (const attempt of attempts) {
    const params = new URLSearchParams();
    params.set('query', attempt.query);
    params.set('mode', attempt.mode);
    params.set('format', attempt.format);
    params.set('timespan', attempt.timespan);
    params.set('maxpoints', String(attempt.maxpoints));
    params.set('sortby', 'date');
    if ('geores' in attempt && typeof attempt.geores === 'number') params.set('geores', String(attempt.geores));

    const url = `${base}/api/v2/geo/geo?${params.toString()}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json, text/plain;q=0.9,*/*;q=0.8' },
    });

    if (res.status === 429 || res.status === 503) {
      lastProblem = 'GDELT is rate-limiting or temporarily unavailable';
      continue;
    }

    const text = await res.text();
    if (!res.ok) {
      lastProblem = `GDELT ${res.status}: ${text.slice(0, 200)}`;
      continue;
    }

    const tryParse = (payload: string) => {
      const gj = JSON.parse(payload);
      const features = Array.isArray(gj?.features) ? gj.features : [];
      return features;
    };

    try {
      const features = tryParse(text);
      if (features.length) return features;
      lastProblem = `GDELT returned an empty feature collection (${attempt.mode}/${attempt.timespan})`;
      continue;
    } catch {
      const start = text.indexOf('{'), end = text.lastIndexOf('}');
      if (start !== -1 && end > start) {
        try {
          const features = tryParse(text.slice(start, end + 1));
          if (features.length) return features;
          lastProblem = `GDELT returned an empty feature collection (${attempt.mode}/${attempt.timespan})`;
          continue;
        } catch {
          lastProblem = 'Failed to parse GDELT GeoJSON payload';
          continue;
        }
      }
      lastProblem = 'Failed to parse GDELT GeoJSON payload';
    }
  }

  throw new Error(lastProblem);
}

async function fetchDocs(
  controller: AbortController,
  query: string,
  maxrecords = 12
) {
  const base = (import.meta as any)?.env?.VITE_GDELT_PROXY_URL || '/api/gdelt'

  const attempts = [
    { query, timespan: '24h', maxrecords },
    { query, timespan: '72h', maxrecords },
    { query, timespan: '168h', maxrecords },
  ]

  let lastProblem = 'No usable DOC payload returned'

  for (const attempt of attempts) {
    const params = new URLSearchParams()
    params.set('query', attempt.query)
    params.set('mode', 'ArtList')
    params.set('format', 'json')
    params.set('timespan', attempt.timespan)
    params.set('maxrecords', String(attempt.maxrecords))
    params.set('sort', 'DateDesc')

    const url = `${base}/api/v2/doc/doc?${params.toString()}`
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json, text/plain;q=0.9,*/*;q=0.8' },
    })

    const text = await res.text()

    if (!res.ok) {
      lastProblem = `DOC ${res.status}: ${text.slice(0, 200)}`
      continue
    }

    try {
      const json = JSON.parse(text)
      const articles = Array.isArray(json?.articles) ? json.articles : []
      if (articles.length) return articles
      lastProblem = `DOC returned empty articles (${attempt.timespan})`
    } catch {
      lastProblem = 'Failed to parse DOC JSON payload'
    }
  }

  throw new Error(lastProblem)
}

/** Map a raw feature to a SocioPoint (or null) */
function featureToPoint(f: any, forcedCategory?: string): SocioPoint | null {
  const props = f?.properties || {}

  const { lat, lon } = centroidFromGeometry(f?.geometry)
  if (!validCoord(lat, lon)) return null

  const name = (
    props.name ||
    props.label ||
    props.title ||
    props.location ||
    props.country ||
    props.countryname ||
    props.admin ||
    props.place ||
    props.Actor1Geo_FullName ||
    props.Actor2Geo_FullName ||
    props.ActionGeo_FullName ||
    ''
  ).toString().trim()

  const html = (
    props.html ||
    props.description ||
    props.snippet ||
    props.text ||
    props.details ||
    ''
  ).toString()

  const label = name || forcedCategory || 'Geopolitical event'
  const category = forcedCategory || inferCategory(name, html)

  const best = extractBestLink(html, label)

  const rawUrl =
    props.url ||
    props.sourceurl ||
    props.shareurl ||
    props.documentidentifier ||
    props.link ||
    ''

  const directUrl = rawUrl ? normalizeExternalUrl(String(rawUrl)) : undefined
  const url = best.url || directUrl

  const headline = best.headline || label
  const source =
    best.source ||
    (props.source || props.domain || props.sourcename || '').toString().trim() ||
    undefined

  return {
    lat: lat!,
    lon: lon!,
    label,
    category,
    headline,
    source,
    url,
  }
}

function articleToNewsItem(article: any, category: string, fallbackLat = 0, fallbackLon = 0): MapNewsItem | null {
  const headline = (article?.title || article?.seendate || '').toString().trim()
  const rawUrl = article?.url || article?.socialimage || ''
  const url = rawUrl ? normalizeExternalUrl(String(rawUrl)) : ''
  if (!headline || !url) return null

  const source = (article?.domain || article?.sourcecountry || '').toString().trim() || undefined

  return {
    id: `${category}:${url}`,
    headline,
    url,
    source,
    category,
    lat: fallbackLat,
    lon: fallbackLon,
  }
}

// Put this near your other top-level consts (above the component)
const ALL_CATEGORIES = [
  'Protest/Strike', 'Coup', 'Sanctions', 'Elections/Politics',
  'Energy', 'Supply Chain', 'Macro/Finance', 'Security/Conflict',
  'Migration', 'Cyber', 'Trade/Export Controls',
  'Diplomacy/Alliances', 'Governance/Corruption', 'Other'
]

/** ---------- Component (incremental, batched) ---------- */
export default function MapCore({
  events: _unused,
  onNews,
}: {
  events: EonetEvent[]
  onNews?: (items: MapNewsItem[]) => void
}) {
  const [points, setPoints] = useState<SocioPoint[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [activeCats, setActiveCats] = useState<Set<string>>(new Set(ALL_CATEGORIES))
  const addedKeys = useRef<Set<string>>(new Set()) // dedupe across batches
  const rafId = useRef<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const userTouchedFilters = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    abortRef.current = controller
    let alive = true

    let totalGeoPins = 0
    let totalDocNews = 0

    const allNews: MapNewsItem[] = []

    async function runCategory(cat: string, query: string) {
      /* ---------------------------
        GEO FETCH (MAP PINS)
      --------------------------- */

      try {
        const feats = await fetchGeo(controller, query, '72h', 600)

        if (!alive || controller.signal.aborted) return

        const candidates: SocioPoint[] = []

        for (const f of feats) {
          const pt = featureToPoint(f, cat)
          if (!pt) continue

          const key =
            pt.url ||
            `${pt.lat.toFixed(3)},${pt.lon.toFixed(3)}:${pt.category}:${pt.label}`

          if (addedKeys.current.has(key)) continue
          addedKeys.current.add(key)

          candidates.push(pt)
        }

        if (candidates.length) {
          totalGeoPins += candidates.length

          setPoints(prev => [...prev, ...candidates])

          if (!userTouchedFilters.current) {
            setActiveCats(prev => {
              const next = new Set(prev)
              next.add(cat)
              return next
            })
          }
        }

      } catch (e) {
        if (IS_DEV) {
          console.warn(`GEO failed for ${cat}`, e)
        }
      }

      /* ---------------------------
        DOC FETCH (HEADLINES)
      --------------------------- */

      try {
        const articles = await fetchDocs(controller, query, 12)

        if (!alive || controller.signal.aborted) return

        for (const article of articles) {

          const headline =
            (article?.title || '').toString().trim()

          const rawUrl =
            article?.url || ''

          if (!headline || !rawUrl) continue

          const url = normalizeExternalUrl(rawUrl)

          const item: MapNewsItem = {
            id: `${cat}:${url}`,
            headline,
            url,
            source:
              article?.domain ||
              article?.sourcecountry ||
              undefined,
            category: cat,
            lat: 0,
            lon: 0,
          }

          if (!allNews.some(x => x.url === item.url)) {
            allNews.push(item)
          }
        }

        totalDocNews += allNews.length

        if (onNews) {
          onNews([...allNews])
        }

      } catch (e) {
        if (IS_DEV) {
          console.warn(`DOC failed for ${cat}`, e)
        }
      }
    }

    /* ---------------------------
      RUN ALL LEGEND CATEGORIES
    --------------------------- */

    Promise.allSettled(
      Object.entries(LEGEND_QUERIES).map(
        ([cat, query]) =>
          runCategory(cat, query)
      )
    ).then(() => {

      if (!alive) return

      /* Only fallback if BOTH fail */

      if (totalGeoPins === 0 && totalDocNews === 0) {

        setErr(
          'No live geopolitical results were returned from GDELT. Try again shortly.'
        )

        if (IS_DEV) {
          console.warn('FINAL SUMMARY', {
            totalGeoPins,
            totalDocNews
          })
        }

      }
    })

    return () => {
      alive = false
      controller.abort()
    }

  }, [onNews])

  // If filters change, republish full visible set (to keep Dashboard list in sync)
  useEffect(() => {
    if (!onNews) return
    if (activeCats.size === 0) { onNews([]); return }
    // Only send a capped snapshot to avoid flooding the parent
    const visible = points.filter(p => activeCats.has(p.category) && p.headline && p.url).slice(0, 200)
    const items: MapNewsItem[] = visible.map((p, i) => ({
      id: `${p.category}:${p.url}:${i}`,
      headline: p.headline!,
      url: p.url!,
      source: p.source,
      category: p.category,
      lat: p.lat,
      lon: p.lon,
    }))
    onNews(items)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCats, points])

  const counts = useMemo(() => {
    const acc: Record<string, number> = {}
    for (const p of points || []) acc[p.category] = (acc[p.category] || 0) + 1
    return acc
  }, [points])

  const LEGEND_ORDER = ALL_CATEGORIES

  const visible = useMemo(() => {
    if (!points) return []
    if (activeCats.size === 0) return []
    return points.filter(p => activeCats.has(p.category))
  }, [points, activeCats])

  const total = points?.length ?? 0
  const shown = visible.length
  const hasPins = shown > 0

  function toggleCat(cat: string) {
    userTouchedFilters.current = true
    setActiveCats(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat); else next.add(cat)
      return next
    })
  }
  function selectAll() {
    userTouchedFilters.current = true
    setActiveCats(new Set(ALL_CATEGORIES))
  }
  function clearAll() {
    userTouchedFilters.current = true
    setActiveCats(new Set())
  }

  return (
    <div className="space-y-3">
      {/* Map: roomy across devices */}
      <div className="min-h-[360px] h-[70svh] sm:h-[74svh] md:h-[80svh] lg:h-[84svh] xl:h-[88svh] [height:70dvh] sm:[height:74dvh] md:[height:80dvh] lg:[height:84dvh] xl:[height:88dvh] rounded-xl overflow-hidden border">
        <MapContainer
          center={[39, -98]}
          zoom={4}
          scrollWheelZoom={true}
          worldCopyJump={true}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
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
                      <a href={normalizeExternalUrl(p.url)} target="_blank" rel="noopener noreferrer nofollow ugc" className="text-blue-600 underline" title={p.headline}>
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

      {/* Legend (collapsible on small screens) */}
      <details className="bg-white rounded-xl border shadow-sm px-3 py-3 text-[12px] md:open">
        <summary className="cursor-pointer list-none select-none">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">Legend (Last 24h)</span>
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

      {!hasPins && !err && <div className="text-xs text-slate-500">Loading pins… they’ll appear in batches shortly.</div>}
      {err && (
        <div className="text-xs text-red-600">
          {err}
          <div className="mt-1 text-[11px] text-slate-500">
            The map is driven by legend-category GDELT queries. If no pins appear, GEO returned no usable geocoded results for those category buckets.
          </div>
        </div>
      )}
    </div>
  )
}
