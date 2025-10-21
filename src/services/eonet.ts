// src/services/eonet.ts
// NASA EONET v3

import { fetchJson } from "./http";

export type EonetEvent = {
  id: string;
  title: string;
  link: string;
  geometry: { coordinates: [number, number] }[];
  categories: { id: number; title: string }[];
};

const EONET = "https://eonet.gsfc.nasa.gov/api/v3";

export async function getOpenEvents(cacheMs = 1000 * 60 * 5): Promise<EonetEvent[]> {
  const url = `${EONET}/events?status=open`;
  const data = await fetchJson<{ events: EonetEvent[] }>(url, {
    maxAgeMs: cacheMs,
    cacheKey: `eonet:open`,
    retries: 2,
    timeoutMs: 12000,
  });
  return data?.events || [];
}
