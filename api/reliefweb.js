export default async function handler(req, res) {
  try {
    // Forward query parameters
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

    let body = undefined

    if (method !== 'GET' && method !== 'HEAD') {
      // IMPORTANT: do NOT double stringify
      if (typeof req.body === 'string') {
        body = req.body
      } else if (req.body) {
        body = JSON.stringify(req.body)
      }
    }

    const upstream = await fetch(url, {
      method,
      headers: {
        'User-Agent': 'geopol-dashboard/1.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body,
    })

    const text = await upstream.text()

    res.status(upstream.status)

    res.setHeader(
      'content-type',
      upstream.headers.get('content-type') ||
        'application/json; charset=utf-8'
    )

    res.setHeader('access-control-allow-origin', '*')

    res.send(text)

  } catch (err) {
    res.status(500).json({
      error: 'ReliefWeb proxy failed',
      details: err instanceof Error ? err.message : String(err),
    })
  }
}