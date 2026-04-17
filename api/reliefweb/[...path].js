function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body) {
    try { return JSON.parse(req.body); } catch { return req.body; }
  }
  return undefined;
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const pathParam = req.query?.path;
    const targetPath = Array.isArray(pathParam) ? pathParam.join('/') : String(pathParam || '');

    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query || {})) {
      if (key === 'path') continue;
      if (Array.isArray(value)) {
        for (const v of value) if (v != null) qs.append(key, String(v));
      } else if (value != null) {
        qs.append(key, String(value));
      }
    }

    const url = `https://api.reliefweb.int/${targetPath}${qs.toString() ? `?${qs.toString()}` : ''}`;
    const method = (req.method || 'GET').toUpperCase();
    const body = method === 'GET' || method === 'HEAD' ? undefined : await readJsonBody(req);

    const upstream = await fetch(url, {
      method,
      headers: {
        'User-Agent': 'geopol-dashboard/1.0',
        'Accept': req.headers.accept || 'application/json, text/plain;q=0.9,*/*;q=0.8',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const bodyText = await upstream.text();
    const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8';

    res.status(upstream.status);
    res.setHeader('Content-Type', contentType);
    return res.send(bodyText);
  } catch (err) {
    return res.status(500).json({
      error: 'Proxy request failed',
      details: err instanceof Error ? err.message : String(err),
    });
  }
}
