import { XMLParser } from "fast-xml-parser";
import countries from "world-countries";
import { categoryForDesk, type NewsDesk } from "../../news-taxonomy";

export const runtime = "edge";

type FeedDefinition = {
  source: string;
  url: string;
  desk: NewsDesk;
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
  location?: {
    name: string;
    lat: number;
    lng: number;
    precision: "country" | "hotspot";
  };
};

const feeds: FeedDefinition[] = [
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
  { source: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/rss.xml", desk: "sports" },
  { source: "The Guardian Sport", url: "https://www.theguardian.com/sport/rss", desk: "sports" },
  { source: "The Guardian Football", url: "https://www.theguardian.com/football/rss", desk: "sports" },
  { source: "ESPN", url: "https://www.espn.com/espn/rss/news", desk: "sports" },
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false,
});

type LocationMatch = NonNullable<FeedStory["location"]> & { aliases: string[] };
const hotspotLocations: LocationMatch[] = [
  {name:"Los Angeles",lat:34.05,lng:-118.24,precision:"hotspot",aliases:["Los Angeles","Hollywood"]},
  {name:"New York City",lat:40.71,lng:-74.01,precision:"hotspot",aliases:["New York City","New York"]},
  {name:"London",lat:51.51,lng:-0.13,precision:"hotspot",aliases:["London","Wembley"]},
  {name:"Paris",lat:48.86,lng:2.35,precision:"hotspot",aliases:["Paris","Roland Garros"]},
  {name:"Cannes",lat:43.55,lng:7.02,precision:"hotspot",aliases:["Cannes"]},
  {name:"Toronto",lat:43.65,lng:-79.38,precision:"hotspot",aliases:["Toronto"]},
  {name:"Mumbai",lat:19.08,lng:72.88,precision:"hotspot",aliases:["Mumbai","Bollywood"]},
  {name:"Seoul",lat:37.57,lng:126.98,precision:"hotspot",aliases:["Seoul"]},
  {name:"Tokyo",lat:35.68,lng:139.69,precision:"hotspot",aliases:["Tokyo"]},
  {name:"Melbourne",lat:-37.81,lng:144.96,precision:"hotspot",aliases:["Melbourne"]},
  {name:"Nashville",lat:36.16,lng:-86.78,precision:"hotspot",aliases:["Nashville"]},
  {name:"Gaza Strip",lat:31.45,lng:34.4,precision:"hotspot",aliases:["Gaza Strip","Gaza"]},
  {name:"West Bank",lat:31.95,lng:35.2,precision:"hotspot",aliases:["West Bank"]},
  {name:"Strait of Hormuz",lat:26.56,lng:56.25,precision:"hotspot",aliases:["Strait of Hormuz","Hormuz"]},
  {name:"Red Sea",lat:20,lng:38,precision:"hotspot",aliases:["Red Sea"]},
  {name:"Black Sea",lat:43,lng:34,precision:"hotspot",aliases:["Black Sea"]},
  {name:"South China Sea",lat:13,lng:114,precision:"hotspot",aliases:["South China Sea"]},
  {name:"Taiwan Strait",lat:24,lng:119.5,precision:"hotspot",aliases:["Taiwan Strait"]},
  {name:"Panama Canal",lat:9.08,lng:-79.68,precision:"hotspot",aliases:["Panama Canal"]},
  {name:"Suez Canal",lat:30.45,lng:32.35,precision:"hotspot",aliases:["Suez Canal"]},
  {name:"Strait of Malacca",lat:3.2,lng:101.3,precision:"hotspot",aliases:["Strait of Malacca","Malacca Strait"]},
  {name:"Persian Gulf",lat:26.5,lng:52.5,precision:"hotspot",aliases:["Persian Gulf","Arabian Gulf"]},
  {name:"Gulf of Aden",lat:12.5,lng:47,precision:"hotspot",aliases:["Gulf of Aden"]},
  {name:"Horn of Africa",lat:8.7,lng:46.2,precision:"hotspot",aliases:["Horn of Africa"]},
  {name:"Sahel",lat:15,lng:2,precision:"hotspot",aliases:["the Sahel","Sahel"]},
  {name:"South Caucasus",lat:41.8,lng:44.5,precision:"hotspot",aliases:["South Caucasus"]},
  {name:"Korean Peninsula",lat:38,lng:127.5,precision:"hotspot",aliases:["Korean Peninsula"]},
  {name:"Arctic",lat:75,lng:0,precision:"hotspot",aliases:["Arctic Circle","the Arctic","Arctic"]},
  {name:"Baltic Sea",lat:58,lng:20,precision:"hotspot",aliases:["Baltic Sea"]},
  {name:"Mediterranean Sea",lat:35,lng:18,precision:"hotspot",aliases:["Mediterranean Sea","Mediterranean"]},
  {name:"Caribbean",lat:18,lng:-75,precision:"hotspot",aliases:["Caribbean Sea","the Caribbean","Caribbean"]},
  {name:"Amazon Basin",lat:-4,lng:-62,precision:"hotspot",aliases:["Amazon Basin","the Amazon","Amazon"]},
  {name:"Pacific Islands",lat:-10,lng:-165,precision:"hotspot",aliases:["Pacific Islands","Pacific states"]},
];
const countryLocations: LocationMatch[] = countries.flatMap((country) => {
  if (country.latlng.length < 2) return [];
  const aliases = [country.name.common,country.name.official,...country.altSpellings]
    .filter((alias) => alias.length >= 4 && !/^[A-Z]{2,3}$/.test(alias));
  if (country.cca3 === "COD") aliases.push("DR Congo","DRC");
  if (country.cca3 === "COG") aliases.push("Republic of Congo");
  if (country.cca3 === "USA") aliases.push("United States","U.S.","USA");
  if (country.cca3 === "GBR") aliases.push("United Kingdom","Britain","UK");
  if (country.cca3 === "KOR") aliases.push("South Korea");
  if (country.cca3 === "PRK") aliases.push("North Korea");
  if (country.cca3 === "TUR") aliases.push("Turkey");
  if (country.cca3 === "CIV") aliases.push("Ivory Coast");
  return [{name:country.name.common,lat:country.latlng[0],lng:country.latlng[1],precision:"country" as const,aliases}];
});
const locationMatches = [...hotspotLocations,...countryLocations]
  .flatMap((location) => location.aliases.map((alias) => ({location,alias})))
  .sort((left,right) => right.alias.length-left.alias.length);
