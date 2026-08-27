import { XMLParser } from "fast-xml-parser";
import { categoryForDesk, type NewsDesk } from "../../news-taxonomy";
import { locationMatchFor, type LocationMatch } from "./location-resolver";

export const runtime = "edge";

type FeedDefinition = {
  source: string;
  url: string;
  desk: NewsDesk;
  countryFocus?: "Canada";
};

type FeedStory = {
  id: number;
  desk: NewsDesk;
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
  countryFocus?: "Canada";
  location?: {
    name: string;
    lat: number;
    lng: number;
    precision: "country" | "hotspot";
  };
};

const feeds: FeedDefinition[] = [
  // Canadian national, regional, business and public-policy coverage. These
  // feeds also receive a representation floor in selectBestHeadlines so they
  // cannot be crowded out by higher-volume international publishers.
  { source: "CBC News", url: "https://www.cbc.ca/cmlink/rss-topstories", desk: "world", countryFocus: "Canada" },
  { source: "CBC News", url: "https://www.cbc.ca/cmlink/rss-canada", desk: "world", countryFocus: "Canada" },
  { source: "CBC News", url: "https://www.cbc.ca/cmlink/rss-politics", desk: "world", countryFocus: "Canada" },
  { source: "CBC News", url: "https://www.cbc.ca/cmlink/rss-business", desk: "world", countryFocus: "Canada" },
  { source: "CBC News", url: "https://www.cbc.ca/cmlink/rss-technology", desk: "world", countryFocus: "Canada" },
  { source: "Global News", url: "https://globalnews.ca/canada/feed/", desk: "world", countryFocus: "Canada" },
  { source: "Global News", url: "https://globalnews.ca/politics/feed/", desk: "world", countryFocus: "Canada" },
  { source: "Global News", url: "https://globalnews.ca/money/feed/", desk: "world", countryFocus: "Canada" },
  { source: "Global News", url: "https://globalnews.ca/environment/feed/", desk: "world", countryFocus: "Canada" },
  { source: "Global News", url: "https://globalnews.ca/toronto/feed/", desk: "world", countryFocus: "Canada" },
  { source: "CTV News", url: "https://www.ctvnews.ca/rss/ctvnews-ca-top-stories-public-rss-1.822009", desk: "world", countryFocus: "Canada" },
  { source: "Canada News Centre", url: "https://www.canada.ca/content/canadasite/en/news/subscribe-emails/national-news.atom.xml", desk: "world", countryFocus: "Canada" },
  { source: "Bank of Canada", url: "https://www.bankofcanada.ca/utility/news/feed/", desk: "world", countryFocus: "Canada" },
  { source: "The Narwhal", url: "https://thenarwhal.ca/feed/", desk: "world", countryFocus: "Canada" },
  { source: "Canada's National Observer", url: "https://www.nationalobserver.com/front/rss", desk: "world", countryFocus: "Canada" },
  { source: "BBC News", url: "https://feeds.bbci.co.uk/news/world/rss.xml", desk: "world" },
  { source: "BBC News", url: "https://feeds.bbci.co.uk/news/business/rss.xml", desk: "world" },
  { source: "BBC News", url: "https://feeds.bbci.co.uk/news/technology/rss.xml", desk: "world" },
  { source: "The Guardian", url: "https://www.theguardian.com/world/rss", desk: "world" },
  { source: "The Guardian", url: "https://www.theguardian.com/business/rss", desk: "world" },
  { source: "The Guardian", url: "https://www.theguardian.com/environment/rss", desk: "world" },
  { source: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", desk: "world" },
  { source: "UN News", url: "https://news.un.org/feed/subscribe/en/news/all/rss.xml", desk: "world" },
  { source: "NPR", url: "https://feeds.npr.org/1004/rss.xml", desk: "world" },
  { source: "POLITICO Europe", url: "https://www.politico.eu/feed/", desk: "world" },
  { source: "DW", url: "https://rss.dw.com/rdf/rss-en-all", desk: "world" },
  { source: "France 24", url: "https://www.france24.com/en/rss", desk: "world" },
  { source: "BBC Culture", url: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml", desk: "entertainment" },
  { source: "The Guardian Culture", url: "https://www.theguardian.com/culture/rss", desk: "entertainment" },
  { source: "The Guardian Film", url: "https://www.theguardian.com/film/rss", desk: "entertainment" },
  { source: "The Guardian Music", url: "https://www.theguardian.com/music/rss", desk: "entertainment" },
  { source: "The Guardian Games", url: "https://www.theguardian.com/games/rss", desk: "entertainment" },
  { source: "NPR Arts & Life", url: "https://feeds.npr.org/1008/rss.xml", desk: "entertainment" },
  { source: "CBC News", url: "https://www.cbc.ca/cmlink/rss-arts", desk: "entertainment", countryFocus: "Canada" },
  { source: "Global News", url: "https://globalnews.ca/entertainment/feed/", desk: "entertainment", countryFocus: "Canada" },
  { source: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/rss.xml", desk: "sports" },
  { source: "The Guardian Sport", url: "https://www.theguardian.com/sport/rss", desk: "sports" },
  { source: "The Guardian Football", url: "https://www.theguardian.com/football/rss", desk: "sports" },
  { source: "ESPN", url: "https://www.espn.com/espn/rss/news", desk: "sports" },
  { source: "CBC News", url: "https://www.cbc.ca/cmlink/rss-sports", desk: "sports", countryFocus: "Canada" },
  { source: "Global News", url: "https://globalnews.ca/sports/feed/", desk: "sports", countryFocus: "Canada" },
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

const regionRules: Array<[FeedStory["region"], RegExp]> = [
  ["Canada", /canada|canadian|ottawa|ontario|qu[eé]bec|british columbia|alberta|saskatchewan|manitoba|nova scotia|new brunswick|newfoundland|labrador|prince edward island|northwest territories|nunavut|yukon|toronto|montreal|vancouver|calgary|edmonton|winnipeg|halifax|regina|saskatoon/i],
  ["Middle East", /iran|iraq|israel|gaza|lebanon|syria|yemen|saudi|qatar|emirates|jordan|hormuz|red sea|middle east/i],
  ["Europe", /europe|ukraine|russia|britain|uk\b|france|germany|italy|spain|poland|nato|eu\b|balkan|black sea/i],
  ["Asia Pacific", /china|taiwan|japan|korea|india|pakistan|indonesia|philippines|australia|pacific|asia|asean/i],
  ["Africa", /africa|sudan|congo|sahel|ethiopia|somalia|kenya|nigeria|south africa|libya|egypt/i],
  ["Americas", /united states|u\.s\.|usa|mexico|brazil|argentina|colombia|venezuela|caribbean|america/i],
];
const regionFor = (value: string,location?:LocationMatch) => regionRules.find(([, rule]) => rule.test(value))?.[0] ?? location?.region ?? "Global";
const levelFor = (value: string,desk:NewsDesk): FeedStory["level"] => {
  if(desk==="sports"){
    if(/event cancelled|match abandoned|serious injury|medical emergency|security incident/i.test(value))return "critical";
    if(/champion|championship|final|wins?|defeats?|title|record/i.test(value))return "elevated";
    if(/live|fixture|schedule|injury|tournament|qualif/i.test(value))return "watch";
    return "stable";
  }
  if(desk==="entertainment"){
    if(/production halted|festival cancelled|medical emergency|security incident/i.test(value))return "critical";
    if(/award|acquisition|merger|strike|cancelled|renewed|box office record/i.test(value))return "elevated";
    if(/release|premiere|trailer|album|tour|streaming|festival/i.test(value))return "watch";
    return "stable";
  }
  return /war|attack|missile|killed|earthquake|emergency|invasion/i.test(value) ? "critical" : /sanction|military|conflict|crisis|flood|wildfire|tariff/i.test(value) ? "elevated" : /talks|election|trade|market|climate|security/i.test(value) ? "watch" : "stable";
};
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
  const group = record(item.group);
  const candidates = [item.thumbnail, item.content, item.enclosure, item.image, group.thumbnail, group.content]
    .flatMap((entry) => list(entry as unknown))
    .flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const record = entry as Record<string, unknown>;
      const type = text(record["@type"]);
      const medium = text(record["@medium"]);
      const url = text(record["@url"] ?? record["@href"]);
      return (!type || type.startsWith("image/") || medium === "image") ? [url] : [];
    });
  const directImage=typeof item.image==="string"?item.image:"";
  return [...candidates,directImage,firstImage(rawDescription)??""].find(validHttpUrl);
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
    const matchedLocation=locationMatchFor(title)??locationMatchFor(summary);
    const category = categoryForDesk(combined, feed.desk);
    const region = regionFor(combined,matchedLocation);
    const wordCount = `${title} ${summary}`.split(/\s+/).length;
    return [{
      id: hash(articleUrl),
      desk: feed.desk,
      category,
      region,
      publishedAt: new Date(timestamp).toISOString(),
      level: levelFor(combined,feed.desk),
      title,
      summary: summary || "Open the original report for the publisher's full coverage.",
      source: feed.source,
      read: `~${Math.max(2, Math.ceil(wordCount / 45))} min`,
      tags: tagsFor(title, category, region),
      articleUrl,
      imageUrl: imageLink(item, rawDescription),
      countryFocus: feed.countryFocus,
      location: matchedLocation?{name:matchedLocation.name,lat:matchedLocation.lat,lng:matchedLocation.lng,precision:matchedLocation.precision}:undefined,
    }];
  });
}

