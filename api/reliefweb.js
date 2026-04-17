export default async function handler(req, res) {
  try {
    const params = new URLSearchParams()

    for (const [key, value] of Object.entries(req.query || {})) {
      if (Array.isArray(value)) {
        for (const v of value) params.append(key, String(v))
      } else if (value != null) {
        params.append(key, String(value))
      }
    }

    const url = `https://api.reliefweb.int/v2/reports?${params.toString()}`
    const method = req.method || 'GET'
    const body = method !== 'GET' && method !== 'HEAD' ? req.body : undefined

    const upstream = await fetch(url, {
      method,
      headers: {
        'User-Agent': 'geopol-dashboard/1.0',
        'Accept': 'application/json, text/plain;q=0.9,*/*;q=0.8',
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    const text = await upstream.text()
    res.status(upstream.status)
    res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json; charset=utf-8')
    res.setHeader('access-control-allow-origin', '*')
    res.send(text)
  } catch (err) {
    res.status(500).json({
      error: 'ReliefWeb proxy failed',
      details: err instanceof Error ? err.message : String(err),
    })
  }
}