const escapePattern = (value:string) => value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
const locationFor = (value:string):FeedStory["location"] => {
  const match = locationMatches.find(({alias}) => new RegExp(`(^|[^\\p{L}])${escapePattern(alias)}(?=$|[^\\p{L}])`,"iu").test(value));
  if (!match) return undefined;
  const {name,lat,lng,precision} = match.location;
  return {name,lat,lng,precision};
};

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
  ["Middle East", /iran|iraq|israel|gaza|lebanon|syria|yemen|saudi|qatar|emirates|jordan|hormuz|red sea|middle east/i],
  ["Europe", /europe|ukraine|russia|britain|uk\b|france|germany|italy|spain|poland|nato|eu\b|balkan|black sea/i],
  ["Asia Pacific", /china|taiwan|japan|korea|india|pakistan|indonesia|philippines|australia|pacific|asia|asean/i],
  ["Africa", /africa|sudan|congo|sahel|ethiopia|somalia|kenya|nigeria|south africa|libya|egypt/i],
  ["Americas", /united states|u\.s\.|usa|canada|mexico|brazil|argentina|colombia|venezuela|caribbean|america/i],
];
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
    const category = categoryForDesk(combined, feed.desk);
    const region = regionFor(combined);
    const wordCount = `${title} ${summary}`.split(/\s+/).length;
    return [{
      id: hash(articleUrl),
      desk: feed.desk,
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
      location: locationFor(combined),
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

export async function GET(request:Request) {
  const requestedDesk=new URL(request.url).searchParams.get("desk");
  const activeFeeds=requestedDesk==="world"||requestedDesk==="entertainment"||requestedDesk==="sports"?feeds.filter((feed)=>feed.desk===requestedDesk):feeds;
  const feedResults:Array<PromiseSettledResult<FeedStory[]>|undefined>=new Array(activeFeeds.length);
  const tasks=activeFeeds.map(async(feed,index)=>{
    try{feedResults[index]={status:"fulfilled",value:await loadFeed(feed)};}
    catch(reason){feedResults[index]={status:"rejected",reason};}
  });
  await Promise.race([
    Promise.all(tasks).then(()=>undefined),
    new Promise<void>((resolve)=>setTimeout(resolve,6000)),
  ]);
  const results=feedResults.filter((result):result is PromiseSettledResult<FeedStory[]>=>Boolean(result));
  const stories = results
    .flatMap((result) => result.status === "fulfilled" ? result.value : [])
    .filter((story, index, all) => all.findIndex((candidate) => candidate.articleUrl === story.articleUrl) === index)
    .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt))
    .slice(0, 180);
  const sources = [...new Set(stories.map((story) => story.source))];
  const failedFeeds = activeFeeds.length-results.filter((result) => result.status === "fulfilled").length;

  return Response.json(
    { stories, sources, fetchedAt: new Date().toISOString(), failedFeeds, totalFeeds: activeFeeds.length },
    {
      status: stories.length ? 200 : 503,
      headers: { "Cache-Control": "public, max-age=120, s-maxage=300, stale-while-revalidate=900" },
    },
  );
}
