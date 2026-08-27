"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import MobileSiteNav from "../components/MobileSiteNav";
import { useSavedStories } from "../components/useSavedStories";

type Story = {
  id:number;
  desk:"world"|"entertainment"|"sports";
  category:string;
  region:string;
  publishedAt:string;
  level:"critical"|"elevated"|"watch"|"stable";
  title:string;
  summary:string;
  source:string;
  read:string;
  tags:string[];
  articleUrl:string;
  imageUrl?:string;
};

type NewsResponse = {
  stories:Story[];
  sources:string[];
  fetchedAt:string;
  failedFeeds:number;
  totalFeeds:number;
};

type DeskFilter = "all"|Story["desk"];
type SortMode = "latest"|"priority"|"visual";

const PAGE_SIZE=36;
const regions=["All regions","Canada","Global","Middle East","Europe","Asia Pacific","Africa","Americas"];
const editorialTopics=["All","Conflict","Politics","Economy","Technology","Climate","Disasters","Science","Film","Music","Gaming","Football","Basketball","Hockey"];
const priorityRank:Record<Story["level"],number>={critical:4,elevated:3,watch:2,stable:1};

const relativeTime=(value:string,now:number)=>{
  const elapsed=Math.max(0,now-Date.parse(value));
  const minutes=Math.floor(elapsed/60000);
  if(minutes<1)return "just now";
  if(minutes<60)return `${minutes}m ago`;
  const hours=Math.floor(minutes/60);
  if(hours<24)return `${hours}h ago`;
  const days=Math.floor(hours/24);
  if(days<7)return `${days}d ago`;
  return new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric"}).format(new Date(value));
};
const exactTime=(value:string)=>new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));
const storyImage=(story:Story)=>story.imageUrl??`/api/article-image?url=${encodeURIComponent(story.articleUrl)}`;
const deskLabel=(desk:Story["desk"])=>desk==="world"?"World":desk==="sports"?"Sports":"Entertainment";

function GridImage({story}:{story:Story}){
  const [failed,setFailed]=useState(false);
  return <div className="world-grid-image">
    <div className="world-grid-image-fallback"><span>{story.category.slice(0,2).toUpperCase()}</span><small>{story.source}</small></div>
    {!failed&&<img loading="lazy" decoding="async" src={storyImage(story)} alt={`${story.source} image for ${story.title}`} referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>}    
    <span className={`world-grid-desk-tag ${story.desk}`}>{deskLabel(story.desk)}</span>
  </div>;
}