async function loadFeed(feed: FeedDefinition) {
  const response = await fetch(feed.url, {
    headers: { "User-Agent": "AtlasWorldNews/1.0 (+news dashboard feed reader)" },
    signal: AbortSignal.timeout(4500),
  });
  if (!response.ok) throw new Error(`${feed.source}: ${response.status}`);
  return parseFeed(await response.text(), feed);
}

const headlineScore=(story:FeedStory,now:number)=>{
  const ageHours=Math.max(0,(now-Date.parse(story.publishedAt))/3_600_000);
  const recency=Math.max(0,120-ageHours*1.4);
  const completeness=(story.imageUrl?14:0)+(story.summary.length>=120?7:story.summary.length>=60?3:0)+(story.location?4:0);
  const urgency=story.level==="critical"?10:story.level==="elevated"?6:story.level==="watch"?2:0;
  const localRelevance=story.countryFocus==="Canada"?6:0;
  return recency+completeness+urgency+localRelevance;
};

function selectBestHeadlines(candidates:FeedStory[],includeAllDesks:boolean){
  const now=Date.now();
  const byScore=[...candidates].sort((left,right)=>headlineScore(right,now)-headlineScore(left,now)||Date.parse(right.publishedAt)-Date.parse(left.publishedAt));
  const selected:FeedStory[]=[];
  const selectedUrls=new Set<string>();
  const add=(stories:FeedStory[])=>{
    for(const story of stories){
      if(selectedUrls.has(story.articleUrl))continue;
      selected.push(story);
      selectedUrls.add(story.articleUrl);
    }
  };

  // Keep a meaningful Canadian briefing in both the world-only endpoint used
  // by the intelligence map and the combined Best 180 homepage carousel.
  add(byScore.filter((story)=>story.countryFocus==="Canada").slice(0,36));

  if(includeAllDesks){
    // Reserve a small representation floor for every newsroom, then fill the
    // remaining places strictly by score.
    for(const desk of ["world","sports","entertainment"] as const){
      add(byScore.filter((candidate)=>candidate.desk===desk).slice(0,12));
    }
  }

  for(const story of byScore){
    if(selected.length>=180)break;
    if(selectedUrls.has(story.articleUrl))continue;
    selected.push(story);
    selectedUrls.add(story.articleUrl);
  }
  return selected.sort((left,right)=>headlineScore(right,now)-headlineScore(left,now)||Date.parse(right.publishedAt)-Date.parse(left.publishedAt)).slice(0,180);
}

export async function GET(request:Request) {
  const requestedDesk=new URL(request.url).searchParams.get("desk");
  const activeFeeds=requestedDesk==="world"||requestedDesk==="entertainment"||requestedDesk==="sports"?feeds.filter((feed)=>feed.desk===requestedDesk):feeds;
  const results=await Promise.allSettled(activeFeeds.map((feed)=>loadFeed(feed)));
  const candidates = results
    .flatMap((result) => result.status === "fulfilled" ? result.value : [])
    .filter((story, index, all) => all.findIndex((candidate) => candidate.articleUrl === story.articleUrl) === index)
  const stories=selectBestHeadlines(candidates,!requestedDesk);
  const sources = [...new Set(stories.map((story) => story.source))];
  const failedFeeds = results.filter((result) => result.status === "rejected").length;

  return Response.json(
    { stories, sources, fetchedAt: new Date().toISOString(), failedFeeds, totalFeeds: activeFeeds.length },
    {
      status: stories.length ? 200 : 503,
      headers: { "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=3600" },
    },
  );
}
