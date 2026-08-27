import { VIDEO_SOURCES, uploadsPlaylistFor } from "../../video-sources";

export const runtime = "edge";

type VideoRoom = "sports" | "entertainment";
type LatestVideo = { sourceId:string; videoId:string; title:string; publishedAt:string; watchUrl:string };

const FEED_TIMEOUT_MS = 2600;
const SOURCE_DEADLINE_MS = 3000;
const MAX_ENTRIES_PER_SOURCE = 3;

const decodeXml = (value:string) => value
  .replace(/&#x([0-9a-f]+);/gi,(_,code:string)=>String.fromCodePoint(Number.parseInt(code,16)))
  .replace(/&#(\d+);/g,(_,code:string)=>String.fromCodePoint(Number.parseInt(code,10)))
  .replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">");
const firstMatch = (xml:string, pattern:RegExp) => decodeXml(xml.match(pattern)?.[1]?.trim() ?? "");

const parseFeed=(sourceId:string,xml:string):LatestVideo[]=>{
  const entries=[...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].slice(0,MAX_ENTRIES_PER_SOURCE);
  return entries.flatMap((match)=>{
    const entry=match[1]??"";
    const videoId=firstMatch(entry,/<yt:videoId>([^<]+)<\/yt:videoId>/);
    const title=firstMatch(entry,/<title>([\s\S]*?)<\/title>/);
    const publishedAt=firstMatch(entry,/<published>([^<]+)<\/published>/);
    if(!videoId||!title)return [];
    return [{sourceId,videoId,title,publishedAt,watchUrl:`https://www.youtube.com/watch?v=${videoId}`}];
  });
};

async function fetchFeed(url:string):Promise<string>{
  try{
    const response=await fetch(url,{
      headers:{
        Accept:"application/atom+xml, application/xml;q=0.9, text/xml;q=0.8",
        "User-Agent":"AtlasNewsroom/1.0",
      },
      signal:AbortSignal.timeout(FEED_TIMEOUT_MS),
      cache:"no-store",
    });
    if(!response.ok)return "";
    return await response.text();
  }catch{return "";}
}

async function latestForSource(sourceId:string, channelId:string):Promise<LatestVideo[]>{
  const channelUrl=`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const playlistUrl=`https://www.youtube.com/feeds/videos.xml?playlist_id=${uploadsPlaylistFor(channelId)}`;

  const channelXml=await fetchFeed(channelUrl);
  const channelVideos=parseFeed(sourceId,channelXml);
  if(channelVideos.length)return channelVideos;

  // YouTube occasionally serves an empty/failed channel feed while the uploads
  // playlist feed still works, so use it as a second path.
  const playlistXml=await fetchFeed(playlistUrl);
  return parseFeed(sourceId,playlistXml);
}

async function latestWithDeadline(sourceId:string,channelId:string):Promise<LatestVideo[]>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{
    return await Promise.race([
      latestForSource(sourceId,channelId),
      new Promise<LatestVideo[]>((resolve)=>{timer=setTimeout(()=>resolve([]),SOURCE_DEADLINE_MS);}),
    ]);
  }finally{
    if(timer)clearTimeout(timer);
  }
}

export async function GET(request:Request){
  const url=new URL(request.url);
  const roomParam=url.searchParams.get("room");
  const room:VideoRoom|undefined=roomParam==="sports"||roomParam==="entertainment"?roomParam:undefined;
  const selectedSources=room?VIDEO_SOURCES.filter((source)=>source.room===room):VIDEO_SOURCES;

  // Every source is independently deadline-capped. One stuck sports channel can
  // no longer hold the whole newsroom response open.
  const settled=await Promise.allSettled(selectedSources.map((source)=>latestWithDeadline(source.id,source.channelId)));
  const videos=settled.flatMap((result)=>result.status==="fulfilled"?result.value:[]).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
  const availableSources=new Set(videos.map((video)=>video.sourceId)).size;

  return Response.json(
    {
      videos,
      fetchedAt:new Date().toISOString(),
      availableSources,
      totalSources:selectedSources.length,
      partial:availableSources>0&&availableSources<selectedSources.length,
    },
    {headers:{"Cache-Control":"public, max-age=600, s-maxage=1800, stale-while-revalidate=86400"}}
  );
}
