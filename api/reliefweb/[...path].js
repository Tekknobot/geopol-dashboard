export default async function handler(req, res) {
  try {
    const rawPath = req.query?.path ?? [];
    const parts = Array.isArray(rawPath) ? rawPath : [rawPath];
    const targetPath = parts.filter(Boolean).join('/');
    if (!targetPath) {
      res.status(400).json({ error: 'Missing ReliefWeb path' });
      return;
    }

    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query || {})) {
      if (key === 'path') continue;
      if (Array.isArray(value)) {
        for (const v of value) if (v != null) qs.append(key, String(v));
      } else if (value != null) {
        qs.append(key, String(value));
      }
    }

    let body;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (typeof req.body === 'string') body = req.body;
      else if (req.body != null) body = JSON.stringify(req.body);
    }

    const url = `https://api.reliefweb.int/${targetPath}${qs.toString() ? `?${qs.toString()}` : ''}`;
    const upstream = await fetch(url, {
      method: req.method || 'GET',
      headers: {
        'accept': req.headers.accept || 'application/json, text/plain;q=0.9,*/*;q=0.8',
        'content-type': req.headers['content-type'] || 'application/json',
        'user-agent': 'geopol-dashboard-vercel-proxy/1.0'
      },
      body
    });

    const responseBody = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
    res.send(responseBody);
  } catch (error) {
    res.status(500).json({
      error: 'ReliefWeb proxy request failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
