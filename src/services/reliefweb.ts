// src/services/reliefweb.ts
// UNOCHA ReliefWeb reports via same-origin proxy.

import { setCache } from "./cache";

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

const RW_BASE = ((import.meta as any)?.env?.VITE_RELIEFWEB_PROXY_URL || "/api/reliefweb") + "/v2";

function appName() {
  const explicit = (import.meta as any)?.env?.VITE_RELIEFWEB_APPNAME;
  if (explicit) return explicit;
  if (typeof window !== "undefined" && window.location?.hostname) return window.location.hostname;
  return "geopol-dashboard";
}

/**
 * Fetch latest published reports. Limit default 12.
 * Uses fields projection to keep payload small.
 */
export async function getLatestReports(limit = 12, cacheMs = 1000 * 60 * 10) {
  const body = {
    limit,
    sort: ["date.created:desc"],
    filter: {
      operator: "AND",
      conditions: [{ field: "status", value: "published" }],
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

  const url = `${RW_BASE}/reports?${new URLSearchParams({
    profile: "minimal",
    appname: appName(),
  }).toString()}`;

  const key = `rw:reports:${limit}`;
  const timeoutMs = 12000, retries = 2;
  let lastErr: any;

  for (let i = 0; i <= retries; i++) {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status}`);
        if (res.status >= 500) throw err;
        throw err;
      }
      const raw = await res.json();
      const data = (raw as any)?.data ?? [];
      setCache<ReliefWebItem[]>(key, data);
      return data as ReliefWebItem[];
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
}
