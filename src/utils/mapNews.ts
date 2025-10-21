// src/utils/mapNews.ts
import type { EonetEvent } from "../services/eonet";
import type { MapNewsItem } from "../components/MapCore";

/**
 * Convert EONET events to the same "news" shape the map emits.
 * This lets the Dashboard show headlines immediately, even before the map mounts.
 */
export function eventsToMapNews(events: EonetEvent[]): MapNewsItem[] {
  const out: MapNewsItem[] = [];
  for (const e of events || []) {
    const coord = e.geometry?.[0]?.coordinates;
    const [lon, lat] = Array.isArray(coord) && coord.length >= 2 ? coord as [number, number] : [undefined, undefined];
    const url = e.link || "";
    let host = "source";
    try { host = new URL(url).hostname.replace(/^www\./, ""); } catch {}

    out.push({
      id: e.id,
      headline: e.title || "Event",
      url,
      source: host,
      category: e.categories?.[0]?.title || "Event",
      lat: typeof lat === "number" ? lat : 0,
      lon: typeof lon === "number" ? lon : 0,
    });
  }
  return out;
}
