import { defineHandler, getQuery } from 'nitro/h3'

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

  const upstream = await fetch(`https://api.gdeltproject.org/${path}?${qs.toString()}`, {
    headers: { 'User-Agent': 'geopol-dashboard/1.0' },
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