// src/services/http.ts
// Centralized fetch helper with timeout, retry, jitter, localStorage caching, and in-flight request de-dup.

import { getCache, setCache } from "./cache";

export type FetchJsonOptions<T> = {
  /** Cache max age. If provided, a fresh cache hit is returned immediately. */
  maxAgeMs?: number;
  /** Custom cache key. Defaults to URL for GETs. */
  cacheKey?: string;
  /** Abort after timeoutMs. Default 12000ms. */
  timeoutMs?: number;
  /** Number of retries on network/5xx. Default 2 (i.e., 3 total attempts). */
  retries?: number;
  /** Extra headers to merge. */
  headers?: HeadersInit;
  /** A function to transform the parsed JSON before caching/returning. */
  map?: (json: unknown) => T;
};

/** In-flight de-dup map so identical calls share a single network request */
const inFlight = new Map<string, Promise<any>>();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function jitter(base: number) {
  // +/- 30% jitter
  const delta = base * 0.3;
  return base - delta + Math.random() * (2 * delta);
}

function buildKey(url: string, opt?: FetchJsonOptions<any>) {
  return opt?.cacheKey || url;
}

/**
 * Fetch JSON with:
 * - AbortController timeout
 * - Exponential backoff retry (network errors + 5xx)
 * - LocalStorage cache (if maxAgeMs set)
 * - In-flight de-duplication by key
 */
export async function fetchJson<T = any>(
  url: string,
  opt: FetchJsonOptions<T> = {}
): Promise<T> {
  const {
    maxAgeMs,
    timeoutMs = 12000,
    retries = 2,
    headers,
    map,
  } = opt;
  const key = buildKey(url, opt);

  // Serve from cache if allowed and fresh
  if (typeof maxAgeMs === "number") {
    const hit = getCache<T>(key, maxAgeMs);
    if (hit !== null) return hit;
  }

  // If a request for this key is in-flight, reuse it
  if (inFlight.has(key)) {
    return inFlight.get(key)! as Promise<T>;
  }

  // Define the actual request with retry
  const attempt = async (): Promise<T> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal,
      });
      if (!res.ok) {
        // Retry on 5xx; throw immediately on 4xx
        if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
        throw new Error(`HTTP ${res.status}`);
      }
      const json = (await res.json()) as unknown;
      const out = (map ? map(json) : (json as T)) as T;

      // Cache success if requested
      if (typeof maxAgeMs === "number") setCache<T>(key, out);
      return out;
    } finally {
      clearTimeout(timeout);
    }
  };

  // Run with retries and backoff
  const p = (async () => {
    let lastErr: any;
    for (let i = 0; i <= retries; i++) {
      try {
        const result = await attempt();
        return result;
      } catch (err: any) {
        lastErr = err;
        // If aborted or 4xx we do not retry
        if (err?.name === "AbortError") break;
        const msg = String(err?.message || "");
        if (msg.includes("HTTP 4")) break;
        if (i < retries) await sleep(jitter(500 * Math.pow(2, i)));
      }
    }
    throw lastErr ?? new Error("Request failed");
  })();

  inFlight.set(key, p);
  try {
    const result = await p;
    return result as T;
  } finally {
    inFlight.delete(key);
  }
}
