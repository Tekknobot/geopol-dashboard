const FEEDS = [
  // Core international headlines
  { name: 'BBC', tier: 'Breaking News', region: 'Global', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { name: 'NPR', tier: 'Breaking News', region: 'United States / Global', url: 'https://feeds.npr.org/1004/rss.xml' },
  { name: 'Al Jazeera', tier: 'Breaking News', region: 'Middle East / Global', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { name: 'CBC', tier: 'Regional Perspective', region: 'Canada / Global', url: 'https://www.cbc.ca/webfeed/rss/rss-world' },
  { name: 'AP News', tier: 'Breaking News', region: 'Global', url: 'https://apnews.com/hub/ap-top-news?output=1' },
  { name: 'DW', tier: 'Regional Perspective', region: 'Europe / Global', url: 'https://rss.dw.com/xml/rss-en-all' },
  { name: 'France 24', tier: 'Regional Perspective', region: 'Europe / Africa / Global', url: 'https://www.france24.com/en/rss' },
  { name: 'The Guardian', tier: 'Regional Perspective', region: 'Global / UK', url: 'https://www.theguardian.com/world/rss' },
  { name: 'ABC Australia', tier: 'Regional Perspective', region: 'Indo-Pacific', url: 'https://www.abc.net.au/news/feed/51120/rss.xml' },
  { name: 'RNZ', tier: 'Regional Perspective', region: 'Pacific', url: 'https://www.rnz.co.nz/rss/world.xml' },
  { name: 'NHK World', tier: 'Regional Perspective', region: 'Japan / Asia', url: 'https://www3.nhk.or.jp/nhkworld/en/news/rss.xml' },

  // Regional sources that help surface stories outside the main Western wire cycle
  { name: 'AllAfrica', tier: 'Regional Perspective', region: 'Africa', url: 'https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf' },
  { name: 'The Hindu', tier: 'Regional Perspective', region: 'South Asia', url: 'https://www.thehindu.com/news/international/feeder/default.rss' },
  { name: 'South China Morning Post', tier: 'Regional Perspective', region: 'Asia', url: 'https://www.scmp.com/rss/91/feed' },
  { name: 'Nikkei Asia', tier: 'Regional Perspective', region: 'Asia / Business', url: 'https://asia.nikkei.com/rss/feed/nar' },
  { name: 'Times of Israel', tier: 'Regional Perspective', region: 'Middle East', url: 'https://www.timesofisrael.com/feed/' },

  // Institutions and primary-signal sources
  { name: 'UN News', tier: 'Institutional / Primary', region: 'Global', url: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml' },
  { name: 'WHO', tier: 'Institutional / Primary', region: 'Global Health', url: 'https://www.who.int/rss-feeds/news-english.xml' },

  // Specialist signals
  { name: 'Carbon Brief', tier: 'Climate / Environment', region: 'Global', url: 'https://www.carbonbrief.org/feed/' },
  { name: 'Mongabay', tier: 'Climate / Environment', region: 'Global', url: 'https://news.mongabay.com/feed/' },
  { name: 'BleepingComputer', tier: 'Technology / Cyber', region: 'Global', url: 'https://www.bleepingcomputer.com/feed/' },
  { name: 'The Hacker News', tier: 'Technology / Cyber', region: 'Global', url: 'https://feeds.feedburner.com/TheHackersNews' },
  { name: 'Maritime Executive', tier: 'Logistics / Maritime', region: 'Global', url: 'https://maritime-executive.com/rss' },
  { name: 'NASA', tier: 'Space / Science', region: 'Global', url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss' },
  { name: 'ESA', tier: 'Space / Science', region: 'Europe / Space', url: 'https://www.esa.int/rssfeed/Our_Activities' },
]
const MAX_PER_FEED = 12
const MAX_TOTAL = 180

function decodeXml(str = '') {
  return String(str)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;|&#34;|&#x22;/gi, '"')
    .replace(/&apos;|&#39;|&#x27;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
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

function parseRss(xml, feed) {
  const feedName = typeof feed === 'string' ? feed : feed.name
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
      tags: [...categories, feed.tier, feed.region].filter(Boolean),
      tier: feed.tier,
      region: feed.region,
    }
  }).filter(x => x.title && x.url)
}

function pickAtomLink(entry) {
  const m = entry.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i)
  return absoluteLink(decodeXml(m?.[1] || ''))
}

function parseAtom(xml, feed) {
  const entries = [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)]
  return entries.slice(0, MAX_PER_FEED).map((m, idx) => {
    const entry = m[0]
    const title = pick('title', entry)
    const link = pickAtomLink(entry) || absoluteLink(pick('link', entry))
    const updated = pick('updated', entry) || pick('published', entry)
    const description = pick('summary', entry) || pick('content', entry)
    const id = pick('id', entry) || `${feed.name}:${idx}:${link || title}`
    return {
      id,
      title,
      url: link,
      source: feed.name,
      publishedAt: updated,
      description,
      tags: [feed.tier, feed.region].filter(Boolean),
      tier: feed.tier,
      region: feed.region,
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
      const parsed = parseRss(xml, feed)
      return parsed.length ? parsed : parseAtom(xml, feed)
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
        sources: FEEDS.map(({ name, tier, region }) => ({ name, tier, region })),
      }))
    }

    res.status(200)
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.setHeader('cache-control', 's-maxage=300, stale-while-revalidate=900')
    res.setHeader('access-control-allow-origin', '*')
    res.send(JSON.stringify({ items: sorted, warnings, sources: FEEDS.map(({ name, tier, region }) => ({ name, tier, region })) }))
  } catch (err) {
    res.status(500).json({
      error: 'World news RSS proxy failed',
      details: err instanceof Error ? err.message : String(err),
    })
  }
}
