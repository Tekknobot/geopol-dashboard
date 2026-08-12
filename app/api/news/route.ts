import { XMLParser } from "fast-xml-parser";

export const runtime = "edge";

type FeedDefinition = {
  source: string;
  url: string;
};

type FeedStory = {
  id: number;
  category: string;
  region: string;
  publishedAt: string;
  level: "critical" | "elevated" | "watch" | "stable";
  title: string;
  summary: string;
  source: string;
  read: string;
  tags: string[];
  articleUrl: string;
  imageUrl?: string;
};

const feeds: FeedDefinition[] = [
  { source: "BBC News", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { source: "BBC News", url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
  { source: "BBC News", url: "https://feeds.bbci.co.uk/news/technology/rss.xml" },
  { source: "The Guardian", url: "https://www.theguardian.com/world/rss" },
  { source: "The Guardian", url: "https://www.theguardian.com/business/rss" },
  { source: "The Guardian", url: "https://www.theguardian.com/environment/rss" },
  { source: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
  { source: "UN News", url: "https://news.un.org/feed/subscribe/en/news/all/rss.xml" },
  { source: "NPR", url: "https://feeds.npr.org/1004/rss.xml" },
  { source: "POLITICO Europe", url: "https://www.politico.eu/feed/" },
  { source: "DW", url: "https://rss.dw.com/rdf/rss-en-all" },
  { source: "France 24", url: "https://www.france24.com/en/rss" },
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false,
});

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
const list = <T,>(value: T | T[] | undefined): T[] => value === undefined ? [] : Array.isArray(value) ? value : [value];
const text = (value: unknown): string => {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value && typeof value === "object" && "#text" in value) return text((value as {"#text": unknown})["#text"]);
  return "";
};
const namedEntities: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: "\"",
};
const decodeEntityPass = (value: string) => value
  .replace(/&#(x[\da-f]+|\d+);?/gi, (entity, code: string) => {
    const point = code[0].toLowerCase() === "x" ? Number.parseInt(code.slice(1), 16) : Number.parseInt(code, 10);
    return Number.isInteger(point) && point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
      ? String.fromCodePoint(point)
      : entity;
  })
  .replace(/&(amp|apos|gt|lt|nbsp|quot);/gi, (entity, name: string) => namedEntities[name.toLowerCase()] ?? entity);
const decodeEntities = (value: string) => {
  let decoded = value;
  for (let pass = 0; pass < 3; pass += 1) {
    const next = decodeEntityPass(decoded);
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
};
const clean = (value: unknown) => decodeEntities(text(value).replace(/<[^>]+>/g, " "))
  .replace(/\s+/g, " ")
  .replace(/^#{1,6}\s+/, "")
  .trim();
const firstImage = (html: string) => html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
const validHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
};
const hash = (value: string) => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
};

const categoryRules: Array<[FeedStory["category"], RegExp]> = [
  ["Security", /war|military|missile|defen[cs]e|security|attack|conflict|troops|weapon|navy|army|ceasefire/i],
  ["Diplomacy", /summit|minister|president|election|diplomat|talks|negotiat|sanction|treaty|government|parliament/i],
  ["Energy", /oil|gas|energy|power|electric|nuclear|solar|wind|pipeline|opec/i],
  ["Trade", /trade|tariff|shipping|port|export|import|supply chain|freight|canal/i],
  ["Technology", /technology|cyber|chip|semiconductor|ai\b|internet|telecom|satellite|digital/i],
  ["Climate", /climate|flood|storm|drought|wildfire|weather|emission|environment|earthquake|hurricane/i],
  ["Economy", /econom|market|inflation|rate|bank|finance|currency|jobs|gdp|business/i],
];
const regionRules: Array<[FeedStory["region"], RegExp]> = [
  ["Middle East", /iran|iraq|israel|gaza|lebanon|syria|yemen|saudi|qatar|emirates|jordan|hormuz|red sea|middle east/i],
  ["Europe", /europe|ukraine|russia|britain|uk\b|france|germany|italy|spain|poland|nato|eu\b|balkan|black sea/i],
  ["Asia Pacific", /china|taiwan|japan|korea|india|pakistan|indonesia|philippines|australia|pacific|asia|asean/i],
  ["Africa", /africa|sudan|congo|sahel|ethiopia|somalia|kenya|nigeria|south africa|libya|egypt/i],
  ["Americas", /united states|u\.s\.|usa|canada|mexico|brazil|argentina|colombia|venezuela|caribbean|america/i],
];
const categoryFor = (value: string) => categoryRules.find(([, rule]) => rule.test(value))?.[0] ?? "Diplomacy";
const regionFor = (value: string) => regionRules.find(([, rule]) => rule.test(value))?.[0] ?? "Global";
const levelFor = (value: string): FeedStory["level"] => /war|attack|missile|killed|earthquake|emergency|invasion/i.test(value) ? "critical" : /sanction|military|conflict|crisis|flood|wildfire|tariff/i.test(value) ? "elevated" : /talks|election|trade|market|climate|security/i.test(value) ? "watch" : "stable";
const tagsFor = (value: string, category: string, region: string) => {
  const stop = new Set(["about","after","against","amid","from","have","into","over","says","that","their","this","with","world"]);
  const words = value.toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? [];
  return [...new Set([category.toLowerCase(), region.toLowerCase(), ...words.filter((word) => !stop.has(word))])].slice(0, 6);
};

