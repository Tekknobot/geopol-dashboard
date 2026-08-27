"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import DeskVideoSection from "./DeskVideoSection";
import { useSavedStories } from "./useSavedStories";
import { ReleaseRadar, SportsMatchHub } from "./NewsroomFeatures";
import MobileSiteNav from "./MobileSiteNav";

const WorldEventMap = dynamic(() => import("./WorldEventMap"), {
  ssr: false,
  loading: () => <div className="map-loading">Mapping live headlines…</div>,
});

type Desk = "entertainment" | "sports";
type Story = {
  id:number;
  desk:"world"|Desk;
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
  location?:{name:string;lat:number;lng:number;precision:"country"|"hotspot"};
};
type NewsResponse = {stories:Story[];sources:string[];fetchedAt:string;failedFeeds:number;totalFeeds:number};

export type DeskConfig = {
  desk:Desk;
  eyebrow:string;
  title:string;
  intro:string;
  categories:Array<{name:string;description:string;glyph:string}>;
  lenses:Array<{title:string;copy:string;topics:string[]}>;
};

const regions=["All regions","Canada","Global","Middle East","Europe","Asia Pacific","Africa","Americas"];
const exactTime=(value:string)=>new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));
const relativeTime=(value:string,now:number)=>{
  const elapsed=Math.max(0,now-Date.parse(value));
  const minutes=Math.floor(elapsed/60000);
  if(minutes<1)return "just now";
  if(minutes<60)return `${minutes}m ago`;
  const hours=Math.floor(minutes/60);
  if(hours<24)return `${hours}h ago`;
  const days=Math.floor(hours/24);
  return days<7?`${days}d ago`:new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric"}).format(new Date(value));
};
const storyImage=(story:Story)=>story.imageUrl??`/api/article-image?url=${encodeURIComponent(story.articleUrl)}`;

function StoryImage({story,className=""}:{story:Story;className?:string}){
  return <div className={`desk-story-image ${className}`}>
    <div className="desk-image-fallback"><span>{story.category.slice(0,2).toUpperCase()}</span><small>{story.source}</small></div>
    <img loading="lazy" decoding="async" src={storyImage(story)} alt={`${story.source} image for ${story.title}`} referrerPolicy="no-referrer" onError={(event)=>{event.currentTarget.style.display="none";}}/>
  </div>;
}

