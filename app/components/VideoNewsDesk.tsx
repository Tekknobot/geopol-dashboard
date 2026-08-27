"use client";

import { useEffect, useMemo, useState } from "react";
import { uploadsPlaylistFor, VIDEO_DESKS, VIDEO_SOURCES, type VideoDesk } from "../video-sources";

type LatestVideo = { sourceId:string; videoId:string; title:string; publishedAt:string; watchUrl:string };
type VideoResponse = { videos:LatestVideo[]; fetchedAt:string; availableSources:number; totalSources:number };

const relativeTime=(publishedAt:string)=>{
  const elapsed=Math.max(0,Date.now()-Date.parse(publishedAt));
  const minutes=Math.floor(elapsed/60000);
  if(minutes<1)return "just now";
  if(minutes<60)return `${minutes}m ago`;
  const hours=Math.floor(minutes/60);
  if(hours<24)return `${hours}h ago`;
  const days=Math.floor(hours/24);
  if(days<7)return `${days}d ago`;
  return new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric"}).format(new Date(publishedAt));
};

export default function VideoNewsDesk(){
  const [activeId,setActiveId]=useState(VIDEO_SOURCES[0].id);
  const [activeDesk,setActiveDesk]=useState<"All"|VideoDesk>("All");
  const [playerLoaded,setPlayerLoaded]=useState(false);
  const [latestVideos,setLatestVideos]=useState<LatestVideo[]>([]);
  const [feedState,setFeedState]=useState<"loading"|"live"|"partial">("loading");

  useEffect(()=>{
    const controller=new AbortController();
    fetch("/api/video-news",{signal:controller.signal})
      .then((response)=>{if(!response.ok)throw new Error("Video feeds unavailable");return response.json() as Promise<VideoResponse>;})
      .then((data)=>{setLatestVideos(data.videos);setFeedState(data.availableSources===data.totalSources?"live":"partial");})
      .catch((error:unknown)=>{if((error as Error).name!=="AbortError")setFeedState("partial");});
    return()=>controller.abort();
  },[]);

  const worldSources=VIDEO_SOURCES.filter((source)=>!source.room);
  const activeSource=worldSources.find((source)=>source.id===activeId)??worldSources[0];
  const activeVideo=latestVideos.find((video)=>video.sourceId===activeSource.id);
  const visibleSources=useMemo(()=>activeDesk==="All"?worldSources:worldSources.filter((source)=>source.desk===activeDesk),[activeDesk,worldSources]);
  const playlistId=uploadsPlaylistFor(activeSource.channelId);
  const playerUrl=activeVideo?`https://www.youtube-nocookie.com/embed/${activeVideo.videoId}?rel=0&list=${playlistId}`:`https://www.youtube-nocookie.com/embed/videoseries?list=${playlistId}&rel=0`;

  const selectSource=(id:string)=>{setActiveId(id);setPlayerLoaded(false);};
  const selectDesk=(desk:"All"|VideoDesk)=>{
    setActiveDesk(desk);
    const firstSource=desk==="All"?worldSources[0]:worldSources.find((source)=>source.desk===desk);
    if(firstSource)selectSource(firstSource.id);
  };

  return(
    <section className="video-news-panel panel" id="video-intelligence-section">
      <div className="panel-heading video-news-heading">
        <div><p>OFFICIAL PUBLISHER VIDEO</p><h3>Video intelligence</h3><span>Latest uploads from {worldSources.length} selected international newsrooms</span></div>
        <div className={`video-news-status ${feedState}`}><i/>{feedState==="loading"?"CHECKING FEEDS":"PUBLISHER FEEDS"}</div>
      </div>

      <div className="video-desk-filters" aria-label="Filter video sources">
        {VIDEO_DESKS.map((desk)=><button key={desk} type="button" className={activeDesk===desk?"active":""} onClick={()=>selectDesk(desk)} aria-pressed={activeDesk===desk}>{desk}<span>{desk==="All"?worldSources.length:worldSources.filter((source)=>source.desk===desk).length}</span></button>)}
      </div>

      <div className="video-news-layout">
        <div className="video-player-shell">
          {playerLoaded?<iframe key={`${activeSource.id}-${activeVideo?.videoId??"playlist"}`} src={playerUrl} title={activeVideo?.title??`${activeSource.name} latest video reports`} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen/>:
          <div className="video-consent">
            <div className="video-preplay-badges"><span>OFFICIAL CHANNEL</span><span>{activeSource.desk.toUpperCase()}</span><span>NO AUTOPLAY</span></div>
            <div className="video-preplay-main">
              <button className="video-play" type="button" onClick={()=>setPlayerLoaded(true)} aria-label={`Play ${activeVideo?.title??`the latest ${activeSource.name} report`}`}><span aria-hidden>▶</span></button>
              <div className="video-consent-copy"><small>{activeSource.region}</small><strong>{activeVideo?.title??`Latest ${activeSource.name} reports`}</strong><em>{activeVideo?.publishedAt?`Published ${relativeTime(activeVideo.publishedAt)} · `:"Latest publisher uploads · "}{activeSource.name}</em></div>
            </div>
            <div className="video-preplay-footer"><span>{activeSource.focus}</span><span>Clicking play loads YouTube&apos;s privacy-enhanced player</span></div>
          </div>}
        </div>

        <aside className="video-source-list" aria-label="Video publishers">
          <div className="video-source-label"><span>{activeDesk==="All"?"SELECT SOURCE":activeDesk.toUpperCase()}</span><small>{visibleSources.length} official channels</small></div>
          <div className="video-source-scroll">
            {visibleSources.map((source)=>{const sourceVideo=latestVideos.find((video)=>video.sourceId===source.id);return <button key={source.id} type="button" className={activeSource.id===source.id?"active":""} onClick={()=>selectSource(source.id)} aria-pressed={activeSource.id===source.id}><i/><span><strong>{source.name}</strong><small>{sourceVideo?.publishedAt?`Latest ${relativeTime(sourceVideo.publishedAt)} · ${source.region}`:source.focus}</small></span><em>→</em></button>;})}
          </div>
          <div className="video-source-actions">{activeVideo&&<a href={activeVideo.watchUrl} target="_blank" rel="noreferrer">Open this video ↗</a>}<a href={activeSource.channelUrl} target="_blank" rel="noreferrer">Publisher channel ↗</a></div>
        </aside>
      </div>

      <div className="video-news-note"><span>EDITORIAL NOTE</span><p>Atlas presents official publisher uploads for comparison; inclusion is not an endorsement of every report. Playback stays in YouTube&apos;s official player. Atlas does not copy, edit or rehost footage, and each publisher controls availability, advertising and embedding.</p></div>
    </section>
  );
}
