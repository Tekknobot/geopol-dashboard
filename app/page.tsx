"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { MapMode } from "./components/WorldEventMap";
import { NEWS_CATEGORIES } from "./news-taxonomy";
import { useSavedStories } from "./components/useSavedStories";
import { StoryThreads } from "./components/NewsroomFeatures";
import MobileSiteNav from "./components/MobileSiteNav";

const WorldEventMap = dynamic(() => import("./components/WorldEventMap"), { ssr: false, loading: () => <div className="map-loading">Loading intelligence map…</div> });

type Story = { id:number; desk:"world"|"entertainment"|"sports"; category:string; region:string; publishedAt:string; level:"critical"|"elevated"|"watch"|"stable"; title:string; summary:string; source:string; read:string; tags:string[]; articleUrl:string; imageUrl?:string; location?:{name:string;lat:number;lng:number;precision:"country"|"hotspot"} };
type NewsResponse = { stories:Story[]; sources:string[]; fetchedAt:string; failedFeeds:number; totalFeeds:number };
type MarketQuote = { id:string; label:string; value:number; display:string; change:number|null; changeDisplay:string; asOf:string; source:string; sourceUrl:string; cadence:string };
type MarketSource = { id:string; label:string; cadence:string; status:"live"|"available"|"degraded"|"unavailable"; asOf:string|null; sourceUrl:string; route:"primary"|"fallback"|"unavailable"; detail:string; attempts:Array<{provider:string;status:"ok"|"failed";detail:string}> };
type MarketResponse = { fetchedAt:string; status:"live"|"degraded"|"partial"|"unavailable"; crypto:MarketQuote[]; fx:MarketQuote[]; treasury:MarketQuote[]; curve:{twoTen:number|null;threeMonthTen:number|null}; positioning:null|{label:string;leveragedNet:number;assetManagerNet:number;openInterest:number;asOf:string;source:string;sourceUrl:string;cadence:string}; breadth:null|{asOf:string;advances:number;declines:number;unchanged:number;participation:number;netAdvances:number;advanceDeclineRatio:number}; volatility:null|{asOf:string;points:Array<{id:string;label:string;value:number}>;frontBackSpread:number;shape:"contango"|"flat"|"backwardation"}; regime:null|{score:number;label:string;asOf:string;components:Record<string,number>;method:string}; sources:MarketSource[] };
type PressureComponent = { id:string; label:string; value:number; weight:number; source:string; sourceUrl?:string; asOf:string; detail:string; tone:"red"|"orange"|"amber"|"blue" };
type PressureIndex = { score:number; label:string; coverage:number; asOf:string; driver:string; components:PressureComponent[] };

const sourceUrlForStory = (story:Story) => story.articleUrl;
const sourceActionForStory = () => "Read original";
const relativeTime = (publishedAt:string,now:number) => {
  const elapsed=Math.max(0,now-Date.parse(publishedAt));
  const minutes=Math.floor(elapsed/60000);
  if(minutes<1)return "just now";
  if(minutes<60)return `${minutes}m ago`;
  const hours=Math.floor(minutes/60);
  if(hours<24)return `${hours}h ago`;
  const days=Math.floor(hours/24);
  if(days<7)return `${days}d ago`;
  return new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric"}).format(new Date(publishedAt));
};
const exactTime = (publishedAt:string) => new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short"}).format(new Date(publishedAt));
const sourceAge = (asOf:string|null,now:number) => asOf ? relativeTime(asOf,now) : "unavailable";
const compactNumber = (value:number) => new Intl.NumberFormat(undefined,{notation:"compact",maximumFractionDigits:1,signDisplay:"always"}).format(value);
const clampScore = (value:number) => Math.min(100,Math.max(0,value));

const regions = ["All regions","Canada","United States","Latin America & Caribbean","Europe","Middle East","Africa","South Asia","East Asia","Southeast Asia","Oceania & Pacific","Global"];
type HeroMedia = {image:string;credit:string;label:string};
const mediaForStory = (story:Story):HeroMedia => ({
  image:story.imageUrl??`/api/article-image?url=${encodeURIComponent(story.articleUrl)}`,
  credit:story.articleUrl,
  label:`${story.source} · publisher image`,
});
function WidgetSource({source,url,asOf,cadence,now,status="available"}:{source:string;url?:string;asOf:string|null;cadence:string;now:number;status?:"available"|"degraded"|"unavailable"}){
  return <div className={`widget-source ${status}`}><i/><span><b>{status==="unavailable"?"UNAVAILABLE":status==="degraded"?"FALLBACK ACTIVE":"PUBLIC DATA"}</b> · {url?<a href={url} target="_blank" rel="noreferrer">{source} ↗</a>:source} · {cadence} · <time dateTime={asOf??undefined} title={asOf?exactTime(asOf):cadence}>{asOf?sourceAge(asOf,now):"No observation"}</time></span></div>;
}

