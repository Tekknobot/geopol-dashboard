const FEEDS = [
  { name: 'BBC', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { name: 'NPR', url: 'https://feeds.npr.org/1004/rss.xml' },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { name: 'CBC', url: 'https://www.cbc.ca/webfeed/rss/rss-world' },
]

const MAX_PER_FEED = 20
const MAX_TOTAL = 100

function decodeXml(str = '') {
  return String(str)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function pick(tag, xml) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return decodeXml(m?.[1] || '')
}

function pickAll(tag, xml) {
  return [...xml.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi'))].map(m => decodeXml(m[1]))
}

function absoluteLink(link = '') {
  try {
    const u = new URL(link)
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString()
  } catch {}
  return ''
}

function parseRss(xml, feedName) {
  const items = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)]
  return items.slice(0, MAX_PER_FEED).map((m, idx) => {
    const item = m[0]
    const title = pick('title', item)
    const link = absoluteLink(pick('link', item))
    const pubDate = pick('pubDate', item)
    const description = pick('description', item)
    const guid = pick('guid', item)
    const categories = pickAll('category', item).filter(Boolean)
    const source = pick('source', item) || feedName
    return {
      id: guid || `${feedName}:${idx}:${link || title}`,
      title,
      url: link,
      source,
      publishedAt: pubDate,
      description,
      tags: categories,
    }
  }).filter(x => x.title && x.url)
}

function canonicalSourceName(item) {
  const source = String(item.source || '').trim()
  if (source) return source
  try { return new URL(item.url).hostname.replace(/^www\./, '') } catch { return 'news' }
}

function dedupe(items) {
  const seen = new Set()
  const out = []
  for (const item of items) {
    const key = item.url || item.id || item.title
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push({ ...item, source: canonicalSourceName(item) })
    if (out.length >= MAX_TOTAL) break
  }
  return out
}

export default async function handler(_req, res) {
  try {
    const settled = await Promise.allSettled(FEEDS.map(async (feed) => {
      const upstream = await fetch(feed.url, {
        headers: {
          'User-Agent': 'geopol-dashboard/1.0',
          'Accept': 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
        },
      })
      if (!upstream.ok) throw new Error(`${feed.name} HTTP ${upstream.status}`)
      const xml = await upstream.text()
      return parseRss(xml, feed.name)
    }))

    const items = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    const warnings = settled
      .map((r, i) => (r.status === 'rejected' ? `${FEEDS[i].name}: ${r.reason?.message || 'failed'}` : null))
      .filter(Boolean)

    const sorted = dedupe(items).sort((a, b) => {
      const ta = Date.parse(a.publishedAt || '') || 0
      const tb = Date.parse(b.publishedAt || '') || 0
      return tb - ta
    })

    if (!sorted.length) {
      res.status(503)
      res.setHeader('content-type', 'application/json; charset=utf-8')
      res.setHeader('access-control-allow-origin', '*')
      return res.send(JSON.stringify({
        error: 'World news feeds temporarily unavailable',
        warnings,
      }))
    }

    res.status(200)
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.setHeader('cache-control', 's-maxage=300, stale-while-revalidate=900')
    res.setHeader('access-control-allow-origin', '*')
    res.send(JSON.stringify({ items: sorted, warnings }))
  } catch (err) {
    res.status(500).json({
      error: 'World news RSS proxy failed',
      details: err instanceof Error ? err.message : String(err),
    })
  }
}
