import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const MAX_TEXTS = 32;
const MAX_TEXT_LENGTH = 1200;
const MAX_TOTAL_LENGTH = 12000;
const tamilPattern = /[\u0B80-\u0BFF]/;
const cache = new Map<string, string>();

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_LENGTH) : "";
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function translateWithGoogleCloud(texts: string[], apiKey: string): Promise<string[] | null> {
  try {
    const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ q: texts, target: "ta", format: "text" }),
    });
    if (!response.ok) return null;
    const payload = await response.json() as { data?: { translations?: Array<{ translatedText?: string }> } };
    const translated = payload.data?.translations?.map((item) => decodeHtmlEntities(item.translatedText ?? "")) ?? [];
    return translated.length === texts.length ? translated : null;
  } catch {
    return null;
  }
}

async function translateUnofficialOne(text: string): Promise<string> {
  try {
    const params = new URLSearchParams({ client: "gtx", sl: "auto", tl: "ta", dt: "t", dj: "1", q: text });
    const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params.toString()}`, {
      headers: { "accept": "application/json,text/plain,*/*" },
    });
    if (!response.ok) return text;
    const payload = await response.json() as { sentences?: Array<{ trans?: string }> };
    const translated = payload.sentences?.map((sentence) => sentence.trans ?? "").join("").trim();
    return translated || text;
  } catch {
    return text;
  }
}

async function translateWithUnofficialGoogle(texts: string[]): Promise<string[]> {
  const results = new Array<string>(texts.length);
  let cursor = 0;
  const workerCount = Math.min(6, texts.length);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (cursor < texts.length) {
      const index = cursor++;
      results[index] = await translateUnofficialOne(texts[index]);
    }
  }));
  return results;
}

async function translateTexts(texts: string[]): Promise<string[]> {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY?.trim();
  if (apiKey) {
    const official = await translateWithGoogleCloud(texts, apiKey);
    if (official) return official;
  }
  return translateWithUnofficialGoogle(texts);
}

export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const body = raw && typeof raw === "object" ? raw as { texts?: unknown } : {};
  if (!Array.isArray(body.texts)) {
    return NextResponse.json({ error: "texts must be an array" }, { status: 400 });
  }

  const texts = body.texts.slice(0, MAX_TEXTS).map(normalizeText).filter(Boolean);
  let total = 0;
  const accepted: string[] = [];
  for (const text of texts) {
    if (total + text.length > MAX_TOTAL_LENGTH) break;
    accepted.push(text);
    total += text.length;
  }

  const missing: string[] = [];
  for (const text of accepted) {
    if (tamilPattern.test(text)) cache.set(text, text);
    else if (!cache.has(text)) missing.push(text);
  }

  if (missing.length) {
    const translated = await translateTexts(missing);
    missing.forEach((text, index) => cache.set(text, translated[index] || text));
    if (cache.size > 5000) {
      const oldest = cache.keys().next().value as string | undefined;
      if (oldest) cache.delete(oldest);
    }
  }

  return NextResponse.json({
    translations: accepted.map((text) => ({ source: text, translated: cache.get(text) ?? text })),
    target: "ta-LK",
    provider: process.env.GOOGLE_TRANSLATE_API_KEY ? "google-cloud" : "google-web-fallback",
  }, {
    headers: { "cache-control": "private, max-age=300" },
  });
}
