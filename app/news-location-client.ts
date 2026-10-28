/** Resolve the reader's approximate country once per page session.
 * No GPS permission and no third-party location service are used.
 * Query-keyed country codes keep CDN caches separate across readers.
 */
let viewerCountryPromise: Promise<string> | undefined;

async function getCountry(): Promise<string> {
  try {
    const response = await fetch("/api/news/viewer", { cache: "no-store" });
    if (!response.ok) return "GLOBAL";
    const payload: unknown = await response.json();
    const country = payload && typeof payload === "object" && "countryCode" in payload
      ? (payload as { countryCode?: unknown }).countryCode
      : null;
    return typeof country === "string" && /^[A-Z]{2}$/.test(country) ? country : "GLOBAL";
  } catch {
    return "GLOBAL";
  }
}

export async function newsUrl(desk?: "sports" | "entertainment"): Promise<string> {
  viewerCountryPromise ??= getCountry();
  const country = await viewerCountryPromise;
  const params = new URLSearchParams({ country });
  if (desk) params.set("desk", desk);
  return `/api/news?${params}`;
}
