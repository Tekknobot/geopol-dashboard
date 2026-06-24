const API_BASE = ((import.meta as any)?.env?.VITE_API_BASE || '').replace(/\/$/, '')

export function apiPath(path: string) {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE}${normalized}`
}

export function proxyUrl(endpoint: 'restcountries' | 'worldbank', upstreamPath: string, params?: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams({ path: upstreamPath })
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null) search.set(key, String(value))
  }
  return apiPath(`/api/${endpoint}?${search.toString()}`)
}
