export default defineEventHandler(async (event) => {
  const path = getRouterParam(event, 'path') || ''
  const query = getQuery(event)
  const qs = new URLSearchParams()

  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const v of value) qs.append(key, String(v))
    } else if (value != null) {
      qs.append(key, String(value))
    }
  }

  const url = `https://api.gdeltproject.org/${path}?${qs.toString()}`
  const upstream = await fetch(url, {
    headers: {
      'User-Agent': 'geopol-dashboard/1.0',
      'Accept': 'application/json, text/plain;q=0.9,*/*;q=0.8',
    },
  })

  const text = await upstream.text()

  setResponseStatus(event, upstream.status)
  setHeader(event, 'content-type', upstream.headers.get('content-type') || 'application/json')
  setHeader(event, 'access-control-allow-origin', '*')

  return text
})