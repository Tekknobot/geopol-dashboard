"use client";

import { useEffect, useMemo, useState } from "react";
import { VIDEO_SOURCES, uploadsPlaylistFor } from "../video-sources";

type Desk = "sports" | "entertainment";
type LatestVideo = { sourceId:string; videoId:string; title:string; publishedAt:string; watchUrl:string };
type VideoResponse = { videos:LatestVideo[] };
type LoadState = "loading" | "live" | "fallback" | "error";

const keywords:Record<Desk,string[]> = {
  sports:["sport","football","soccer","tennis","basketball","baseball","hockey","olympic","cricket","rugby","golf","race","championship","league","cup","tournament","athlete"],
  entertainment:["film","movie","music","album","actor","actress","television","tv","streaming","festival","award","oscar","emmy","grammy","culture","book","gaming","theatre","artist","celebrity"],
};

const relativeTime=(value:string)=>{
  const parsed=Date.parse(value);
  if(!Number.isFinite(parsed))return "recent";
  const minutes=Math.max(0,Math.floor((Date.now()-parsed)/60000));
  if(minutes<1)return "just now";
  if(minutes<60)return `${minutes}m ago`;
  const hours=Math.floor(minutes/60);
  if(hours<24)return `${hours}h ago`;
  const days=Math.floor(hours/24);
  return days<7?`${days}d ago`:new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric"}).format(new Date(value));
};

export default function DeskVideoSection({desk}:{desk:Desk}){
  const [videos,setVideos]=useState<LatestVideo[]>([]);
  const [activeId,setActiveId]=useState<string|null>(null);
  const [playing,setPlaying]=useState(false);
  const [loadState,setLoadState]=useState<LoadState>("loading");
  const [requestKey,setRequestKey]=useState(0);

  useEffect(()=>{
    const controller=new AbortController();
    setLoadState("loading");
    setVideos([]);
    setActiveId(null);
    setPlaying(false);

    // The API already caps each publisher independently; this is a final client
    // guard so a browser/Vercel edge oddity can never leave the spinner forever.
    const timeout=window.setTimeout(()=>controller.abort(),6500);
    fetch(`/api/video-news?room=${desk}&t=${Date.now()}`,{cache:"no-store",signal:controller.signal})
      .then((response)=>response.ok?response.json() as Promise<VideoResponse>:Promise.reject(new Error("video feed unavailable")))
      .then((data)=>{
        const next=Array.isArray(data.videos)?data.videos:[];
        setVideos(next);
        setLoadState(next.length?"live":"fallback");
      })
      .catch(()=>setLoadState("fallback"))
      .finally(()=>window.clearTimeout(timeout));

    return()=>{window.clearTimeout(timeout);controller.abort();};
  },[desk,requestKey]);

  const deskVideos=useMemo(()=>{
    const roomVideos=videos.filter((video)=>VIDEO_SOURCES.find((source)=>source.id===video.sourceId)?.room===desk);
    const matches=roomVideos.filter((video)=>keywords[desk].some((word)=>video.title.toLowerCase().includes(word)));
    const remainder=roomVideos.filter((video)=>!matches.some((match)=>match.videoId===video.videoId));
    return [...matches,...remainder].slice(0,6);
  },[desk,videos]);

  const active=deskVideos.find((video)=>video.videoId===activeId)??deskVideos[0]??null;
  const fallbackSource=VIDEO_SOURCES.find((source)=>source.room===desk)??null;
  const fallbackPlaylist=fallbackSource?uploadsPlaylistFor(fallbackSource.channelId):null;
  const sourceName=(sourceId:string)=>VIDEO_SOURCES.find((source)=>source.id===sourceId)?.name??"Official newsroom";
  const choose=(video:LatestVideo)=>{setActiveId(video.videoId);setPlaying(false);};
  const retry=()=>setRequestKey((value)=>value+1);

  return <section className="desk-video" aria-labelledby={`${desk}-video-title`}>
    <div className="desk-section-heading desk-video-heading">
      <div><p>WATCH / OFFICIAL CHANNELS</p><h2 id={`${desk}-video-title`}>{desk==="sports"?"The replay room":"The screening room"}</h2></div>
      <span>Publisher video · no autoplay</span>
    </div>

    {active?<div className="desk-video-grid">
      <div className="desk-video-feature">
        {playing?<iframe src={`https://www.youtube-nocookie.com/embed/${active.videoId}?rel=0&autoplay=1`} title={active.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen/>:<button type="button" className="desk-video-poster" onClick={()=>setPlaying(true)} aria-label={`Play ${active.title}`}>
          <img src={`https://i.ytimg.com/vi/${active.videoId}/maxresdefault.jpg`} alt="" onError={(event)=>{event.currentTarget.src=`https://i.ytimg.com/vi/${active.videoId}/hqdefault.jpg`;}}/>
          <span className="desk-video-wash"/>
          <span className="desk-video-play">▶</span>
          <span className="desk-video-feature-copy"><small>FEATURED VIDEO · {sourceName(active.sourceId)}</small><strong>{active.title}</strong><em>{relativeTime(active.publishedAt)}</em></span>
        </button>}
      </div>
      <div className="desk-video-queue" aria-label="More publisher videos">
        <div className="desk-video-queue-label"><span>UP NEXT</span><small>{deskVideos.length} reports</small></div>
        {deskVideos.slice(1,5).map((video)=><button key={video.videoId} type="button" onClick={()=>choose(video)}>
          <span className="desk-video-thumb"><img src={`https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`} alt=""/><i>▶</i></span>
          <span><small>{sourceName(video.sourceId)} · {relativeTime(video.publishedAt)}</small><strong>{video.title}</strong></span>
        </button>)}
      </div>
    </div>:loadState==="fallback"&&fallbackSource&&fallbackPlaylist?<div className="desk-video-grid">
      <div className="desk-video-feature">
        <iframe src={`https://www.youtube-nocookie.com/embed/videoseries?list=${fallbackPlaylist}&rel=0`} title={`${fallbackSource.name} latest uploads`} allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen/>
      </div>
      <div className="desk-video-loading">
        <strong>{desk==="sports"?"Sports feed fallback active":"Video feed fallback active"}</strong>
        <p>The RSS feed did not return usable items, so ATLAS loaded the publisher&apos;s official uploads playlist directly instead.</p>
        <button type="button" className="desk-video-retry" onClick={retry}>Retry video desk</button>
      </div>
    </div>:<div className="desk-video-loading">
      {loadState==="loading"?<span className="feed-spinner"/>:null}
      <strong>{loadState==="loading"?"Checking publisher video desks…":"Video desk temporarily unavailable"}</strong>
      <p>{loadState==="loading"?"Official reports will appear here as feeds respond.":"The publisher feed could not be loaded."}</p>
      {loadState!=="loading"?<button type="button" className="desk-video-retry" onClick={retry}>Retry video desk</button>:null}
    </div>}

    <div className="desk-video-note"><span>VIDEO DESK</span><p>Videos open in YouTube&apos;s privacy-enhanced player. Publishers control availability, advertising and embedding.</p>{active?<a href={active.watchUrl} target="_blank" rel="noreferrer">Watch on publisher channel ↗</a>:fallbackSource?<a href={fallbackSource.channelUrl} target="_blank" rel="noreferrer">Open official video channel ↗</a>:null}</div>
  </section>;
}
