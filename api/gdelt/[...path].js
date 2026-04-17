export default async function handler(req, res) {
  try {
    const pathParts = Array.isArray(req.query?.path)
      ? req.query.path
      : req.query?.path
        ? [req.query.path]
        : []

    const path = pathParts.join('/')
    const params = new URLSearchParams()

    for (const [key, value] of Object.entries(req.query || {})) {
      if (key === 'path') continue
      if (Array.isArray(value)) {
        for (const v of value) params.append(key, String(v))
      } else if (value != null) {
        params.append(key, String(value))
      }
    }

    const url = `https://api.gdeltproject.org/${path}${params.toString() ? `?${params.toString()}` : ''}`
    const upstream = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'geopol-dashboard/1.0',
        'Accept': 'application/json, text/plain;q=0.9,*/*;q=0.8',
      },
    })

    const text = await upstream.text()
    res.status(upstream.status)
    res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json; charset=utf-8')
    res.setHeader('access-control-allow-origin', '*')
    res.send(text)
  } catch (err) {
    res.status(500).json({ error: 'GDELT proxy failed', details: err instanceof Error ? err.message : String(err) })
  }
}
