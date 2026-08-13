import { VIDEO_SOURCES } from "../../video-sources";

export const runtime = "edge";

type LatestVideo = { sourceId:string; videoId:string; title:string; publishedAt:string; watchUrl:string };

const decodeXml = (value:string) => value
  .replace(/&#x([0-9a-f]+);/gi,(_,code:string)=>String.fromCodePoint(Number.parseInt(code,16)))
  .replace(/&#(\d+);/g,(_,code:string)=>String.fromCodePoint(Number.parseInt(code,10)))
  .replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">");
const firstMatch = (xml:string, pattern:RegExp) => decodeXml(xml.match(pattern)?.[1]?.trim() ?? "");

async function latestForSource(sourceId:string, channelId:string):Promise<LatestVideo|null>{
  try{
    const response=await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,{headers:{Accept:"application/atom+xml, application/xml;q=0.9"}});
    if(!response.ok)return null;
    const xml=await response.text();
    const entry=xml.match(/<entry>([\s\S]*?)<\/entry>/)?.[1]??"";
    const videoId=firstMatch(entry,/<yt:videoId>([^<]+)<\/yt:videoId>/);
    const title=firstMatch(entry,/<title>([\s\S]*?)<\/title>/);
    const publishedAt=firstMatch(entry,/<published>([^<]+)<\/published>/);
    if(!videoId||!title)return null;
    return{sourceId,videoId,title,publishedAt,watchUrl:`https://www.youtube.com/watch?v=${videoId}`};
  }catch{return null;}
}

export async function GET(){
  const latest=await Promise.all(VIDEO_SOURCES.map((source)=>latestForSource(source.id,source.channelId)));
  const videos=latest.filter((video):video is LatestVideo=>Boolean(video));
  return Response.json({videos,fetchedAt:new Date().toISOString(),availableSources:videos.length,totalSources:VIDEO_SOURCES.length},{headers:{"Cache-Control":"public, max-age=300, s-maxage=900, stale-while-revalidate=3600"}});
}