export default function WorldGrid(){
  const [stories,setStories]=useState<Story[]>([]);
  const [status,setStatus]=useState<"loading"|"live"|"partial"|"error">("loading");
  const [clock,setClock]=useState(()=>Date.now());
  const [fetchedAt,setFetchedAt]=useState<string|null>(null);
  const [desk,setDesk]=useState<DeskFilter>("all");
  const [topic,setTopic]=useState("All");
  const [region,setRegion]=useState("All regions");
  const [source,setSource]=useState("All sources");
  const [sort,setSort]=useState<SortMode>("latest");
  const [query,setQuery]=useState("");
  const [appliedQuery,setAppliedQuery]=useState("");
  const [visibleCount,setVisibleCount]=useState(PAGE_SIZE);
  const sentinel=useRef<HTMLDivElement|null>(null);
  const {savedIds,toggleSaved}=useSavedStories();

  const loadNews=useCallback(async()=>{
    setStatus((current)=>current==="error"?"loading":current);
    try{
      const response=await fetch("/api/news",{signal:AbortSignal.timeout(9000)});
      if(!response.ok)throw new Error("Publisher feeds unavailable");
      const data=await response.json() as NewsResponse;
      if(!data.stories.length)throw new Error("No publisher stories");
      setStories(data.stories);
      setFetchedAt(data.fetchedAt);
      setStatus(data.failedFeeds>0?"partial":"live");
    }catch{
      setStatus("error");
    }
  },[]);

  useEffect(()=>{
    const initial=window.setTimeout(()=>void loadNews(),0);
    const refresh=window.setInterval(()=>{if(document.visibilityState==="visible")void loadNews();},900000);
    const ticker=window.setInterval(()=>setClock(Date.now()),60000);
    return()=>{window.clearTimeout(initial);window.clearInterval(refresh);window.clearInterval(ticker);};
  },[loadNews]);

  const sources=useMemo(()=>["All sources",...[...new Set(stories.map((story)=>story.source))].sort((a:string,b:string)=>a.localeCompare(b))],[stories]);
  const activeTopics=useMemo(()=>editorialTopics.filter((item)=>item==="All"||stories.some((story)=>story.category===item)),[stories]);
  const deskCounts=useMemo(()=>stories.reduce((acc,story)=>{acc[story.desk]=(acc[story.desk]??0)+1;return acc;},{} as Record<Story["desk"],number>),[stories]);

  const filtered=useMemo(()=>{
    const needle=appliedQuery.trim().toLowerCase();
    const next=stories.filter((story)=>{
      const matchesDesk=desk==="all"||story.desk===desk;
      const matchesTopic=topic==="All"||story.category===topic;
      const matchesRegion=region==="All regions"||story.region===region;
      const matchesSource=source==="All sources"||story.source===source;
      const haystack=[story.title,story.summary,story.source,story.category,story.region,...story.tags].join(" ").toLowerCase();
      return matchesDesk&&matchesTopic&&matchesRegion&&matchesSource&&(!needle||haystack.includes(needle));
    });
    return [...next].sort((a,b)=>{
      if(sort==="priority")return priorityRank[b.level]-priorityRank[a.level]||Date.parse(b.publishedAt)-Date.parse(a.publishedAt);
      if(sort==="visual")return Number(Boolean(b.imageUrl))-Number(Boolean(a.imageUrl))||Date.parse(b.publishedAt)-Date.parse(a.publishedAt);
      return Date.parse(b.publishedAt)-Date.parse(a.publishedAt);
    });
  },[appliedQuery,desk,region,sort,source,stories,topic]);

  useEffect(()=>setVisibleCount(PAGE_SIZE),[appliedQuery,desk,region,sort,source,topic]);

  useEffect(()=>{
    const node=sentinel.current;
    if(!node||visibleCount>=filtered.length)return;
    const observer=new IntersectionObserver((entries)=>{
      if(entries.some((entry)=>entry.isIntersecting))setVisibleCount((count)=>Math.min(filtered.length,count+PAGE_SIZE));
    },{rootMargin:"500px 0px"});
    observer.observe(node);
    return()=>observer.disconnect();
  },[filtered.length,visibleCount]);

  const visible=filtered.slice(0,visibleCount);
  const fresh=stories.filter((story)=>clock-Date.parse(story.publishedAt)<=6*60*60*1000).length;
  const publisherCount=new Set(stories.map((story)=>story.source)).size;
  const regionCount=new Set(stories.map((story)=>story.region)).size;
  const reset=()=>{setDesk("all");setTopic("All");setRegion("All regions");setSource("All sources");setSort("latest");setQuery("");setAppliedQuery("");};
  const submitSearch=(event:FormEvent)=>{event.preventDefault();setAppliedQuery(query.trim());};

  return <main className="world-grid-page">
    <header className="world-grid-global-nav">
      <Link className="world-grid-brand" href="/"><img src="/favicon.svg" alt=""/>ATLAS<span>.</span></Link>
      <nav aria-label="ATLAS views"><Link href="/">World</Link><Link href="/world-grid" className="active" aria-current="page">Grid</Link><Link href="/intelligence">Intelligence</Link><Link href="/entertainment">Entertainment</Link><Link href="/sports">Sports</Link></nav>
      <button type="button" className={`world-grid-live ${status}`} onClick={()=>void loadNews()}><i/>{status==="loading"?"Connecting":status==="error"?"Retry feeds":status==="partial"?"Partial feed":"Live grid"}</button>
    </header>
    <MobileSiteNav/>

    <section className="world-grid-masthead">
      <div>
        <p>ATLAS WORLD GRID / LIVE</p>
        <h1>The world, at a glance.</h1>
        <span>Every current ATLAS headline in one visual stream — world affairs, sport and culture, sourced from publisher feeds.</span>
      </div>
      <div className="world-grid-snapshot" aria-label="Live grid coverage">
        <div><strong>{stories.length?stories.length:"—"}</strong><span>HEADLINES</span></div>
        <div><strong>{stories.length?publisherCount:"—"}</strong><span>PUBLISHERS</span></div>
        <div><strong>{stories.length?fresh:"—"}</strong><span>FRESH · 6H</span></div>
        <div><strong>{stories.length?regionCount:"—"}</strong><span>REGIONS</span></div>
      </div>
    </section>

    <section className="world-grid-controls" aria-label="World Grid controls">
      <div className="world-grid-desk-tabs">
        <button type="button" className={desk==="all"?"active":""} onClick={()=>setDesk("all")}>All <span>{stories.length}</span></button>
        <button type="button" className={desk==="world"?"active":""} onClick={()=>setDesk("world")}>World <span>{deskCounts.world??0}</span></button>
        <button type="button" className={desk==="sports"?"active":""} onClick={()=>setDesk("sports")}>Sports <span>{deskCounts.sports??0}</span></button>
        <button type="button" className={desk==="entertainment"?"active":""} onClick={()=>setDesk("entertainment")}>Entertainment <span>{deskCounts.entertainment??0}</span></button>
      </div>
      <form className="world-grid-search" onSubmit={submitSearch}><span aria-hidden>⌕</span><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search headlines, people, places, teams…" aria-label="Search World Grid"/><button type="submit">Search</button></form>
      <div className="world-grid-selects">
        <label><span>Region</span><select value={region} onChange={(event)=>setRegion(event.target.value)}>{regions.map((item)=><option key={item}>{item}</option>)}</select></label>
        <label><span>Source</span><select value={source} onChange={(event)=>setSource(event.target.value)}>{sources.map((item)=><option key={item}>{item}</option>)}</select></label>
        <label><span>Order</span><select value={sort} onChange={(event)=>setSort(event.target.value as SortMode)}><option value="latest">Latest</option><option value="priority">Priority</option><option value="visual">Image first</option></select></label>
      </div>
      <div className="world-grid-topic-strip" aria-label="Quick topic filters">{activeTopics.map((item)=><button type="button" key={item} className={topic===item?"active":""} onClick={()=>setTopic(item)}>{item}</button>)}</div>
    </section>

    <section className="world-grid-results-heading">
      <div><p>VISUAL HEADLINE WALL</p><h2>{appliedQuery?`Search: “${appliedQuery}”`:desk==="all"&&topic==="All"?"Latest across ATLAS":topic!=="All"?topic:`${deskLabel(desk as Story["desk"])} desk`}</h2></div>
      <span>{filtered.length} result{filtered.length===1?"":"s"}{fetchedAt?` · updated ${relativeTime(fetchedAt,clock)}`:""}</span>
    </section>

    {status==="partial"&&<div className="world-grid-feed-note"><strong>Partial live feed.</strong> Some publishers did not answer this refresh; available stories remain linked to their original reports.</div>}
    {status==="error"&&stories.length>0&&<div className="world-grid-feed-note"><strong>Refresh unavailable.</strong> Keeping the last successful grid on screen. Use “Retry feeds” to reconnect.</div>}

    {status==="error"&&!stories.length?<section className="world-grid-state"><span className="feed-spinner"/><h2>Publisher feeds are temporarily unavailable</h2><p>World Grid does not substitute placeholder headlines. Retry the live publisher feed.</p><button type="button" onClick={()=>void loadNews()}>Retry feeds</button></section>:
    status==="loading"&&!stories.length?<section className="world-grid-state"><span className="feed-spinner"/><h2>Building the live grid…</h2><p>Connecting to publisher feeds and arranging the latest visual stories.</p></section>:
    <>
      <section className="world-grid-cards" aria-live="polite">
        {visible.map((story,index)=><article key={story.id} className={`world-grid-card ${index===0&&sort!=="visual"?"lead":""} ${story.level}`}>
          <a href={story.articleUrl} target="_blank" rel="noreferrer" className="world-grid-card-link">
            <GridImage story={story}/>
            <div className="world-grid-card-copy">
              <p><span>{story.category}</span><b>·</b>{story.region}</p>
              <h3>{story.title}</h3>
              <div><strong>{story.source}</strong><time dateTime={story.publishedAt} title={exactTime(story.publishedAt)}>{relativeTime(story.publishedAt,clock)}</time><span>{story.read}</span></div>
            </div>
          </a>
          <button type="button" className={`world-grid-save ${savedIds.includes(story.id)?"saved":""}`} onClick={()=>toggleSaved(story)} aria-label={`${savedIds.includes(story.id)?"Remove":"Save"} ${story.title}`}>{savedIds.includes(story.id)?"◆":"◇"}</button>
        </article>)}
      </section>
      {!filtered.length&&<section className="world-grid-state compact"><h2>No matching headlines</h2><p>Try a different desk, topic, publisher, region or search phrase.</p><button type="button" onClick={reset}>Reset filters</button></section>}
      {visibleCount<filtered.length&&<div ref={sentinel} className="world-grid-load-more"><button type="button" onClick={()=>setVisibleCount((count)=>Math.min(filtered.length,count+PAGE_SIZE))}>Load more · {filtered.length-visibleCount} remaining</button></div>}
    </>}

    <footer className="world-grid-footer"><Link href="/">ATLAS World News</Link><span>World Grid · {stories.length} live headlines</span><span>{fetchedAt?`Feeds checked ${exactTime(fetchedAt)}`:"Publisher feed connection"}</span></footer>
  </main>;
}
