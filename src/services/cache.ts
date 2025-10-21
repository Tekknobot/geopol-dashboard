// src/services/cache.ts
// Tiny, resilient JSON cache backed by localStorage.

type CacheEntry<T> = { t: number; v: T };
const NS = "appcache:"; // namespace to avoid collisions

function k(key: string) {
  return `${NS}${key}`;
}

export function setCache<T>(key: string, value: T) {
  try {
    const entry: CacheEntry<T> = { t: Date.now(), v: value };
    localStorage.setItem(k(key), JSON.stringify(entry));
  } catch {
    // ignore quota or serialization errors
  }
}

/**
 * Read and validate a cache entry.
 * Returns null if not found or stale or unparsable.
 */
export function getCache<T>(key: string, maxAgeMs: number): T | null {
  try {
    const raw = localStorage.getItem(k(key));
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (typeof entry?.t !== "number" || !("v" in entry)) return null;
    if (Date.now() - entry.t > maxAgeMs) return null;
    return entry.v as T;
  } catch {
    return null;
  }
}

/** Remove a specific cache key */
export function clearCache(key: string) {
  try {
    localStorage.removeItem(k(key));
  } catch {}
}

/** (Optional) wipe all keys in this namespace */
export function clearAllCache() {
  try {
    const toDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const kk = localStorage.key(i);
      if (kk && kk.startsWith(NS)) toDelete.push(kk);
    }
    toDelete.forEach((kk) => localStorage.removeItem(kk));
  } catch {}
}
