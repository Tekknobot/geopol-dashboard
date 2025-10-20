// --- helpers (put above the component or in a utils file) ---
type HeadlineItem = {
  id: string
  headline: string
  url: string
  source?: string
  category?: string
  lat?: number
  lon?: number
  countryName?: string
}

const _imgCache = new Map<string, string | null>()

async function _wikiSummaryImage(q: string): Promise<string | null> {
  try {
    const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`, { mode: 'cors' })
    if (!r.ok) return null
    const data = await r.json()
    return data?.originalimage?.source || data?.thumbnail?.source || null
  } catch { return null }
}

async function _commonsImage(q: string): Promise<string | null> {
  try {
    const u =
      `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q)}`
      + `&gsrlimit=1&prop=imageinfo&iiprop=url&format=json&origin=*`
    const r = await fetch(u, { mode: 'cors' })
    if (!r.ok) return null
    const data = await r.json()
    const page = data?.query?.pages ? Object.values(data.query.pages)[0] as any : null
    return page?.imageinfo?.[0]?.url || null
  } catch { return null }
}

async function _bestContextImage(queries: string[]): Promise<string | null> {
  for (const q of queries) {
    const a = await _wikiSummaryImage(q)
    if (a) return a
    const b = await _commonsImage(q)
    if (b) return b
  }
  return null
}

// --- replacement component ---
import { useEffect, useMemo, useRef, useState } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import { searchCountryByName } from '../services/restCountries'

function ContextImageCard({ item }: { item: HeadlineItem }) {
  const [src, setSrc] = useState<string | null>(null)
  const [flagSrc, setFlagSrc] = useState<string | null>(null)
  const triedFallback = useRef(false)

  const cacheKey = useMemo(() => {
    return [item.id, item.countryName || '', (item.category || '').toLowerCase()].join('|')
  }, [item.id, item.countryName, item.category])

  const neutralSvg = useMemo(() => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" role="img" aria-label="Context placeholder">
      <defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#e5e7eb"/><stop offset="1" stop-color="#f8fafc"/></linearGradient></defs>
      <rect width="1600" height="900" fill="url(#g)"/>
      <g font-family="system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial" fill="#475569">
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="28">Context image unavailable</text>
      </g>
    </svg>`
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      // cache hit?
      if (_imgCache.has(cacheKey)) {
        const c = _imgCache.get(cacheKey) ?? null
        if (!alive) return
        setSrc(c)
        return
      }

      const country = item.countryName?.trim() || ''
      const topic = (item.category || '').toLowerCase()
      const queries: string[] = []

      if (country) {
        if (topic.includes('polit') || topic.includes('gov')) queries.push(`Parliament of ${country}`)
        if (topic.includes('protest') || topic.includes('unrest')) queries.push(`Protests in ${country}`)
        if (topic.includes('border')) queries.push(`Border of ${country}`)
        if (topic.includes('city')) queries.push(`${country} skyline`)

        // capital & country queries + set up flag fallback
        try {
          const [c] = await searchCountryByName(country)
          const capital = c?.capital?.[0]
          if (capital) { queries.push(`${capital} city`, capital) }
          queries.push(country)
          const iso2 = (c?.cca2 || '').toLowerCase()
          if (iso2) setFlagSrc(`https://flagcdn.com/w1600/${iso2}.png`)
        } catch {
          queries.push(country)
        }
      } else {
        // generic but reliable geopolitics venue
        queries.push('United Nations General Assembly Hall')
      }

      const best = await _bestContextImage(queries)
      if (!alive) return
      _imgCache.set(cacheKey, best)
      setSrc(best)
    })()
    return () => { alive = false }
  }, [cacheKey, item])

  const handleError: React.ReactEventHandler<HTMLImageElement> = (e) => {
    const img = e.currentTarget
    if (!triedFallback.current && flagSrc) {
      triedFallback.current = true
      img.src = flagSrc
    } else {
      img.src = neutralSvg
    }
  }

  const displaySrc = src || flagSrc || neutralSvg

  return (
    <figure className="overflow-hidden rounded-2xl border shadow-sm bg-white">
      <div className="relative aspect-[16/9] w-full bg-slate-100">
        <img
          src={displaySrc}
          alt={`${item.countryName || 'Global'} context illustration`}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={handleError}
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4 sm:p-6">
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-start gap-2 text-left"
          >
            <ImageIcon className="mt-0.5 h-4 w-4 shrink-0 text-white/90" />
            <figcaption className="text-white">
              <div className="line-clamp-2 text-base sm:text-lg font-semibold leading-snug group-hover:underline">
                {item.headline}
              </div>
              <div className="mt-1 text-xs text-white/80">
                {item.countryName ? `Context: ${item.countryName}` : 'Global context'}
              </div>
            </figcaption>
          </a>
        </div>
      </div>
    </figure>
  )
}

export default ContextImageCard