export default function Home(){
  const [stories,setStories]=useState<Story[]>([]);
  const [feedStatus,setFeedStatus]=useState<"loading"|"live"|"partial"|"error">("loading");
  const [feedSourceCount,setFeedSourceCount]=useState(0);
  const [lastFetchedAt,setLastFetchedAt]=useState<string|null>(null);
  const [clock,setClock]=useState(()=>Date.now());
  const [activeView,setActiveView]=useState("Overview");
  const [category,setCategory]=useState("All");
  const [region,setRegion]=useState("All regions");
  const [query,setQuery]=useState("");
  const [appliedQuery,setAppliedQuery]=useState("");
  const [mapMode,setMapMode]=useState<MapMode>("Events");
  const [heroIndex,setHeroIndex]=useState(0);
  const {savedStories,savedIds,toggleSaved}=useSavedStories();
  const [showAll,setShowAll]=useState(false);
  const [selectedStory,setSelectedStory]=useState<Story|null>(null);
  const [notificationsOpen,setNotificationsOpen]=useState(false);
  const [riskOpen,setRiskOpen]=useState(false);
  const [marketData,setMarketData]=useState<MarketResponse|null>(null);
  const [marketStatus,setMarketStatus]=useState<"loading"|"live"|"degraded"|"partial"|"unavailable">("loading");
  const heroTouchX=useRef<number|null>(null);
  const loadNews=useCallback(async()=>{
    setFeedStatus((status)=>status==="error"?"loading":status);
    try{
      const response=await fetch("/api/news",{signal:AbortSignal.timeout(8500)});
      if(!response.ok)throw new Error("Publisher feeds unavailable");
      const data=await response.json() as NewsResponse;
      if(!data.stories.length)throw new Error("No current publisher stories");
      setStories(data.stories);
      setCategory((current)=>current==="All"||data.stories.some((story)=>story.category===current)?current:"All");
      setFeedSourceCount(data.sources.length);
      setLastFetchedAt(data.fetchedAt);
      setFeedStatus(data.failedFeeds>0?"partial":"live");
      setHeroIndex((index)=>Math.min(index,data.stories.length-1));
    }catch{
      setFeedStatus("error");
    }
  },[]);
  const loadMarkets=useCallback(async()=>{
    try{
      const response=await fetch("/api/markets");
      if(!response.ok)throw new Error("Public market feeds unavailable");
      const data=await response.json() as MarketResponse;
      setMarketData(data);
      setMarketStatus(data.status);
    }catch{
      setMarketStatus("unavailable");
    }
  },[]);
  useEffect(()=>{
    const initialTimer=window.setTimeout(()=>void loadNews(),0);
    const marketInitialTimer=window.setTimeout(()=>void loadMarkets(),0);
    const newsTimer=window.setInterval(()=>{if(document.visibilityState==="visible")void loadNews();},900000);
    const marketTimer=window.setInterval(()=>{if(document.visibilityState==="visible")void loadMarkets();},300000);
    const clockTimer=window.setInterval(()=>setClock(Date.now()),60000);
    return ()=>{window.clearTimeout(initialTimer);window.clearTimeout(marketInitialTimer);window.clearInterval(newsTimer);window.clearInterval(marketTimer);window.clearInterval(clockTimer);};
  },[loadMarkets,loadNews]);
  const hero=stories[heroIndex]??null;
  const heroVisual=hero?mediaForStory(hero):null;

  const categoryCounts=useMemo(()=>{const counts=new Map<string,number>();for(const story of stories)counts.set(story.category,(counts.get(story.category)??0)+1);return counts;},[stories]);
  const deskCounts=useMemo(()=>stories.reduce((counts,story)=>({...counts,[story.desk]:(counts[story.desk]??0)+1}),{} as Record<Story["desk"],number>),[stories]);
  const visibleCategories=useMemo(()=>["All",...NEWS_CATEGORIES.filter((item)=>(categoryCounts.get(item)??0)>0)],[categoryCounts]);
  const coverageSnapshot=useMemo(()=>{
    const regionCounts=new Map<string,number>();
    const sourceNames=new Set<string>();
    let urgent=0;
    let recent=0;
    for(const story of stories){
      regionCounts.set(story.region,(regionCounts.get(story.region)??0)+1);
      sourceNames.add(story.source);
      if(story.level==="critical"||story.level==="elevated")urgent+=1;
      if(clock-Date.parse(story.publishedAt)<=6*60*60*1000)recent+=1;
    }
    const topRegions=[...regionCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4);
    const topCategory=[...categoryCounts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]??"—";
    return {regions:regionCounts.size,sources:sourceNames.size,urgent,recent,topRegions,topCategory};
  },[categoryCounts,clock,stories]);
  const filteredStories=useMemo(()=>{const needle=appliedQuery.trim().toLowerCase();return stories.filter((story)=>{const inCategory=category==="All"||story.category===category;const inRegion=region==="All regions"||story.region===region;const haystack=[story.title,story.summary,story.category,story.region,story.source,...story.tags].join(" ").toLowerCase();return inCategory&&inRegion&&(!needle||haystack.includes(needle));});},[appliedQuery,category,region,stories]);
  const publicQuotes=useMemo(()=>marketData?[...marketData.crypto,...marketData.fx,...marketData.treasury]:[],[marketData]);
  const quoteFor=(id:string)=>publicQuotes.find((quote)=>quote.id===id);
  const signalQuotes=[quoteFor("BTC-USD"),quoteFor("ETH-USD"),quoteFor("EUR-USD"),quoteFor("US-10Y")];
  const crossSources=[...new Set(publicQuotes.map((quote)=>quote.source))].join(" · ")||"Public providers";
  const crossOldestAsOf=publicQuotes.map((quote)=>quote.asOf).sort().at(0)??null;
  const fallbackActive=marketData?.sources.some((source)=>source.route==="fallback")??false;
  const breadthSource=marketData?.sources.find((source)=>source.id==="breadth");
  const volatilitySource=marketData?.sources.find((source)=>source.id==="volatility");
  const ratesSource=marketData?.sources.find((source)=>source.id==="rates");
  const volatilityMax=Math.max(...(marketData?.volatility?.points.map((point)=>point.value)??[1]));
  const pressureIndex=useMemo<PressureIndex|null>(()=>{
    const components:PressureComponent[]=[];
    const recentStories=stories.filter((story)=>story.desk==="world"&&clock-Date.parse(story.publishedAt)<=24*60*60*1000&&clock>=Date.parse(story.publishedAt));
    if(recentStories.length){
      const severity:Record<Story["level"],number>={critical:100,elevated:70,watch:35,stable:10};
      let weightedSeverity=0,recencyTotal=0;
      for(const story of recentStories){const ageHours=(clock-Date.parse(story.publishedAt))/3600000;const recency=Math.max(.2,1-ageHours/30);weightedSeverity+=severity[story.level]*recency;recencyTotal+=recency;}
      const urgent=recentStories.filter((story)=>story.level==="critical"||story.level==="elevated").length;
      const sourceCount=new Set(recentStories.map((story)=>story.source)).size;
      const newest=recentStories.map((story)=>story.publishedAt).sort().at(-1)!;
      components.push({id:"headlines",label:"Headline intensity",value:Math.round(weightedSeverity/recencyTotal),weight:.30,source:`${sourceCount} publisher feeds`,asOf:newest,detail:`${urgent} urgent · ${recentStories.length} stories in 24h`,tone:"red"});
    }
    const volatility=marketData?.volatility;
    if(volatility){
      const vix=volatility.points.find((point)=>point.id==="VIX")?.value;
      if(vix!==undefined){const curveAdjustment=volatility.shape==="backwardation"?18:volatility.shape==="flat"?6:0;components.push({id:"volatility",label:"Volatility stress",value:Math.round(clampScore(((vix-12)/23)*100+curveAdjustment)),weight:.25,source:volatilitySource?.label??"Cboe Volatility Indices",sourceUrl:volatilitySource?.sourceUrl,asOf:volatility.asOf,detail:`VIX ${vix.toFixed(1)} · ${volatility.shape}`,tone:"orange"});}
    }
    if(marketData?.breadth){const breadth=marketData.breadth;components.push({id:"breadth",label:"Market breadth stress",value:Math.round(clampScore(50+(50-breadth.participation)*2)),weight:.25,source:breadthSource?.label??"Nasdaq Daily Market Statistics",sourceUrl:breadthSource?.sourceUrl,asOf:breadth.asOf,detail:`${breadth.participation.toFixed(1)}% advancing · ${compactNumber(breadth.netAdvances)} net`,tone:"amber"});}
    if(marketData){
      const spreads=[marketData.curve.twoTen,marketData.curve.threeMonthTen].filter((value):value is number=>value!==null);
      const asOf=marketData.treasury.map((quote)=>quote.asOf).sort().at(0);
      if(spreads.length&&asOf){const value=Math.round(spreads.reduce((total,spread)=>total+clampScore(50-spread/2),0)/spreads.length);components.push({id:"rates",label:"Rate-curve stress",value,weight:.20,source:ratesSource?.label??"U.S. Treasury",sourceUrl:ratesSource?.sourceUrl,asOf,detail:`2s10s ${marketData.curve.twoTen===null?"—":`${marketData.curve.twoTen>=0?"+":""}${marketData.curve.twoTen.toFixed(0)} bp`} · 3m10y ${marketData.curve.threeMonthTen===null?"—":`${marketData.curve.threeMonthTen>=0?"+":""}${marketData.curve.threeMonthTen.toFixed(0)} bp`}`,tone:"blue"});}
    }
    const activeWeight=components.reduce((total,component)=>total+component.weight,0);
    if(components.length<2||activeWeight<.5)return null;
    const score=Math.round(components.reduce((total,component)=>total+component.value*component.weight,0)/activeWeight);
    const label=score>=80?"Severe pressure":score>=65?"High pressure":score>=45?"Elevated":score>=25?"Watch":"Subdued";
    const driver=components.reduce((highest,component)=>component.value>highest.value?component:highest);
    return{score,label,coverage:Math.round(activeWeight*100),asOf:components.map((component)=>component.asOf).sort().at(0)!,driver:`${driver.label} is the strongest signal at ${driver.value}/100.`,components};
  },[breadthSource?.label,breadthSource?.sourceUrl,clock,marketData,ratesSource?.label,ratesSource?.sourceUrl,stories,volatilitySource?.label,volatilitySource?.sourceUrl]);
  const sectionFor:Record<string,string>={Overview:"overview-section","Live events":"events-section",Countries:"categories-section",Watchlist:"saved-section","Risk monitor":"risk-section",Markets:"market-section",Indicators:"indicators-section",Briefings:"stories-section"};
  const navigateTo=(item:string)=>{setActiveView(item);document.getElementById(sectionFor[item])?.scrollIntoView({behavior:"smooth",block:"start"});};
  const submitSearch=(event?:FormEvent)=>{event?.preventDefault();setAppliedQuery(query.trim());setShowAll(true);navigateTo("Briefings");};
  const chooseCategory=(value:string)=>{setCategory(value);setShowAll(true);setActiveView("Briefings");requestAnimationFrame(()=>document.getElementById("stories-section")?.scrollIntoView({behavior:"smooth"}));};
  const clearFilters=()=>{setQuery("");setAppliedQuery("");setCategory("All");setRegion("All regions");};
  const stepHero=(direction:-1|1)=>setHeroIndex((current)=>stories.length?(current+direction+stories.length)%stories.length:0);
  const finishHeroSwipe=(clientX:number)=>{if(heroTouchX.current===null)return;const delta=clientX-heroTouchX.current;heroTouchX.current=null;if(Math.abs(delta)>=44)stepHero(delta>0?-1:1);};

  return <main className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={()=>navigateTo("Overview")} aria-label="Atlas home"><span className="brand-mark"><i/><i/><i/></span><span>ATLAS<span className="brand-dot">.</span></span></button>
      <nav className="primary-nav" aria-label="Primary navigation"><p className="nav-label">Intelligence</p>
        <Link href="/intelligence"><span className="nav-glyph" aria-hidden>◎</span>Intelligence map</Link>
        <Link href="/world-grid"><span className="nav-glyph" aria-hidden>▦</span>World Grid</Link>
        <Link href="/simulator"><span className="nav-glyph" aria-hidden>◫</span>Canada Simulator</Link>
        {["Overview","Live events","Countries","Watchlist"].map((item,index)=><button key={item} className={activeView===item?"active":""} onClick={()=>navigateTo(item)}><span className="nav-glyph" aria-hidden>{["⌂","⌁","◎","◇"][index]}</span>{item}{item==="Live events"&&<span className="nav-count">{stories.length}</span>}{item==="Watchlist"&&savedIds.length>0&&<span className="nav-count neutral">{savedIds.length}</span>}</button>)}
        <p className="nav-label secondary">Analysis</p>{["Risk monitor","Markets","Indicators","Briefings"].map((item,index)=><button key={item} className={activeView===item?"active":""} onClick={()=>navigateTo(item)}><span className="nav-glyph" aria-hidden>{["△","◫","⌇","▤"][index]}</span>{item}</button>)}
        <p className="nav-label secondary">Newsrooms</p>
        <Link href="/entertainment"><span className="nav-glyph" aria-hidden>✦</span>Entertainment{deskCounts.entertainment>0&&<span className="nav-count neutral">{deskCounts.entertainment}</span>}</Link>
        <Link href="/sports"><span className="nav-glyph" aria-hidden>◉</span>Sports{deskCounts.sports>0&&<span className="nav-count neutral">{deskCounts.sports}</span>}</Link>
      </nav><div className="sidebar-bottom"><div className={`sync-status ${feedStatus}`}><span/> {feedStatus==="loading"?"Connecting publisher feeds":feedStatus==="error"?"Publisher feeds unavailable":`${feedSourceCount} publishers · ${feedStatus}`}</div><div className="analyst-card"><div className="avatar">AR</div><div><strong>Analyst workspace</strong><small>Global desk</small></div></div></div>
    </aside>
    <MobileSiteNav/>
    <section className="workspace" id="top">
      <header className="topbar"><div><p className="eyebrow">GLOBAL INTELLIGENCE / <span>{activeView.toUpperCase()}</span></p><h1>World, entertainment & sports monitor</h1></div><div className="top-actions">
        <form className="search-form" onSubmit={submitSearch}><label className="search"><span>⌕</span><input aria-label="Search all headlines" placeholder="Search countries, events, topics" value={query} onChange={(event)=>setQuery(event.target.value)}/><button type="submit" aria-label="Run search">↵</button></label>{query&&<div className="search-hint"><strong>Press Enter to search all stories</strong><span>Try “Taiwan”, “energy”, “Africa” or “shipping”</span></div>}</form>
        <button className="icon-button" aria-label="Open latest headlines" onClick={()=>setNotificationsOpen((open)=>!open)}>◉<span className="notification-dot"/></button><button className="refresh-button" onClick={()=>void loadNews()} disabled={feedStatus==="loading"}><span>↻</span> {feedStatus==="loading"?"Updating":lastFetchedAt?`Updated ${relativeTime(lastFetchedAt,clock)}`:"Refresh news"}</button>
        {notificationsOpen&&<div className="notifications-popover"><strong>Latest publisher headlines</strong>{stories.slice(0,3).map((story)=><button key={story.id} onClick={()=>{setSelectedStory(story);setNotificationsOpen(false);}}>{story.title}<span><time dateTime={story.publishedAt} title={exactTime(story.publishedAt)}>{relativeTime(story.publishedAt,clock)}</time></span></button>)}{!stories.length&&<p className="feed-popover-status">Waiting for publisher feeds…</p>}</div>}
      </div></header>

      <section className="category-strip" id="categories-section" aria-label="News categories"><div><p>EXPLORE THE DESK</p><h2>Topics <span>{visibleCategories.length-1} active</span></h2></div><div className="category-buttons">{visibleCategories.map((item)=><button key={item} className={category===item?"active":""} onClick={()=>chooseCategory(item)} aria-pressed={category===item}>{item}<span>{item==="All"?stories.length:categoryCounts.get(item)??0}</span></button>)}</div></section>

      <div className="dashboard-grid">
        <section className="hero-card" id="overview-section">{hero&&heroVisual?<><div key={hero.id} className="hero-image-wrap hero-image-change" onTouchStart={(event)=>{heroTouchX.current=event.touches[0]?.clientX??null;}} onTouchEnd={(event)=>finishHeroSwipe(event.changedTouches[0]?.clientX??0)}><div className="publisher-image-empty"><span>▧</span><strong>Publisher image unavailable</strong><small>{hero.source} did not expose an article image.</small></div><img className="hero-photo" src={heroVisual.image} alt={`${hero.source} image for: ${hero.title}`} referrerPolicy="no-referrer" onError={(event)=>{event.currentTarget.style.display="none";}}/><div className="hero-image-overlay"/><div className="hero-label"><span/> LIVE HEADLINE {heroIndex+1} / {stories.length}</div><div className="hero-caption"><p>{hero.desk.toUpperCase()} · {hero.category.toUpperCase()} · {hero.region.toUpperCase()}</p><h2>{hero.title}</h2><div className="story-meta"><span>{hero.source}</span><span><time dateTime={hero.publishedAt} title={`Published ${exactTime(hero.publishedAt)}`}>{relativeTime(hero.publishedAt,clock)}</time></span><span>{hero.read} read</span></div></div><button className="carousel-arrow previous" aria-label="Previous headline" onClick={()=>stepHero(-1)}>‹</button><button className="carousel-arrow next" aria-label="Next headline" onClick={()=>stepHero(1)}>›</button><a className="image-credit" href={heroVisual.credit} target="_blank" rel="noreferrer">{heroVisual.label} ↗</a></div><div className="hero-summary"><p>{hero.summary}</p><div className="hero-summary-actions"><a className="primary-action" href={sourceUrlForStory(hero)} target="_blank" rel="noreferrer" title={`Open the original ${hero.source} article`}>{sourceActionForStory()} ↗</a><button onClick={()=>setSelectedStory(hero)}>Briefing</button><button onClick={()=>toggleSaved(hero)} className={savedIds.includes(hero.id)?"saved":""}>{savedIds.includes(hero.id)?"◆ Saved":"◇ Save"}</button></div></div><div className="carousel-navigator"><div className="carousel-room-mix" aria-label="Headline mix across all newsrooms"><strong>BEST {stories.length}</strong><span>World {deskCounts.world??0}</span><span>Sports {deskCounts.sports??0}</span><span>Entertainment {deskCounts.entertainment??0}</span></div><div className="carousel-progress" aria-label={`Headline ${heroIndex+1} of ${stories.length}`}><i style={{width:`${((heroIndex+1)/stories.length)*100}%`}}/></div><span>{String(heroIndex+1).padStart(3,"0")} / {stories.length}</span><label>Jump to<select value={heroIndex} onChange={(event)=>setHeroIndex(Number(event.target.value))} aria-label="Jump to a headline">{stories.map((story,index)=><option value={index} key={story.id}>{String(index+1).padStart(3,"0")} · {story.desk} · {story.title}</option>)}</select></label></div></>:<div className="hero-feed-state"><span className="feed-spinner"/><h2>{feedStatus==="error"?"Publisher feeds are temporarily unavailable":"Loading verified headlines…"}</h2><p>{feedStatus==="error"?"No placeholder headlines or ages are being shown. Try refreshing in a moment.":"Connecting directly to publisher feeds for original URLs and publication times."}</p>{feedStatus==="error"&&<button onClick={()=>void loadNews()}>Retry feeds</button>}</div>}</section>

        <aside className="risk-panel panel" id="risk-section"><div className="panel-heading"><div><p>LIVE PUBLIC-DATA COMPOSITE</p><h3>Global pressure index</h3></div><button aria-label="Explain pressure index" aria-expanded={riskOpen} onClick={()=>setRiskOpen((open)=>!open)}>ⓘ</button></div>{pressureIndex?<><div className="risk-score"><strong>{pressureIndex.score}</strong><div><span>LIVE · {pressureIndex.coverage}% COVERAGE</span><small>{pressureIndex.label}</small></div></div><div className="pressure-scale" aria-label={`Global pressure index ${pressureIndex.score} out of 100`}><i style={{width:`${pressureIndex.score}%`}}/></div><p className="axis-label"><span>SUBDUED</span><span>ELEVATED</span><span>SEVERE</span></p><p className="pressure-insight">{pressureIndex.driver}</p><div className="risk-list">{pressureIndex.components.map((component)=><div key={component.id}><div className="risk-row"><span><i className={component.tone}/>{component.label}</span><strong>{component.value}<em>{Math.round(component.weight*100)}%</em></strong></div><div className="risk-track"><i className={component.tone} style={{width:`${component.value}%`}}/></div><div className="risk-source-line"><span>{component.detail}</span><small>{component.sourceUrl?<a href={component.sourceUrl} target="_blank" rel="noreferrer">{component.source} ↗</a>:component.source} · <time dateTime={component.asOf} title={exactTime(component.asOf)}>{sourceAge(component.asOf,clock)}</time></small></div></div>)}</div><div className="pressure-freshness"><span>OLDEST ACTIVE INPUT</span><time dateTime={pressureIndex.asOf} title={exactTime(pressureIndex.asOf)}>{sourceAge(pressureIndex.asOf,clock)}</time></div></>:<div className="pressure-empty"><strong>Waiting for verified inputs</strong><p>The index appears after at least two real components covering half of the published methodology are available.</p></div>}{riskOpen&&<div className="method-note"><strong>How it works</strong><p>A 0–100 descriptive composite: 30% recency-weighted publisher headline intensity, 25% Cboe VIX level and curve shape, 25% Nasdaq advancing-share breadth stress, and 20% Treasury yield-curve stress. Missing inputs are removed and the remaining weights are normalized; coverage shows how much of the full model is present. It is context, not a forecast or trading signal.</p></div>}</aside>

        <section className="map-panel panel" id="events-section"><div className="panel-heading map-heading"><div><p>LIVE SITUATION MAP</p><h3>{mapMode==="Events"?"Located publisher headlines":mapMode==="Risk"?"Elevated headline hotspots":"Trade & energy headlines"}</h3></div><div className="map-controls">{(["Events","Risk","Trade"] as MapMode[]).map((mode)=><button key={mode} className={mapMode===mode?"active":""} onClick={()=>setMapMode(mode)} aria-pressed={mapMode===mode}>{mode}</button>)}</div></div><WorldEventMap mode={mapMode} stories={stories} filter={[appliedQuery,category==="All"?"":category,region==="All regions"?"":region].filter(Boolean).join(" ")}/></section>

        <StoryThreads stories={stories}/>

        <aside className="coverage-panel panel" aria-label="Live news coverage snapshot"><div className="panel-heading"><div><p>DESK COVERAGE</p><h3>Live coverage snapshot</h3></div><span className={`coverage-state ${feedStatus}`}><i/>{feedStatus==="live"?"LIVE":feedStatus==="partial"?"PARTIAL":feedStatus==="error"?"OFFLINE":"SYNCING"}</span></div><div className="coverage-metrics"><div><span>FRESH · 6H</span><strong>{coverageSnapshot.recent}</strong><small>of {stories.length} stories</small></div><div><span>URGENT</span><strong>{coverageSnapshot.urgent}</strong><small>critical + elevated</small></div><div><span>REGIONS</span><strong>{coverageSnapshot.regions}</strong><small>represented now</small></div><div><span>SOURCES</span><strong>{coverageSnapshot.sources}</strong><small>in current wire</small></div></div><div className="coverage-breakdown"><div className="coverage-subhead"><span>REGIONAL MIX</span><small>{stories.length?"Current wire":"Waiting for feeds"}</small></div>{coverageSnapshot.topRegions.map(([name,count])=><button key={name} onClick={()=>{setRegion(name);setShowAll(true);navigateTo("Briefings");}} aria-label={`Show ${count} ${name} stories`}><span>{name}</span><i><b style={{width:`${stories.length?(count/stories.length)*100:0}%`}}/></i><strong>{count}</strong></button>)}</div>{stories.length>0&&<button className="coverage-topic" onClick={()=>chooseCategory(coverageSnapshot.topCategory)}><span>LEADING TOPIC</span><strong>{coverageSnapshot.topCategory}</strong><em>View stories →</em></button>}</aside>

        <section className="headline-panel panel" id="stories-section"><div className="panel-heading feed-heading"><div><p>HEADLINE WIRE</p><h3>{appliedQuery?`Search: “${appliedQuery}”`:category==="All"?"Latest world headlines":`${category} headlines`}</h3><span className="result-count">{feedStatus==="loading"&&!stories.length?"Loading publisher feeds…":`${filteredStories.length} verified result${filteredStories.length===1?"":"s"} from ${feedSourceCount} publisher${feedSourceCount===1?"":"s"}`}</span></div><select value={region} onChange={(event)=>{setRegion(event.target.value);setShowAll(true);}} aria-label="Filter by region">{regions.map((item)=><option key={item}>{item}</option>)}</select></div>
          {feedStatus==="partial"&&<div className="feed-notice"><strong>Live feed partially available.</strong> Available publisher stories are shown with their original links and reported publication times.</div>}
          {feedStatus==="error"&&<div className="feed-notice error"><strong>Publisher feeds unavailable.</strong> No fabricated headlines or ages are being substituted. <button onClick={()=>void loadNews()}>Retry</button></div>}
          {(appliedQuery||category!=="All"||region!=="All regions")&&<div className="active-filters">{appliedQuery&&<span>Search: {appliedQuery}</span>}{category!=="All"&&<span>{category}</span>}{region!=="All regions"&&<span>{region}</span>}<button onClick={clearFilters}>Clear all ×</button></div>}
          <div className="headline-list">{filteredStories.slice(0,showAll?filteredStories.length:7).map((story)=><article key={story.id} className="headline-row"><button className="headline-main" onClick={()=>setSelectedStory(story)}><span className={`status-dot ${story.level}`}/><span className="headline-copy"><span className="headline-kicker">{story.region} · {story.category}</span><strong>{story.title}</strong><small>{story.source} · <time dateTime={story.publishedAt} title={`Published ${exactTime(story.publishedAt)}`}>{relativeTime(story.publishedAt,clock)}</time> · {story.read}</small></span></button><a className="headline-source" href={sourceUrlForStory(story)} target="_blank" rel="noreferrer" aria-label={`${sourceActionForStory()}: ${story.title}`} title={`Open the original ${story.source} article`}>↗<span>{sourceActionForStory()}</span></a><button className={`save-icon ${savedIds.includes(story.id)?"saved":""}`} onClick={()=>toggleSaved(story)} aria-label={`Save ${story.title}`}>{savedIds.includes(story.id)?"◆":"◇"}</button></article>)}</div>
          {!filteredStories.length&&feedStatus!=="loading"&&feedStatus!=="error"&&<div className="no-results"><span>⌕</span><h4>No matching headlines</h4><p>Try another country, topic, source or region.</p><button onClick={clearFilters}>Reset search</button></div>}{filteredStories.length>7&&<button className="all-briefings" onClick={()=>setShowAll((value)=>!value)}>{showAll?"Show fewer headlines":`View all ${filteredStories.length} headlines`} <span>{showAll?"↑":"↓"}</span></button>}
        </section>

        <section className="signals-panel panel" id="indicators-section"><div className="panel-heading"><div><p>PUBLIC MARKET SIGNALS</p><h3>Markets & movement</h3></div><button className={`market-feed-state ${marketStatus}`} onClick={()=>void loadMarkets()}>{marketStatus==="loading"?"SYNCING":marketStatus.toUpperCase()} · REFRESH</button></div><div className="signal-grid">{signalQuotes.map((quote,index)=>quote?<div key={quote.id}><p>{quote.label}</p><strong>{quote.display}</strong><span className={(quote.change??0)>=0?"up":"down"}>{quote.changeDisplay}</span><small><a href={quote.sourceUrl} target="_blank" rel="noreferrer">{quote.source}</a> · {quote.cadence} · {sourceAge(quote.asOf,clock)}</small></div>:<div className="signal-unavailable" key={index}><p>{["BITCOIN","ETHEREUM","EUR / USD","US 10Y"][index]}</p><strong>—</strong><span>Unavailable</span><small>All configured providers failed · freshness unknown</small></div>)}</div><div className="ticker"><span>RESILIENCE</span><p>Coinbase → Kraken and U.S. Treasury → FRED fail over automatically. Every displayed value retains the provider that actually served it.</p></div></section>

        <section className="market-cockpit panel" id="market-section">
          <div className="market-cockpit-head">
            <div><p>MARKET COCKPIT</p><h3>Public data, with provenance</h3><span>No keys or accounts. Every card shows its source and native publication cadence.</span></div>
            <button className={`market-refresh ${marketStatus}`} onClick={()=>void loadMarkets()}>{marketStatus==="loading"?"Connecting public feeds":marketStatus==="live"?"All primary feeds healthy":marketStatus==="degraded"?"Fallback serving live data":marketStatus==="partial"?"Some feeds unavailable":"Feeds unavailable"}<span>Refresh now ↻</span></button>
          </div>
          <div className="market-widget-grid">
            <article className={`market-widget regime-widget ${marketData?.regime?"":"unavailable-widget"}`}><div className="widget-label"><span>PUBLIC REGIME PROXY</span><em>DERIVED</em></div>{marketData?.regime?<><div className="regime-score"><strong>{marketData.regime.score}</strong><span>/100</span></div><h4>{marketData.regime.label}</h4><div className="regime-meter"><i style={{width:`${marketData.regime.score}%`}}/></div><div className="regime-legend"><span>DEFENSIVE</span><span>MIXED</span><span>PARTICIPATION</span></div><div className="widget-facts compact"><p><span>{Object.keys(marketData.regime.components).map((key)=>key==="volatility"?"Vol":key[0].toUpperCase()+key.slice(1)).join(" / ")}</span><strong>{Object.values(marketData.regime.components).map((value)=>Math.round(value)).join(" · ")}</strong></p></div></>:<><div className="unavailable-value">—</div><h4>Proxy inputs incomplete</h4><p>The proxy remains blank unless attributed breadth, volatility and rate-curve inputs are available.</p></>}<WidgetSource source="ATLAS disclosed calculation" asOf={marketData?.regime?.asOf??null} cadence={marketData?.regime?.method??"Needs breadth, volatility and rate curve"} now={clock} status={marketData?.regime?"available":"unavailable"}/></article>
            <article className={`market-widget breadth-widget ${marketData?.breadth?"":"unavailable-widget"}`}><div className="widget-label"><span>NASDAQ BREADTH</span><em>DAILY</em></div>{marketData?.breadth?<><div className="breadth-ring" style={{background:`radial-gradient(circle at center,#fff 60%,transparent 62%),conic-gradient(#3f9275 ${marketData.breadth.participation}%,#e7ebee 0)`}}><strong>{marketData.breadth.participation.toFixed(1)}%</strong><span>ADVANCING</span></div><div className="widget-facts"><p><span>Advances</span><strong>{marketData.breadth.advances.toLocaleString()}</strong></p><p><span>Declines</span><strong>{marketData.breadth.declines.toLocaleString()}</strong></p><p><span>Net advances</span><strong>{compactNumber(marketData.breadth.netAdvances)}</strong></p></div></>:<><div className="unavailable-value">—</div><h4>Nasdaq breadth unavailable</h4><p>The card stays blank if the official annual statistics file cannot be validated.</p></>}<WidgetSource source={breadthSource?.label??"Nasdaq Daily Market Statistics"} url={breadthSource?.sourceUrl} asOf={marketData?.breadth?.asOf??null} cadence="Official daily advances / declines" now={clock} status={marketData?.breadth?"available":"unavailable"}/></article>
            <article className={`market-widget volatility-widget ${marketData?.volatility?"":"unavailable-widget"}`}><div className="widget-label"><span>VOLATILITY STRUCTURE</span><em>{volatilitySource?.route==="fallback"?"FRED FALLBACK":"CBOE DAILY"}</em></div>{marketData?.volatility?<><div className="vol-curve">{marketData.volatility.points.map((point)=><span key={point.id}><b>{point.value.toFixed(1)}</b><i style={{height:`${Math.max(14,(point.value/volatilityMax)*76)}%`}}/></span>)}</div><div className="curve-axis">{marketData.volatility.points.map((point)=><span key={point.id}>{point.label}</span>)}</div><div className="widget-facts compact"><p><span>Curve shape</span><strong>{marketData.volatility.shape}</strong></p><p><span>VIX3M − VIX</span><strong>{marketData.volatility.frontBackSpread>=0?"+":""}{marketData.volatility.frontBackSpread.toFixed(2)} pts</strong></p></div></>:<><div className="unavailable-value">—</div><h4>Volatility curve unavailable</h4><p>No value is substituted if both Cboe and FRED curve inputs fail.</p></>}<WidgetSource source={volatilitySource?.label??"Cboe Volatility Indices"} url={volatilitySource?.sourceUrl} asOf={marketData?.volatility?.asOf??null} cadence={marketData?.volatility?`${marketData.volatility.points.map((point)=>point.id).join(" · ")} daily closes`:"Cboe then FRED fallback"} now={clock} status={!marketData?.volatility?"unavailable":volatilitySource?.route==="fallback"?"degraded":"available"}/></article>
            <article className="market-widget cross-widget"><div className="widget-label"><span>CROSS-ASSET TAPE</span><em>{fallbackActive?"RESILIENT":"PUBLIC"}</em></div><div className="cross-list">{publicQuotes.slice(0,6).map((quote)=><div key={quote.id}><span>{quote.label}</span><strong className="cross-value">{quote.display}</strong><strong className={(quote.change??0)>=0?"positive":"negative"}>{quote.changeDisplay}</strong></div>)}{!publicQuotes.length&&<div className="widget-empty">Waiting for public sources…</div>}</div><WidgetSource source={crossSources} asOf={crossOldestAsOf} cadence="Oldest observation shown" now={clock} status={!publicQuotes.length?"unavailable":fallbackActive?"degraded":"available"}/></article>
            <article className="market-widget flow-widget"><div className="widget-label"><span>FUTURES POSITIONING</span><em>WEEKLY</em></div>{marketData?.positioning?<><div className="position-data"><div><span>Leveraged funds net</span><strong>{compactNumber(marketData.positioning.leveragedNet)}</strong></div><div><span>Asset managers net</span><strong>{compactNumber(marketData.positioning.assetManagerNet)}</strong></div><div><span>Open interest</span><strong>{compactNumber(marketData.positioning.openInterest).replace("+","")}</strong></div></div><div className="position-callout"><span>CONTRACT</span><strong>{marketData.positioning.label}</strong><small>Net equals reported long positions minus short positions.</small></div></>:<div className="widget-empty tall">CFTC report unavailable</div>}<WidgetSource source={marketData?.positioning?.source??"CFTC Traders in Financial Futures"} url={marketData?.positioning?.sourceUrl} asOf={marketData?.positioning?.asOf??null} cadence={marketData?.positioning?.cadence??"Weekly"} now={clock} status={marketData?.positioning?"available":"unavailable"}/></article>
            <article className="market-widget coverage-widget"><div className="widget-label"><span>SOURCE COVERAGE</span><em>NO LOGIN</em></div><div className="source-list">{marketData?.sources.map((source)=><a href={source.sourceUrl} target="_blank" rel="noreferrer" key={source.id} title={source.detail}><i className={source.status}/><span><strong>{source.label}</strong><small>{source.route==="fallback"?`FALLBACK · ${source.detail}`:source.route==="primary"?`${source.cadence} · PRIMARY`:`FAILED · ${source.detail}`}</small></span><em>{source.asOf?sourceAge(source.asOf,clock):"Unavailable"}</em></a>)??<div className="widget-empty tall">Connecting sources…</div>}</div><WidgetSource source="ATLAS failover router" asOf={marketData?.fetchedAt??null} cadence="30-second health check" now={clock} status={!marketData?"unavailable":fallbackActive?"degraded":"available"}/></article>
            <article className="market-widget long-widget"><div className="widget-label"><span>RATE-CURVE HEALTH</span><em>{marketData?.sources.find((source)=>source.id==="rates")?.route==="fallback"?"FALLBACK":"DAILY"}</em></div><div className="health-grid"><div><strong>{quoteFor("US-2Y")?.display??"—"}</strong><span>US 2-year</span></div><div><strong>{quoteFor("US-10Y")?.display??"—"}</strong><span>US 10-year</span></div><div><strong>{marketData?.curve.twoTen==null?"—":`${marketData.curve.twoTen>=0?"+":"−"}${Math.abs(marketData.curve.twoTen).toFixed(0)} bp`}</strong><span>2s10s slope</span></div><div><strong>{marketData?.curve.threeMonthTen==null?"—":`${marketData.curve.threeMonthTen>=0?"+":"−"}${Math.abs(marketData.curve.threeMonthTen).toFixed(0)} bp`}</strong><span>3m10y slope</span></div></div><p>Curve slopes use the active provider’s official daily observations.</p><WidgetSource source={marketData?.sources.find((source)=>source.id==="rates")?.label??"Treasury / FRED"} url={marketData?.sources.find((source)=>source.id==="rates")?.sourceUrl} asOf={marketData?.sources.find((source)=>source.id==="rates")?.asOf??null} cadence={marketData?.sources.find((source)=>source.id==="rates")?.cadence??"Daily close"} now={clock} status={!marketData?.treasury.length?"unavailable":marketData?.sources.find((source)=>source.id==="rates")?.route==="fallback"?"degraded":"available"}/></article>
            <article className="market-widget scenario-widget"><div className="widget-label"><span>GEOPOL → MARKET</span><em>FRAMEWORK</em></div><div className="scenario-list"><div><i className="amber"/><span><strong>Energy route disruption</strong><small>Relevant data absent: Brent · freight · breakevens</small></span></div><div><i className="blue"/><span><strong>Growth shock</strong><small>Public proxies: Treasury curve · EUR/USD</small></span></div><div><i className="red"/><span><strong>Funding stress</strong><small>Public proxies: USD crosses · Treasury curve</small></span></div></div><p>Scenario links are observation prompts, not trade recommendations.</p><WidgetSource source="ATLAS analytical framework" asOf={null} cadence="Static context" now={clock}/></article>
          </div>
          <div className="market-method"><span>PUBLIC ANALYTICS</span><p>Nasdaq breadth and Cboe volatility closes now replace the three blank cards. The regime proxy publishes its exact weights; it is a descriptive framework, not a forecast or trade recommendation.</p></div>
        </section>

        <section className="saved-panel panel" id="saved-section"><div className="panel-heading"><div><p>YOUR WATCHLIST</p><h3>Saved across every newsroom</h3></div><span className="saved-total">{savedIds.length}</span></div>{savedStories.length?<div className="saved-grid">{savedStories.map((story)=><article key={story.id}><a className="saved-story-open" href={story.articleUrl} target="_blank" rel="noreferrer"><span>{story.desk} · {story.category}</span><strong>{story.title}</strong><small><time dateTime={story.publishedAt} title={`Published ${exactTime(story.publishedAt)}`}>{relativeTime(story.publishedAt,clock)}</time> · {story.source} ↗</small></a><button onClick={()=>toggleSaved(story)} aria-label={`Remove ${story.title} from saved stories`}>Remove</button></article>)}</div>:<div className="saved-empty"><span>◇</span><p>Save a story in World, Entertainment or Sports and it will remain here on this device.</p></div>}</section>
      </div>
      <footer><span>ATLAS Intelligence</span><span>Headlines, canonical links and publication times from publisher feeds · Map © OpenStreetMap</span><span>{lastFetchedAt?`Feeds checked ${exactTime(lastFetchedAt)}`:"Connecting feeds"}</span></footer>
    </section>

    {selectedStory&&<div className="story-modal-backdrop" role="presentation" onMouseDown={()=>setSelectedStory(null)}><article className="story-modal" role="dialog" aria-modal="true" aria-labelledby="story-modal-title" onMouseDown={(event)=>event.stopPropagation()}><button className="modal-close" onClick={()=>setSelectedStory(null)} aria-label="Close briefing">×</button><p>{selectedStory.category} · {selectedStory.region}</p><h2 id="story-modal-title">{selectedStory.title}</h2><div className="modal-meta"><span className={`status-dot ${selectedStory.level}`}/>{selectedStory.source} · <time dateTime={selectedStory.publishedAt} title={`Published ${exactTime(selectedStory.publishedAt)}`}>{relativeTime(selectedStory.publishedAt,clock)}</time> · {selectedStory.read} read</div><p className="modal-summary">{selectedStory.summary}</p><div className="modal-tags">{selectedStory.tags.map((tag)=><button key={tag} onClick={()=>{setQuery(tag);setAppliedQuery(tag);setSelectedStory(null);setShowAll(true);requestAnimationFrame(()=>navigateTo("Briefings"));}}>#{tag}</button>)}</div><div className="modal-actions"><a className="primary-action" href={sourceUrlForStory(selectedStory)} target="_blank" rel="noreferrer">{sourceActionForStory()} ↗</a><button onClick={()=>toggleSaved(selectedStory)}>{savedIds.includes(selectedStory.id)?"◆ Remove saved":"◇ Save"}</button><button onClick={()=>setSelectedStory(null)}>Close</button></div><small className="demo-note">The direct article URL and publication timestamp come from {selectedStory.source}’s feed. Relative age recalculates every minute; hover or focus it to see the exact reported time.</small></article></div>}
  </main>;
}