export default function DeskPage({config}:{config:DeskConfig}){
  const [stories,setStories]=useState<Story[]>([]);
  const [status,setStatus]=useState<"loading"|"live"|"partial"|"error">("loading");
  const [fetchedAt,setFetchedAt]=useState<string|null>(null);
  const [clock,setClock]=useState(()=>Date.now());
  const [heroIndex,setHeroIndex]=useState(0);
  const [topic,setTopic]=useState("All");
  const [region,setRegion]=useState("All regions");
  const [query,setQuery]=useState("");
  const [appliedQuery,setAppliedQuery]=useState("");
  const heroTouchX=useRef<number|null>(null);
  const {savedIds,toggleSaved}=useSavedStories();

  const loadNews=useCallback(async()=>{
    setStatus((current)=>current==="error"?"loading":current);
    try{
      const response=await fetch(`/api/news?desk=${config.desk}`,{signal:AbortSignal.timeout(8500)});
      if(!response.ok)throw new Error("feed unavailable");
      const data=await response.json() as NewsResponse;
      const deskStories=data.stories.filter((story)=>story.desk===config.desk);
      if(!deskStories.length)throw new Error("desk empty");
      setStories(deskStories);
      setFetchedAt(data.fetchedAt);
      setStatus(data.failedFeeds>0?"partial":"live");
      setHeroIndex((current)=>Math.min(current,Math.max(0,deskStories.length-1)));
    }catch{setStatus("error");}
  },[config.desk]);

  useEffect(()=>{
    const initial=window.setTimeout(()=>void loadNews(),0);
    const refresh=window.setInterval(()=>{if(document.visibilityState==="visible")void loadNews();},900000);
    const timer=window.setInterval(()=>setClock(Date.now()),60000);
    return()=>{window.clearTimeout(initial);window.clearInterval(refresh);window.clearInterval(timer);};
  },[loadNews]);

  const categories=useMemo(()=>{
    const counts=new Map<string,number>();
    stories.forEach((story)=>counts.set(story.category,(counts.get(story.category)??0)+1));
    return config.categories.map((item)=>({...item,count:counts.get(item.name)??0})).filter((item)=>item.count>0);
  },[config.categories,stories]);
  const sources=useMemo(()=>new Set(stories.map((story)=>story.source)).size,[stories]);
  const mapped=useMemo(()=>stories.filter((story)=>story.location).length,[stories]);
  const fresh=useMemo(()=>stories.filter((story)=>clock-Date.parse(story.publishedAt)<=6*60*60*1000).length,[clock,stories]);
  const filtered=useMemo(()=>{
    const needle=appliedQuery.toLowerCase();
    return stories.filter((story)=>{
      const matchesTopic=topic==="All"||story.category===topic;
      const matchesRegion=region==="All regions"||story.region===region;
      const haystack=[story.title,story.summary,story.category,story.region,story.source,...story.tags].join(" ").toLowerCase();
      return matchesTopic&&matchesRegion&&(!needle||haystack.includes(needle));
    });
  },[appliedQuery,region,stories,topic]);
  const hero=stories[heroIndex]??null;
  const submitSearch=(event:FormEvent)=>{event.preventDefault();setAppliedQuery(query.trim());document.getElementById("desk-wire")?.scrollIntoView({behavior:"smooth"});};
  const selectTopic=(value:string)=>{setTopic(value);document.getElementById("desk-wire")?.scrollIntoView({behavior:"smooth"});};
  const reset=()=>{setTopic("All");setRegion("All regions");setQuery("");setAppliedQuery("");};
  const stepHero=(direction:-1|1)=>setHeroIndex((current)=>stories.length?(current+direction+stories.length)%stories.length:0);
  const finishHeroSwipe=(clientX:number)=>{if(heroTouchX.current===null)return;const delta=clientX-heroTouchX.current;heroTouchX.current=null;if(Math.abs(delta)>=44)stepHero(delta>0?-1:1);};

  return <main className="desk-page" data-desk={config.desk}>
    <header className="desk-global-nav">
      <Link className="desk-brand" href="/"><img src="/favicon.svg" alt=""/>ATLAS<span>.</span></Link>
      <nav aria-label="ATLAS newsrooms"><Link href="/">World</Link><Link href="/world-grid">Grid</Link><Link href="/intelligence">Intelligence</Link><Link aria-current={config.desk==="entertainment"?"page":undefined} className={config.desk==="entertainment"?"active":""} href="/entertainment">Entertainment</Link><Link aria-current={config.desk==="sports"?"page":undefined} className={config.desk==="sports"?"active":""} href="/sports">Sports</Link></nav>
      <button onClick={()=>void loadNews()} className={`desk-live ${status}`}><i/>{status==="loading"?"Connecting":status==="error"?"Retry feeds":status==="partial"?"Partial feed":"Live desk"}</button>
    </header>
    <MobileSiteNav/>

    <nav className="desk-mobile-tabs" aria-label="Switch newsroom"><Link href="/">World</Link><Link href="/world-grid">Grid</Link><Link aria-current={config.desk==="entertainment"?"page":undefined} className={config.desk==="entertainment"?"active":""} href="/entertainment">Entertainment</Link><Link aria-current={config.desk==="sports"?"page":undefined} className={config.desk==="sports"?"active":""} href="/sports">Sports</Link></nav>

    <section className="desk-masthead">
      <div className="desk-title-block"><p>{config.eyebrow}</p><h1>{config.title}</h1><span>{config.intro}</span></div>
      <form className="desk-search" onSubmit={submitSearch}><span>⌕</span><input aria-label={`Search ${config.desk} headlines`} placeholder={`Search ${config.desk}, people, teams, places`} value={query} onChange={(event)=>setQuery(event.target.value)}/><button type="submit">Search</button></form>
    </section>

    <div className="desk-ticker" aria-label="Latest headline ticker"><strong>NOW</strong><div>{stories.slice(0,8).map((story)=><a key={story.id} href={story.articleUrl} target="_blank" rel="noreferrer"><span>{story.category}</span>{story.title}</a>)}</div></div>

    <section className="desk-topic-bar" aria-label={`${config.desk} categories`}><button className={topic==="All"?"active":""} onClick={()=>setTopic("All")}>All <span>{stories.length}</span></button>{categories.map((item)=><button key={item.name} className={topic===item.name?"active":""} onClick={()=>selectTopic(item.name)}>{item.name}<span>{item.count}</span></button>)}</section>

    <section className="desk-lead-grid">
      {hero?<section className="desk-hero" aria-label="Top story carousel" onTouchStart={(event)=>{heroTouchX.current=event.touches[0]?.clientX??null;}} onTouchEnd={(event)=>finishHeroSwipe(event.changedTouches[0]?.clientX??0)}>
        <StoryImage story={hero} className="desk-hero-image"/>
        <div className="desk-hero-shade"/>
        <div className="desk-hero-copy"><p><span>TOP STORY</span>{hero.category} · {hero.region}</p><h2>{hero.title}</h2><div className="desk-hero-meta"><strong>{hero.source}</strong><time dateTime={hero.publishedAt} title={exactTime(hero.publishedAt)}>{relativeTime(hero.publishedAt,clock)}</time><span>{hero.read} read</span></div><p className="desk-hero-summary">{hero.summary}</p><div className="desk-hero-actions"><a href={hero.articleUrl} target="_blank" rel="noreferrer">Read original story ↗</a><button type="button" className={savedIds.includes(hero.id)?"saved":""} onClick={()=>toggleSaved(hero)}>{savedIds.includes(hero.id)?"◆ Saved":"◇ Save"}</button></div></div>
        <button className="desk-carousel-arrow previous" onClick={()=>stepHero(-1)} aria-label="Previous top story">‹</button><button className="desk-carousel-arrow next" onClick={()=>stepHero(1)} aria-label="Next top story">›</button>
        <div className="desk-carousel-dots">{stories.slice(0,8).map((story,index)=><button key={story.id} className={index===heroIndex?"active":""} onClick={()=>setHeroIndex(index)} aria-label={`Show story ${index+1}`}/>)}</div>
        <span className="desk-carousel-count">{String(heroIndex+1).padStart(2,"0")} / {stories.length}</span>
      </section>:<section className="desk-hero desk-empty"><span className="feed-spinner"/><h2>{status==="error"?"Publisher feeds are temporarily unavailable":"Loading live headlines…"}</h2><p>ATLAS only displays stories supplied by publisher feeds—no fabricated placeholder headlines.</p>{status==="error"&&<button onClick={()=>void loadNews()}>Try again</button>}</section>}
      <aside className="desk-lead-rail" aria-label="More top stories"><div className="desk-lead-rail-heading"><span>TOP STORIES</span><small>LIVE DESK</small></div>{stories.slice(1,5).map((story,index)=><button key={story.id} onClick={()=>setHeroIndex(index+1)} className={heroIndex===index+1?"active":""}><span>{String(index+1).padStart(2,"0")}</span><div><p>{story.category} · {relativeTime(story.publishedAt,clock)}</p><h3>{story.title}</h3><small>{story.source}</small></div></button>)}</aside>
    </section>

    <section className="desk-metrics" aria-label="Desk coverage"><article><span>LIVE STORIES</span><strong>{stories.length}</strong><small>in the current wire</small></article><article><span>PUBLISHERS</span><strong>{sources}</strong><small>original sources</small></article><article><span>MAPPED</span><strong>{mapped}</strong><small>located headlines</small></article><article><span>FRESH · 6H</span><strong>{fresh}</strong><small>recent updates</small></article></section>

    <section className="desk-layout">
      <div className="desk-main-column">
        <section className="desk-featured"><div className="desk-section-heading"><div><p>VISUAL EDIT</p><h2>Picture-led stories</h2></div><span>Publisher imagery · original links</span></div><div className="desk-card-rail">{stories.slice(1,7).map((story)=><article key={story.id}><a href={story.articleUrl} target="_blank" rel="noreferrer"><StoryImage story={story}/><div><p>{story.category} · {story.region}</p><h3>{story.title}</h3><span>{story.source} · <time dateTime={story.publishedAt}>{relativeTime(story.publishedAt,clock)}</time></span></div></a></article>)}</div></section>

        <DeskVideoSection desk={config.desk}/>

        {config.desk==="entertainment"?<ReleaseRadar stories={stories}/>:<SportsMatchHub stories={stories}/>}

        <section className="desk-map-section"><div className="desk-section-heading"><div><p>GLOBAL FOOTPRINT</p><h2>{config.desk==="sports"?"Where sport is happening":"Where culture is moving"}</h2></div><span>{mapped} live locations</span></div><WorldEventMap mode="Events" stories={stories} filter={[topic==="All"?"":topic,region==="All regions"?"":region,appliedQuery].filter(Boolean).join(" ")}/></section>

        <section className="desk-wire" id="desk-wire"><div className="desk-section-heading wire-heading"><div><p>LIVE HEADLINE WIRE</p><h2>{topic==="All"?`Latest ${config.desk}`:topic}</h2><span>{filtered.length} verified headline{filtered.length===1?"":"s"}</span></div><select value={region} onChange={(event)=>setRegion(event.target.value)} aria-label="Filter headlines by region">{regions.map((item)=><option key={item}>{item}</option>)}</select></div>{status==="partial"&&<p className="desk-feed-note">Some publishers are temporarily unavailable. Available stories retain their original links and publication times.</p>}<div className="desk-wire-list">{filtered.map((story)=><article key={story.id}><a href={story.articleUrl} target="_blank" rel="noreferrer"><span className={`status-dot ${story.level}`}/><div><p>{story.category} · {story.region}</p><h3>{story.title}</h3><small>{story.source} · <time dateTime={story.publishedAt} title={exactTime(story.publishedAt)}>{relativeTime(story.publishedAt,clock)}</time> · {story.read}</small></div><b>↗</b></a><button type="button" className={`desk-wire-save ${savedIds.includes(story.id)?"saved":""}`} onClick={()=>toggleSaved(story)} aria-label={`${savedIds.includes(story.id)?"Remove":"Save"} ${story.title}`}>{savedIds.includes(story.id)?"◆":"◇"}</button></article>)}</div>{!filtered.length&&status!=="loading"&&<div className="desk-no-results"><strong>No matching headlines</strong><p>Try another topic, region or search phrase.</p><button onClick={reset}>Reset filters</button></div>}</section>
      </div>

      <aside className="desk-side-column">
        <section className="desk-lenses"><div className="desk-section-heading"><div><p>EDITORIAL LENSES</p><h2>Explore the desk</h2></div></div>{config.lenses.map((lens)=><article key={lens.title}><h3>{lens.title}</h3><p>{lens.copy}</p><div>{lens.topics.map((item)=><button key={item} onClick={()=>selectTopic(item)}>{item}</button>)}</div></article>)}</section>
        <section className="desk-category-index"><div className="desk-section-heading"><div><p>FULL COVERAGE</p><h2>Category index</h2></div></div>{categories.map((item)=><button key={item.name} onClick={()=>selectTopic(item.name)}><span>{item.glyph}</span><div><strong>{item.name}</strong><small>{item.description}</small></div><b>{item.count}</b></button>)}</section>
        <section className="desk-provenance"><span>ABOUT THIS DESK</span><h2>Source-first coverage</h2><p>Headlines, images, timestamps and links come from publisher feeds. Geographic pins appear only when a story names a recognized country, city or event hub.</p><small>{fetchedAt?`Feeds checked ${exactTime(fetchedAt)}`:"Connecting publisher feeds"}</small></section>
      </aside>
    </section>

    <footer className="desk-footer"><Link href="/">ATLAS World News</Link><span>World · Grid · Entertainment · Sports</span><span>Map © OpenStreetMap contributors</span></footer>
  </main>;
}
