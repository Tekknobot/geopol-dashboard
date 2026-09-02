import { XMLParser } from "fast-xml-parser";
import { categoryForDesk, type NewsDesk } from "../../news-taxonomy";
import { locationMatchFor, type LocationMatch, type NewsRegion } from "./location-resolver";

export const runtime = "edge";

type FeedDefinition = {
  source: string;
  url: string;
  desk: NewsDesk;
  // Publisher / feed home region. Article geography is still inferred from
  // the headline and location resolver, but this gives regional publishers a
  // sensible fallback when a local headline omits its country name.
  regionFocus?: NewsRegion;
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
  regionFocus?: NewsRegion;
  location?: {
    name: string;
    lat: number;
    lng: number;
    precision: "country" | "hotspot";
  };
};

const feeds: FeedDefinition[] = [
  // WORLD — Canada remains a strong home-market desk, but duplicate feeds are
  // capped so regional publishers from the rest of the world can surface.
  { source: "CBC News", url: "https://www.cbc.ca/cmlink/rss-topstories", desk: "world", regionFocus: "Canada" },
  { source: "CBC News", url: "https://www.cbc.ca/cmlink/rss-canada", desk: "world", regionFocus: "Canada" },
  { source: "CBC News", url: "https://www.cbc.ca/cmlink/rss-politics", desk: "world", regionFocus: "Canada" },
  { source: "CBC News", url: "https://www.cbc.ca/cmlink/rss-business", desk: "world", regionFocus: "Canada" },
  { source: "Global News", url: "https://globalnews.ca/canada/feed/", desk: "world", regionFocus: "Canada" },
  { source: "Global News", url: "https://globalnews.ca/politics/feed/", desk: "world", regionFocus: "Canada" },
  { source: "CTV News", url: "https://www.ctvnews.ca/rss/ctvnews-ca-top-stories-public-rss-1.822009", desk: "world", regionFocus: "Canada" },
  { source: "The Narwhal", url: "https://thenarwhal.ca/feed/", desk: "world", regionFocus: "Canada" },
  { source: "Canada's National Observer", url: "https://www.nationalobserver.com/front/rss", desk: "world", regionFocus: "Canada" },

  // United States / North American hub coverage.
  { source: "NPR", url: "https://feeds.npr.org/1004/rss.xml", desk: "world", regionFocus: "United States" },
  { source: "PBS NewsHour", url: "https://www.pbs.org/newshour/feeds/rss/headlines", desk: "world", regionFocus: "United States" },
  { source: "ABC News US", url: "https://feeds.abcnews.com/abcnews/topstories", desk: "world", regionFocus: "United States" },

  // Europe / transatlantic international coverage.
  { source: "BBC News", url: "https://feeds.bbci.co.uk/news/world/rss.xml", desk: "world", regionFocus: "Europe" },
  { source: "BBC News", url: "https://feeds.bbci.co.uk/news/business/rss.xml", desk: "world", regionFocus: "Europe" },
  { source: "BBC News", url: "https://feeds.bbci.co.uk/news/technology/rss.xml", desk: "world", regionFocus: "Europe" },
  { source: "The Guardian", url: "https://www.theguardian.com/world/rss", desk: "world", regionFocus: "Europe" },
  { source: "The Guardian", url: "https://www.theguardian.com/business/rss", desk: "world", regionFocus: "Europe" },
  { source: "POLITICO Europe", url: "https://www.politico.eu/feed/", desk: "world", regionFocus: "Europe" },
  { source: "DW", url: "https://rss.dw.com/rdf/rss-en-all", desk: "world", regionFocus: "Europe" },
  { source: "France 24", url: "https://www.france24.com/en/rss", desk: "world", regionFocus: "Europe" },

  // Middle East.
  { source: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", desk: "world", regionFocus: "Middle East" },
  { source: "Arab News", url: "https://www.arabnews.com/rss.xml", desk: "world", regionFocus: "Middle East" },
  { source: "The New Arab", url: "https://www.newarab.com/rss", desk: "world", regionFocus: "Middle East" },

  // Africa. Pan-African + locally headquartered outlets give the desk a
  // source-origin counterweight to London/Paris coverage of the continent.
  { source: "Africanews", url: "https://www.africanews.com/feed/", desk: "world", regionFocus: "Africa" },
  { source: "Daily Maverick", url: "https://www.dailymaverick.co.za/dmrss/", desk: "world", regionFocus: "Africa" },
  { source: "AllAfrica", url: "https://allafrica.com/tools/headlines/rdf/africa/headlines.rdf", desk: "world", regionFocus: "Africa" },

  // South Asia.
  { source: "Dawn", url: "https://www.dawn.com/feeds/home", desk: "world", regionFocus: "South Asia" },
  { source: "The Hindu", url: "https://www.thehindu.com/feeder/default.rss", desk: "world", regionFocus: "South Asia" },
  { source: "The Indian Express", url: "https://indianexpress.com/section/india/feed/", desk: "world", regionFocus: "South Asia" },

  // East Asia.
  { source: "South China Morning Post", url: "https://www.scmp.com/rss/91/feed", desk: "world", regionFocus: "East Asia" },
  { source: "The Japan Times", url: "https://www.japantimes.co.jp/feed/", desk: "world", regionFocus: "East Asia" },
  { source: "Japan Today", url: "https://japantoday.com/feed/atom", desk: "world", regionFocus: "East Asia" },

  // Southeast Asia. CNA publishes official RSS endpoints and gives Atlas a
  // strong Singapore/ASEAN reporting hub. Bangkok Post adds mainland SEA.
  { source: "CNA", url: "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=6511", desk: "world", regionFocus: "Southeast Asia" },
  { source: "CNA", url: "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=10416", desk: "world", regionFocus: "Southeast Asia" },
  { source: "Bangkok Post", url: "https://www.bangkokpost.com/rss/data/most-recent.xml", desk: "world", regionFocus: "Southeast Asia" },

  // Oceania / Pacific.
  { source: "ABC News Australia", url: "https://www.abc.net.au/news/feed/51120/rss.xml", desk: "world", regionFocus: "Oceania & Pacific" },
  { source: "RNZ", url: "https://www.rnz.co.nz/rss/world.xml", desk: "world", regionFocus: "Oceania & Pacific" },
  { source: "RNZ Pacific", url: "https://www.rnz.co.nz/rss/pacific.xml", desk: "world", regionFocus: "Oceania & Pacific" },

  // Latin America & Caribbean. English-language regional feeds are kept local
  // to the region rather than relying entirely on US/European correspondents.
  { source: "MercoPress", url: "https://en.mercopress.com/rss/latin-america", desk: "world", regionFocus: "Latin America & Caribbean" },
  { source: "Buenos Aires Herald", url: "https://buenosairesherald.com/feed", desk: "world", regionFocus: "Latin America & Caribbean" },
  { source: "Buenos Aires Times", url: "https://www.batimes.com.ar/feed", desk: "world", regionFocus: "Latin America & Caribbean" },

  // International institutions.
  { source: "UN News", url: "https://news.un.org/feed/subscribe/en/news/all/rss.xml", desk: "world", regionFocus: "Global" },

  // ENTERTAINMENT
  { source: "BBC Culture", url: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml", desk: "entertainment", regionFocus: "Europe" },
  { source: "The Guardian Culture", url: "https://www.theguardian.com/culture/rss", desk: "entertainment", regionFocus: "Europe" },
  { source: "The Guardian Film", url: "https://www.theguardian.com/film/rss", desk: "entertainment", regionFocus: "Europe" },
  { source: "The Guardian Music", url: "https://www.theguardian.com/music/rss", desk: "entertainment", regionFocus: "Europe" },
  { source: "The Guardian Games", url: "https://www.theguardian.com/games/rss", desk: "entertainment", regionFocus: "Europe" },
  { source: "NPR Arts & Life", url: "https://feeds.npr.org/1008/rss.xml", desk: "entertainment", regionFocus: "United States" },
  { source: "CBC News", url: "https://www.cbc.ca/cmlink/rss-arts", desk: "entertainment", regionFocus: "Canada" },
  { source: "Global News", url: "https://globalnews.ca/entertainment/feed/", desk: "entertainment", regionFocus: "Canada" },

  // SPORTS
  { source: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/rss.xml", desk: "sports", regionFocus: "Europe" },
  { source: "The Guardian Sport", url: "https://www.theguardian.com/sport/rss", desk: "sports", regionFocus: "Europe" },
  { source: "The Guardian Football", url: "https://www.theguardian.com/football/rss", desk: "sports", regionFocus: "Europe" },
  { source: "ESPN", url: "https://www.espn.com/espn/rss/news", desk: "sports", regionFocus: "United States" },
  { source: "CBC News", url: "https://www.cbc.ca/cmlink/rss-sports", desk: "sports", regionFocus: "Canada" },
  { source: "Global News", url: "https://globalnews.ca/sports/feed/", desk: "sports", regionFocus: "Canada" },
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

const regionRules: Array<[NewsRegion, RegExp]> = [
  ["Canada", /canada|canadian|ottawa|ontario|qu[eé]bec|british columbia|alberta|saskatchewan|manitoba|nova scotia|new brunswick|newfoundland|labrador|prince edward island|northwest territories|nunavut|yukon|toronto|montreal|vancouver|calgary|edmonton|winnipeg|halifax|regina|saskatoon/i],
  ["Middle East", /iran|iraq|israel|gaza|west bank|lebanon|syria|yemen|saudi|qatar|emirates|jordan|oman|bahrain|kuwait|hormuz|red sea|middle east/i],
  ["South Asia", /india|pakistan|bangladesh|nepal|sri lanka|maldives|bhutan|afghanistan|south asia/i],
  ["East Asia", /china|taiwan|japan|north korea|south korea|korean|hong kong|macau|mongolia|east asia/i],
  ["Southeast Asia", /singapore|indonesia|philippines|malaysia|thailand|vietnam|myanmar|burma|cambodia|laos|brunei|timor-leste|east timor|asean|southeast asia/i],
  ["Oceania & Pacific", /australia|new zealand|papua new guinea|fiji|samoa|tonga|vanuatu|solomon islands|micronesia|palau|kiribati|tuvalu|pacific islands|oceania/i],
  ["Africa", /africa|sudan|congo|sahel|ethiopia|somalia|kenya|nigeria|south africa|libya|egypt|ghana|uganda|tanzania|rwanda|senegal|mali|niger|morocco|algeria|tunisia|mozambique|zimbabwe|zambia/i],
  ["Latin America & Caribbean", /mexico|brazil|argentina|colombia|venezuela|chile|peru|ecuador|bolivia|paraguay|uruguay|guyana|suriname|belize|guatemala|honduras|el salvador|nicaragua|costa rica|panama|cuba|haiti|dominican republic|jamaica|caribbean|latin america|mercosur/i],
  ["United States", /united states|u\.s\.|usa|american|washington|new york|california|texas|florida|chicago|los angeles/i],
  ["Europe", /europe|ukraine|russia|britain|united kingdom|uk\b|france|germany|italy|spain|poland|nato|eu\b|balkan|black sea|netherlands|belgium|sweden|norway|finland|denmark|portugal|greece|turkey|türkiye/i],
];
const regionFor = (value: string, location?: LocationMatch, fallback?: NewsRegion):NewsRegion => regionRules.find(([, rule]) => rule.test(value))?.[0] ?? location?.region ?? fallback ?? "Global";
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
    const region = regionFor(combined, matchedLocation, feed.regionFocus);
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
      regionFocus: feed.regionFocus,
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
  return recency+completeness+urgency;
};

function selectBestHeadlines(candidates:FeedStory[],includeAllDesks:boolean){
  const now=Date.now();
  const byScore=[...candidates].sort((left,right)=>headlineScore(right,now)-headlineScore(left,now)||Date.parse(right.publishedAt)-Date.parse(left.publishedAt));
  const selected:FeedStory[]=[];
  const selectedUrls=new Set<string>();
  const perPublisher=new Map<string,number>();
  const PUBLISHER_CAP=18;
  const add=(stories:FeedStory[],limit=Number.POSITIVE_INFINITY)=>{
    let added=0;
    for(const story of stories){
      if(added>=limit)break;
      if(selectedUrls.has(story.articleUrl))continue;
      const publisherCount=perPublisher.get(story.source)??0;
      if(publisherCount>=PUBLISHER_CAP)continue;
      selected.push(story);
      selectedUrls.add(story.articleUrl);
      perPublisher.set(story.source,publisherCount+1);
      added+=1;
    }
  };

  // World coverage is intentionally plural rather than proportional to feed
  // volume. These are minimum representation floors, not hard quotas: if a
  // region has fewer fresh stories Atlas simply moves on and fills by score.
  const worldRegionalFloors: Array<[NewsRegion,number]> = [
    ["Canada",16],
    ["United States",12],
    ["Europe",14],
    ["Middle East",10],
    ["Africa",10],
    ["South Asia",10],
    ["East Asia",10],
    ["Southeast Asia",8],
    ["Oceania & Pacific",8],
    ["Latin America & Caribbean",10],
    ["Global",8],
  ];

  for(const [region,floor] of worldRegionalFloors){
    add(byScore.filter((story)=>story.desk==="world"&&story.region===region),floor);
  }

  if(includeAllDesks){
    // Reserve a small floor for the non-world newsrooms on the combined Best
    // 180 carousel, then let the remaining slots compete by score.
    add(byScore.filter((candidate)=>candidate.desk==="sports"),12);
    add(byScore.filter((candidate)=>candidate.desk==="entertainment"),12);
  }

  add(byScore);
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
  const configuredPublishers = [...new Set(activeFeeds.map((feed) => feed.source))];
  const regionalCoverage = stories.reduce<Record<string,number>>((counts,story)=>{
    counts[story.region]=(counts[story.region]??0)+1;
    return counts;
  },{});
  const failedFeeds = results.filter((result) => result.status === "rejected").length;

  return Response.json(
    {
      stories,
      sources,
      fetchedAt: new Date().toISOString(),
      failedFeeds,
      totalFeeds: activeFeeds.length,
      totalPublishers: configuredPublishers.length,
      activePublishers: sources.length,
      regionalCoverage,
    },
    {
      status: stories.length ? 200 : 503,
      headers: { "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=3600" },
    },
  );
}
