import { VIDEO_SOURCES } from "../../video-sources";

export const runtime = "edge";

type VideoRoom = "sports" | "entertainment";
type LatestVideo = { sourceId:string; videoId:string; title:string; publishedAt:string; watchUrl:string };

const FEED_TIMEOUT_MS = 4500;
const MAX_ENTRIES_PER_SOURCE = 3;

const decodeXml = (value:string) => value
  .replace(/&#x([0-9a-f]+);/gi,(_,code:string)=>String.fromCodePoint(Number.parseInt(code,16)))
  .replace(/&#(\d+);/g,(_,code:string)=>String.fromCodePoint(Number.parseInt(code,10)))
  .replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">");
const firstMatch = (xml:string, pattern:RegExp) => decodeXml(xml.match(pattern)?.[1]?.trim() ?? "");

async function latestForSource(sourceId:string, channelId:string):Promise<LatestVideo[]>{
  try{
    const response=await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,{
      headers:{Accept:"application/atom+xml, application/xml;q=0.9"},
      signal:AbortSignal.timeout(FEED_TIMEOUT_MS),
      cache:"no-store",
    });
    if(!response.ok)return [];
    const xml=await response.text();
    const entries=[...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].slice(0,MAX_ENTRIES_PER_SOURCE);
    return entries.flatMap((match)=>{
      const entry=match[1]??"";
      const videoId=firstMatch(entry,/<yt:videoId>([^<]+)<\/yt:videoId>/);
      const title=firstMatch(entry,/<title>([\s\S]*?)<\/title>/);
      const publishedAt=firstMatch(entry,/<published>([^<]+)<\/published>/);
      if(!videoId||!title)return [];
      return [{sourceId,videoId,title,publishedAt,watchUrl:`https://www.youtube.com/watch?v=${videoId}`}];
    });
  }catch{return [];}
}

export async function GET(request:Request){
  const url=new URL(request.url);
  const roomParam=url.searchParams.get("room");
  const room:VideoRoom|undefined=roomParam==="sports"||roomParam==="entertainment"?roomParam:undefined;
  const selectedSources=room?VIDEO_SOURCES.filter((source)=>source.room===room):VIDEO_SOURCES;
  const settled=await Promise.all(selectedSources.map((source)=>latestForSource(source.id,source.channelId)));
  const videos=settled.flat().sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
  return Response.json(
    {videos,fetchedAt:new Date().toISOString(),availableSources:new Set(videos.map((video)=>video.sourceId)).size,totalSources:selectedSources.length},
    {headers:{"Cache-Control":"public, max-age=180, s-maxage=600, stale-while-revalidate=1800"}}
  );
}
