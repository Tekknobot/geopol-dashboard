
type CacheEntry<T> = { t: number; v: T }

export function setCache<T>(key: string, value: T) {
  try {
    const entry: CacheEntry<T> = { t: Date.now(), v: value }
    localStorage.setItem(key, JSON.stringify(entry))
  } catch {}
}

export function getCache<T>(key: string, maxAgeMs: number): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry<T>
    if (Date.now() - entry.t > maxAgeMs) return null
    return entry.v as T
  } catch { return null }
}
