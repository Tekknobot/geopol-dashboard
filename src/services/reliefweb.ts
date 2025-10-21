// src/services/reliefweb.ts
// UNOCHA ReliefWeb reports

import { fetchJson } from "./http";

export type ReliefWebItem = {
  id: number | string;
  fields: {
    title: string;
    url: string;
    date: { created: string };
    country?: { name: string }[];
    theme?: { name: string }[];
    disaster_type?: { name: string }[];
    format?: { name: string }[];
  };
};

const RW_BASE = "https://api.reliefweb.int/v1";

/**
 * Fetch latest published reports. Limit default 12.
 * Uses fields projection to keep payload small.
 */
export async function getLatestReports(limit = 12, cacheMs = 1000 * 60 * 10) {
  const body = {
    appname: "geo-hum-ssr", // change to your app name if you want
    limit,
    sort: ["date:desc"],
    preset: "latest",
    filter: {
      operator: "AND",
      conditions: [
        { field: "status", value: "published" },
      ],
    },
    fields: {
      include: [
        "title",
        "url",
        "date.created",
        "country.name",
        "theme.name",
        "disaster_type.name",
        "format.name",
      ],
    },
  };

  const url = `${RW_BASE}/reports?${new URLSearchParams({ profile: "minimal" })}`;
  // ReliefWeb API accepts POST for complex filters, but GET also works with query JSON.
  // Use POST to avoid extra-long URLs.
  const key = `rw:reports:${limit}`;

  // We’ll call fetchJson on a synthetic endpoint by stringifying the POST request into the cache key.
  // Since fetchJson only does GET, we’ll perform our own fetch here but still leverage cache via http.ts idea:
  // For simplicity, do a small wrapper:

  const raw = await (async () => {
    // Manual fetch with timeout leveraging http.ts patterns
    const { timeoutMs = 12000, retries = 2 } = { timeoutMs: 12000, retries: 2 };
    let lastErr: any;
    for (let i = 0; i <= retries; i++) {
      const controller = new AbortController();
      const to = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!res.ok) {
          if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
          throw new Error(`HTTP ${res.status}`);
        }
        const json = (await res.json()) as unknown;
        return json;
      } catch (e: any) {
        lastErr = e;
        if (e?.name === "AbortError") break;
        const msg = String(e?.message || "");
        if (msg.includes("HTTP 4")) break;
        // backoff + jitter
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, i) * (0.7 + Math.random() * 0.6)));
      } finally {
        clearTimeout(to);
      }
    }
    throw lastErr ?? new Error("ReliefWeb request failed");
  })();

  // Minimal transform + cache via localStorage
  const data = (raw as any)?.data ?? [];
  try {
    // localStorage cache (namespaced)
    const { setCache } = await import("./cache");
    setCache<ReliefWebItem[]>(key, data);
  } catch {}
  return data as ReliefWebItem[];
}
