export default async function handler(req, res) {
  try {
    const path = String(req.query?.path || '').replace(/^\/+/, '')
    if (!path || !path.startsWith('v3.1/')) {
      res.status(400).json({ error: 'Missing or invalid REST Countries path' })
      return
    }

    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(req.query || {})) {
      if (key === 'path') continue
      if (Array.isArray(value)) value.forEach(v => params.append(key, String(v)))
      else if (value != null) params.append(key, String(value))
    }

    const url = `https://restcountries.com/${path}${params.toString() ? `?${params.toString()}` : ''}`
    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'geopol-dashboard/1.0',
        'Accept': 'application/json',
      },
    })

    const text = await upstream.text()
    res.status(upstream.status)
    res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json; charset=utf-8')
    res.setHeader('cache-control', 's-maxage=86400, stale-while-revalidate=604800')
    res.setHeader('access-control-allow-origin', '*')
    res.send(text)
  } catch (err) {
    res.status(500).json({
      error: 'REST Countries proxy failed',
      details: err instanceof Error ? err.message : String(err),
    })
  }
}
