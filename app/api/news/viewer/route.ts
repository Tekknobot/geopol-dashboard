import { viewerFromRequest } from "../viewer-country";

export const runtime = "edge";

export async function GET(request: Request) {
  const viewer = viewerFromRequest(request);
  return Response.json({ countryCode: viewer?.countryCode ?? null, region: viewer?.region ?? null }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
