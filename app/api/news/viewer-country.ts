import { viewerRegionForCountry } from "./location-resolver";
import type { ViewerLocation } from "./headline-personalization";

/** Only use coarse, country-level geolocation supplied by the deployment edge. */
export function viewerFromRequest(request: Request): ViewerLocation | null {
  const cfCountry = (request as Request & { cf?: { country?: string } }).cf?.country;
  const candidates = [
    cfCountry,
    request.headers.get("cf-ipcountry"),
    request.headers.get("x-vercel-ip-country"),
    request.headers.get("cloudfront-viewer-country"),
    request.headers.get("x-nf-country"),
  ];
  for (const candidate of candidates) {
    const code = (candidate ?? "").trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) continue;
    const region = viewerRegionForCountry(code);
    if (region) return { countryCode: code, region };
  }
  return null;
}

export function viewerFromParam(param: string | null): ViewerLocation | null {
  if (!param || param.toUpperCase() === "GLOBAL") return null;
  const code = param.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  const region = viewerRegionForCountry(code);
  return region ? { countryCode: code, region } : null;
}