function articleLink(item: Record<string, unknown>) {
  const links = list(item.link as unknown).flatMap((entry) => {
    if (typeof entry === "string") return [entry];
    if (entry && typeof entry === "object") {
      const record = entry as Record<string, unknown>;
      if (record["@rel"] && record["@rel"] !== "alternate") return [];
      return [text(record["@href"] ?? record["#text"])];
    }
    return [];
  });
  return links.find(validHttpUrl) ?? "";
}

function imageLink(item: Record<string, unknown>, rawDescription: string) {
  const candidates = [item.thumbnail, item.content, item.enclosure]
    .flatMap((entry) => list(entry as unknown))
    .flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const record = entry as Record<string, unknown>;
      const type = text(record["@type"]);
      const medium = text(record["@medium"]);
      const url = text(record["@url"] ?? record["@href"]);
      return (!type || type.startsWith("image/") || medium === "image") ? [url] : [];
    });
  return [...candidates, firstImage(rawDescription) ?? ""].find(validHttpUrl);
}

export function parseFeed(xml: string, feed: FeedDefinition): FeedStory[] {
  const document = record(parser.parse(xml));
  const rssChannel = record(record(document.rss).channel);
  const atomFeed = record(document.feed);
  const rdfFeed = record(document.RDF);
  const items = [
    ...list(rssChannel.item),
    ...list(atomFeed.entry),
    ...list(rdfFeed.item),
  ] as Array<Record<string, unknown>>;

  return items.flatMap((item) => {
    const title = clean(item.title);
    const articleUrl = articleLink(item);
    const rawDescription = text(item.description ?? item.summary ?? item.content ?? "");
    const summary = clean(rawDescription).slice(0, 340);
    const rawDate = text(item.pubDate ?? item.published ?? item.updated ?? item.date);
    const timestamp = Date.parse(rawDate);
    if (!title || !articleUrl || !Number.isFinite(timestamp)) return [];
    const combined = `${title} ${summary}`;
    const category = categoryFor(combined);
    const region = regionFor(combined);
    const wordCount = `${title} ${summary}`.split(/\s+/).length;
    return [{
      id: hash(articleUrl),
      category,
      region,
      publishedAt: new Date(timestamp).toISOString(),
      level: levelFor(combined),
      title,
      summary: summary || "Open the original report for the publisher's full coverage.",
      source: feed.source,
      read: `${Math.max(2, Math.ceil(wordCount / 45))} min`,
      tags: tagsFor(title, category, region),
      articleUrl,
      imageUrl: imageLink(item, rawDescription),
    }];
  });
}

async function loadFeed(feed: FeedDefinition) {
  const response = await fetch(feed.url, {
    headers: { "User-Agent": "AtlasWorldNews/1.0 (+news dashboard feed reader)" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`${feed.source}: ${response.status}`);
  return parseFeed(await response.text(), feed);
}

export async function GET() {
  const results = await Promise.allSettled(feeds.map(loadFeed));
  const stories = results
    .flatMap((result) => result.status === "fulfilled" ? result.value : [])
    .filter((story, index, all) => all.findIndex((candidate) => candidate.articleUrl === story.articleUrl) === index)
    .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt))
    .slice(0, 180);
  const sources = [...new Set(stories.map((story) => story.source))];
  const failedFeeds = results.filter((result) => result.status === "rejected").length;

  return Response.json(
    { stories, sources, fetchedAt: new Date().toISOString(), failedFeeds, totalFeeds: feeds.length },
    {
      status: stories.length ? 200 : 503,
      headers: { "Cache-Control": "public, max-age=120, s-maxage=300, stale-while-revalidate=900" },
    },
  );
}
