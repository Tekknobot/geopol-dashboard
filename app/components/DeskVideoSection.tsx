"use client";

import { useEffect, useMemo, useState } from "react";
import { uploadsPlaylistFor, VIDEO_SOURCES } from "../video-sources";

type Desk = "sports" | "entertainment";
type LatestVideo = { sourceId:string; videoId:string; title:string; publishedAt:string; watchUrl:string };
type VideoResponse = { videos:LatestVideo[] };
type LoadState = "loading" | "ready" | "fallback";

const keywords:Record<Desk,string[]> = {
  sports:["sport","football","soccer","tennis","basketball","baseball","hockey","olympic","cricket","rugby","golf","race","championship","league","cup","tournament","athlete"],
  entertainment:["film","movie","music","album","actor","actress","television","tv","streaming","festival","award","oscar","emmy","grammy","culture","book","gaming","theatre","artist","celebrity"],
};

const relativeTime=(value:string)=>{
  const minutes=Math.max(0,Math.floor((Date.now()-Date.parse(value))/60000));
  if(minutes<1)return "just now";
  if(minutes<60)return `${minutes}m ago`;
  const hours=Math.floor(minutes/60);
  if(hours<24)return `${hours}h ago`;
  const days=Math.floor(hours/24);
  return days<7?`${days}d ago`:new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric"}).format(new Date(value));
};

export default function DeskVideoSection({desk}:{desk:Desk}){
  const roomSources=useMemo(()=>VIDEO_SOURCES.filter((source)=>source.room===desk),[desk]);
  const [videos,setVideos]=useState<LatestVideo[]>([]);
  const [activeId,setActiveId]=useState<string|null>(null);
  const [fallbackSourceId,setFallbackSourceId]=useState(()=>roomSources[0]?.id??"");
  const [loadState,setLoadState]=useState<LoadState>("loading");
  const [playing,setPlaying]=useState(false);

  useEffect(()=>{
    const controller=new AbortController();
    let mounted=true;
    const timeout=window.setTimeout(()=>controller.abort(),7_000);
    fetch("/api/video-news",{cache:"no-store",signal:controller.signal})
      .then((response)=>response.ok?response.json() as Promise<VideoResponse>:Promise.reject(new Error("Video feeds unavailable")))
      .then((data)=>{
        if(!mounted)return;
        setVideos(Array.isArray(data.videos)?data.videos:[]);
        setLoadState("ready");
      })
      .catch(()=>{if(mounted)setLoadState("fallback");})
      .finally(()=>window.clearTimeout(timeout));
    return()=>{mounted=false;window.clearTimeout(timeout);controller.abort();};
  },[]);

  const deskVideos=useMemo(()=>{
    const roomVideos=videos.filter((video)=>VIDEO_SOURCES.find((source)=>source.id===video.sourceId)?.room===desk);
    const matches=roomVideos.filter((video)=>keywords[desk].some((word)=>video.title.toLowerCase().includes(word)));
    const remainder=roomVideos.filter((video)=>!matches.some((match)=>match.videoId===video.videoId));
    return [...matches,...remainder].slice(0,6);
  },[desk,videos]);
  const active=deskVideos.find((video)=>video.videoId===activeId)??deskVideos[0]??null;
  const fallbackSource=roomSources.find((source)=>source.id===fallbackSourceId)??roomSources[0]??null;
  const fallbackPlaylist=fallbackSource?uploadsPlaylistFor(fallbackSource.channelId):"";
  const sourceName=(sourceId:string)=>VIDEO_SOURCES.find((source)=>source.id===sourceId)?.name??"Official newsroom";
  const choose=(video:LatestVideo)=>{setActiveId(video.videoId);setPlaying(false);};
  const chooseFallback=(sourceId:string)=>{setFallbackSourceId(sourceId);setPlaying(false);};
  const retry=()=>{
    setLoadState("loading");
    setVideos([]);
    const controller=new AbortController();
    const timeout=window.setTimeout(()=>controller.abort(),7_000);
    fetch("/api/video-news",{cache:"no-store",signal:controller.signal})
      .then((response)=>response.ok?response.json() as Promise<VideoResponse>:Promise.reject(new Error("Video feeds unavailable")))
      .then((data)=>{setVideos(Array.isArray(data.videos)?data.videos:[]);setLoadState("ready");})
      .catch(()=>setLoadState("fallback"))
      .finally(()=>window.clearTimeout(timeout));
  };

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
    </div>:loadState==="loading"?<div className="desk-video-loading"><span className="feed-spinner"/><strong>Checking publisher video desks…</strong><p>This check now stops automatically if a publisher feed is slow.</p></div>:fallbackSource?<div className="desk-video-grid desk-video-fallback">
      <div className="desk-video-feature">
        {playing?<iframe src={`https://www.youtube-nocookie.com/embed/videoseries?list=${fallbackPlaylist}&rel=0`} title={`${fallbackSource.name} latest uploads`} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen/>:<button type="button" className="desk-video-poster desk-video-fallback-poster" onClick={()=>setPlaying(true)} aria-label={`Open the latest ${fallbackSource.name} uploads`}>
          <span className="desk-video-fallback-art" aria-hidden>{fallbackSource.name.slice(0,2).toUpperCase()}</span>
          <span className="desk-video-wash"/>
          <span className="desk-video-play">▶</span>
          <span className="desk-video-feature-copy"><small>OFFICIAL CHANNEL · DIRECT PLAYLIST</small><strong>Latest {fallbackSource.name} uploads</strong><em>The live title feed is delayed, but the publisher playlist remains available.</em></span>
        </button>}
      </div>
      <div className="desk-video-queue" aria-label={`${desk} publisher channels`}>
        <div className="desk-video-queue-label"><span>OFFICIAL CHANNELS</span><small>{roomSources.length} available</small></div>
        {roomSources.slice(0,4).map((source)=><button key={source.id} type="button" className={fallbackSource.id===source.id?"active":""} onClick={()=>chooseFallback(source.id)}>
          <span className="desk-video-thumb desk-video-channel-thumb"><b>{source.name.split(/\s+/).map((part)=>part[0]).join("").slice(0,3)}</b><i>▶</i></span>
          <span><small>{source.region}</small><strong>{source.name}</strong></span>
        </button>)}
      </div>
    </div>:<div className="desk-video-unavailable"><strong>Publisher video is temporarily unavailable</strong><p>The rest of the newsroom remains live.</p><button type="button" onClick={retry}>Retry video desk</button></div>}
    <div className="desk-video-note"><span>VIDEO DESK</span><p>{!active&&loadState!=="loading"?"Using the publisher playlist while the latest-video feed recovers. ":""}Videos open in YouTube&apos;s privacy-enhanced player. Publishers control availability, advertising and embedding.</p>{active?<a href={active.watchUrl} target="_blank" rel="noreferrer">Watch on publisher channel ↗</a>:fallbackSource?<a href={fallbackSource.channelUrl} target="_blank" rel="noreferrer">Publisher channel ↗</a>:loadState!=="loading"?<button type="button" onClick={retry}>Retry ↻</button>:null}</div>
  </section>;
}
