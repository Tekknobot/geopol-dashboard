// src/services/reliefweb.ts
// UNOCHA ReliefWeb reports.

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
    limit,
    sort: ["date:desc"],
    filter: {
      operator: "AND",
      conditions: [{ field: "status", value: "published" }],
    },
    fields: {
      include: [
        "title",
        "url",           // public article URL
        "date.created",
        "country.name",
        "theme.name",
        "disaster_type.name",
        "format.name",
      ],
    },
  };

  // ✅ put appname on the querystring; keep profile=minimal
  const url = `${RW_BASE}/reports?${new URLSearchParams({
    profile: "minimal",
    appname: "geo-hum-ssr",
  }).toString()}`;

  const key = `rw:reports:${limit}`;

  const raw = await (async () => {
    const timeoutMs = 12000, retries = 2;
    let lastErr: any;
    for (let i = 0; i <= retries; i++) {
      const controller = new AbortController();
      const to = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),      // ✅ no "preset" here
          signal: controller.signal,
        });
        if (!res.ok) {
          // 4xx: don't retry; 5xx: retry
          const err = new Error(`HTTP ${res.status}`);
          if (res.status >= 500) throw err;
          throw err;
        }
        return await res.json();
      } catch (e: any) {
        lastErr = e;
        if (e?.name === "AbortError") break;
        if (String(e?.message || "").startsWith("HTTP 4")) break;
        await new Promise(r =>
          setTimeout(r, 500 * Math.pow(2, i) * (0.7 + Math.random() * 0.6))
        );
      } finally {
        clearTimeout(to);
      }
    }
    throw lastErr ?? new Error("ReliefWeb request failed");
  })();

  const data = (raw as any)?.data ?? [];

  try {
    const { setCache } = await import("./cache");
    setCache<ReliefWebItem[]>(key, data);
  } catch {}

  return data as ReliefWebItem[];
}
