import { defineHandler, getQuery, readBody } from 'nitro/h3'

export default defineHandler(async (event) => {
  const path = event.context.params?.path || ''
  const qs = new URLSearchParams()

  const query = getQuery(event)
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const v of value) qs.append(key, String(v))
    } else if (value != null) {
      qs.append(key, String(value))
    }
  }

  const method = event.method || 'GET'
  const body = method !== 'GET' && method !== 'HEAD' ? await readBody(event) : undefined

  const upstream = await fetch(`https://api.reliefweb.int/${path}?${qs.toString()}`, {
    method,
    headers: {
      'User-Agent': 'geopol-dashboard/1.0',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await upstream.text()

  return new Response(text, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') || 'application/json',
      'access-control-allow-origin': '*',
    },
  })
})