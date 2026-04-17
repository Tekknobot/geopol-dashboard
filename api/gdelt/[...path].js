function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
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

    const url = `https://api.gdeltproject.org/${targetPath}${qs.toString() ? `?${qs.toString()}` : ''}`;
    const upstream = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'geopol-dashboard/1.0',
        'Accept': req.headers.accept || 'application/json, text/plain;q=0.9,*/*;q=0.8',
      },
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
