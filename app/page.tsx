"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { MapMode } from "./components/WorldEventMap";

const WorldEventMap = dynamic(() => import("./components/WorldEventMap"), { ssr: false, loading: () => <div className="map-loading">Loading intelligence map…</div> });

type Story = { id:number; category:string; region:string; publishedAt:string; level:"critical"|"elevated"|"watch"|"stable"; title:string; summary:string; source:string; read:string; tags:string[]; articleUrl:string; imageUrl?:string };
type NewsResponse = { stories:Story[]; sources:string[]; fetchedAt:string; failedFeeds:number; totalFeeds:number };

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

const categories = ["All","Security","Diplomacy","Economy","Energy","Trade","Technology","Climate"];
const regions = ["All regions","Global","Middle East","Europe","Asia Pacific","Africa","Americas"];
const commonsImage = (file:string) => `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(file)}?width=1600`;
const commonsFile = (file:string) => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replaceAll(" ","_"))}`;
type HeroMedia = {image:string;credit:string;label:string};
const media = (file:string,label:string):HeroMedia => ({image:commonsImage(file),credit:commonsFile(file),label:`${label} · Commons`});
const heroMedia:Record<number,HeroMedia> = {
  1:{image:commonsImage("CG 56 transits the Strait of Hormuz (28465394986).jpg"),credit:commonsFile("CG 56 transits the Strait of Hormuz (28465394986).jpg"),label:"U.S. Coast Guard · public domain"},
  2:{image:commonsImage("IMO welcomes maritime humanitarian corridor in Black Sea 08.jpg"),credit:commonsFile("IMO welcomes maritime humanitarian corridor in Black Sea 08.jpg"),label:"Black Sea maritime corridor · CC BY 2.0"},
  3:{image:commonsImage("Taipei 101 with NTUTS landscape.jpg"),credit:commonsFile("Taipei 101 with NTUTS landscape.jpg"),label:"Taipei skyline · Wikimedia Commons"},
  4:{image:commonsImage("Container ship entering the new Cocoli locks of the Panama Canal.jpg"),credit:commonsFile("Container ship entering the new Cocoli locks of the Panama Canal.jpg"),label:"Panama Canal container ship · Commons license"},
};

// Publisher-provided feed images are preferred. These Commons images are the
// licensed fallback when a feed does not include article photography.
const editorialMedia:Record<string,HeroMedia[]> = {
  Security:[
    media("160319-N-QF605-064 (25373590653).jpg","Amanda Dunford / U.S. Navy · public domain"),
    media("InsideTheJointSecurityArea1.jpg","U.S. Army Korea · public domain"),
    media("Arctic patrol DVIDS1089591.jpg","Blaize Potts / U.S. Coast Guard · public domain"),
  ],
  Diplomacy:[
    media("EU - Western Balkans Summit.jpg","Adnan Beci / European Union · CC BY 4.0"),
    media("Olivier Lebas and Russell Caldwell 160924-N-FP878-178 (29312554204).jpg","U.S. Naval Forces Europe-Africa · public domain"),
    media("Secretary Blinken Participates in a Freedom of Expression Roundtable (52369610016).jpg","U.S. Department of State · public domain"),
  ],
  Economy:[
    media("2ES7-030 with freight train.jpg","Kazakhstan freight rail · CC BY 4.0"),
    media("President Joko Widodo Reviewed Port Infrastructure, May 2018.jpg","Indonesian Presidential Secretariat · Commons license"),
    media("Cargo-In-Cargo-Out DVIDS171686.jpg","U.S. Air Force · public domain"),
  ],
  Energy:[
    media("TVA Linemen.jpg","Alfred T. Palmer / Library of Congress · public domain"),
    media("Solar panels at a White Wing Ranch construction site (53166029462).jpg","Michelle Ailport / BLM · public domain"),
    media("Lineman changing transformer.jpg","Dave Pape · public domain"),
  ],
  Technology:[
    media("Adriatic cyber exercise enables multinational cooperation to mitigate, defend threats (8518874).jpg","Benjamin Hughes / U.S. Air National Guard · public domain"),
    media("US, Tanzania hunt for cyber threats during JA26 cyber defense training (9560563).jpg","Alva Gonzalez / U.S. Army · public domain"),
    media("RD24 - III MEF CG Visits Command Operations Center at JGSDF Camp Ishigaki (8572158).jpg","Alyssa Chuluda / U.S. Marine Corps · public domain"),
  ],
  Climate:[
    media("Tien Giang Farmers (237758059).jpeg","Mekong Delta farmers · CC BY 3.0"),
    media("USAID in Madagascar Building Water Catchments (40954412781).jpg","USAID Madagascar · public domain"),
    media("World Water Monitoring Day (4049999633).jpg","U.S. EPA · public domain"),
  ],
  Trade:[
    heroMedia[4],
    media("This truck is adapted to lift and transport shipping containers.jpg","U.S. Army logistics crew · public domain"),
    media("US Navy 051010-M-0596N-001 A tractor moves a quadcon container at Kin Red Port in Okinawa.jpg","C. Nuntavong / U.S. Marine Corps · public domain"),
  ],
};
const mediaForStory = (story:Story):HeroMedia => {
  if(story.imageUrl)return {image:story.imageUrl,credit:story.articleUrl,label:`${story.source} · publisher image`};
  if(heroMedia[story.id]) return heroMedia[story.id];
  const pool=editorialMedia[story.category] ?? editorialMedia.Diplomacy;
  const regionOffset=regions.indexOf(story.region);
  return pool[(story.id+Math.max(regionOffset,0))%pool.length];
};
const risks = [{label:"Energy security",value:86,delta:"+12",tone:"red"},{label:"Maritime trade",value:78,delta:"+08",tone:"orange"},{label:"Cyber activity",value:64,delta:"+05",tone:"amber"},{label:"Food systems",value:41,delta:"−03",tone:"blue"}];

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
  const [savedIds,setSavedIds]=useState<number[]>([]);
  const [showAll,setShowAll]=useState(false);
  const [selectedStory,setSelectedStory]=useState<Story|null>(null);
  const [notificationsOpen,setNotificationsOpen]=useState(false);
  const [riskOpen,setRiskOpen]=useState(false);
  const loadNews=useCallback(async()=>{
    setFeedStatus((status)=>status==="error"?"loading":status);
    try{
      const response=await fetch("/api/news",{cache:"no-store"});
      if(!response.ok)throw new Error("Publisher feeds unavailable");
      const data=await response.json() as NewsResponse;
      if(!data.stories.length)throw new Error("No current publisher stories");
      setStories(data.stories);
      setFeedSourceCount(data.sources.length);
      setLastFetchedAt(data.fetchedAt);
      setFeedStatus(data.failedFeeds>0?"partial":"live");
      setHeroIndex((index)=>Math.min(index,data.stories.length-1));
    }catch{
      setFeedStatus("error");
    }
  },[]);
  useEffect(()=>{
    const initialTimer=window.setTimeout(()=>void loadNews(),0);
    const newsTimer=window.setInterval(()=>void loadNews(),300000);
    const clockTimer=window.setInterval(()=>setClock(Date.now()),60000);
    return ()=>{window.clearTimeout(initialTimer);window.clearInterval(newsTimer);window.clearInterval(clockTimer);};
  },[loadNews]);
  const hero=stories[heroIndex]??null;
  const heroVisual=hero?mediaForStory(hero):null;

  const filteredStories=useMemo(()=>{const needle=appliedQuery.trim().toLowerCase();return stories.filter((story)=>{const inCategory=category==="All"||story.category===category;const inRegion=region==="All regions"||story.region===region;const haystack=[story.title,story.summary,story.category,story.region,story.source,...story.tags].join(" ").toLowerCase();return inCategory&&inRegion&&(!needle||haystack.includes(needle));});},[appliedQuery,category,region,stories]);
  const sectionFor:Record<string,string>={Overview:"overview-section","Live events":"events-section",Countries:"categories-section",Watchlist:"saved-section","Risk monitor":"risk-section",Indicators:"indicators-section",Briefings:"stories-section"};
  const navigateTo=(item:string)=>{setActiveView(item);document.getElementById(sectionFor[item])?.scrollIntoView({behavior:"smooth",block:"start"});};
  const submitSearch=(event?:FormEvent)=>{event?.preventDefault();setAppliedQuery(query.trim());setShowAll(true);navigateTo("Briefings");};
  const chooseCategory=(value:string)=>{setCategory(value);setShowAll(true);setActiveView("Briefings");requestAnimationFrame(()=>document.getElementById("stories-section")?.scrollIntoView({behavior:"smooth"}));};
  const toggleSaved=(id:number)=>setSavedIds((current)=>current.includes(id)?current.filter((item)=>item!==id):[...current,id]);
  const clearFilters=()=>{setQuery("");setAppliedQuery("");setCategory("All");setRegion("All regions");};

  return <main className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={()=>navigateTo("Overview")} aria-label="Atlas home"><span className="brand-mark"><i/><i/><i/></span><span>ATLAS<span className="brand-dot">.</span></span></button>
      <nav className="primary-nav" aria-label="Primary navigation"><p className="nav-label">Intelligence</p>
        {["Overview","Live events","Countries","Watchlist"].map((item,index)=><button key={item} className={activeView===item?"active":""} onClick={()=>navigateTo(item)}><span className="nav-glyph" aria-hidden>{["⌂","⌁","◎","◇"][index]}</span>{item}{item==="Live events"&&<span className="nav-count">{stories.length}</span>}{item==="Watchlist"&&savedIds.length>0&&<span className="nav-count neutral">{savedIds.length}</span>}</button>)}
        <p className="nav-label secondary">Analysis</p>{["Risk monitor","Indicators","Briefings"].map((item,index)=><button key={item} className={activeView===item?"active":""} onClick={()=>navigateTo(item)}><span className="nav-glyph" aria-hidden>{["△","⌇","▤"][index]}</span>{item}</button>)}
      </nav><div className="sidebar-bottom"><div className={`sync-status ${feedStatus}`}><span/> {feedStatus==="loading"?"Connecting publisher feeds":feedStatus==="error"?"Publisher feeds unavailable":`${feedSourceCount} publishers · ${feedStatus}`}</div><div className="analyst-card"><div className="avatar">AR</div><div><strong>Analyst workspace</strong><small>Global desk</small></div></div></div>
    </aside>
    <section className="workspace" id="top">
      <header className="topbar"><div><p className="eyebrow">GLOBAL INTELLIGENCE / <span>{activeView.toUpperCase()}</span></p><h1>World news monitor</h1></div><div className="top-actions">
        <form className="search-form" onSubmit={submitSearch}><label className="search"><span>⌕</span><input aria-label="Search all headlines" placeholder="Search countries, events, topics" value={query} onChange={(event)=>setQuery(event.target.value)}/><button type="submit" aria-label="Run search">↵</button></label>{query&&<div className="search-hint"><strong>Press Enter to search all stories</strong><span>Try “Taiwan”, “energy”, “Africa” or “shipping”</span></div>}</form>
        <button className="icon-button" aria-label="Open latest headlines" onClick={()=>setNotificationsOpen((open)=>!open)}>◉<span className="notification-dot"/></button><button className="refresh-button" onClick={()=>void loadNews()} disabled={feedStatus==="loading"}><span>↻</span> {feedStatus==="loading"?"Updating":lastFetchedAt?`Updated ${relativeTime(lastFetchedAt,clock)}`:"Refresh news"}</button>
        {notificationsOpen&&<div className="notifications-popover"><strong>Latest publisher headlines</strong>{stories.slice(0,3).map((story)=><button key={story.id} onClick={()=>{setSelectedStory(story);setNotificationsOpen(false);}}>{story.title}<span><time dateTime={story.publishedAt} title={exactTime(story.publishedAt)}>{relativeTime(story.publishedAt,clock)}</time></span></button>)}{!stories.length&&<p className="feed-popover-status">Waiting for publisher feeds…</p>}</div>}
      </div></header>

      <section className="category-strip" id="categories-section" aria-label="News categories"><div><p>EXPLORE THE DESK</p><h2>Topics</h2></div><div className="category-buttons">{categories.map((item)=><button key={item} className={category===item?"active":""} onClick={()=>chooseCategory(item)}>{item}<span>{item==="All"?stories.length:stories.filter((story)=>story.category===item).length}</span></button>)}</div></section>

      <div className="dashboard-grid">
        <section className="hero-card" id="overview-section">{hero&&heroVisual?<><div key={hero.id} className="hero-image-wrap hero-image-change"><img className="hero-photo" src={heroVisual.image} alt={`Related news image: ${heroVisual.label}`} onError={(event)=>{event.currentTarget.src=editorialMedia[hero.category]?.[0]?.image??editorialMedia.Diplomacy[0].image;}}/><div className="hero-image-overlay"/><div className="hero-label"><span/> LIVE HEADLINE {heroIndex+1} / {stories.length}</div><div className="hero-caption"><p>{hero.category.toUpperCase()} · {hero.region.toUpperCase()}</p><h2>{hero.title}</h2><div className="story-meta"><span>{hero.source}</span><time dateTime={hero.publishedAt} title={`Published ${exactTime(hero.publishedAt)}`}>{relativeTime(hero.publishedAt,clock)}</time><span>{hero.read} read</span></div></div><button className="carousel-arrow previous" aria-label="Previous headline" onClick={()=>setHeroIndex((heroIndex-1+stories.length)%stories.length)}>‹</button><button className="carousel-arrow next" aria-label="Next headline" onClick={()=>setHeroIndex((heroIndex+1)%stories.length)}>›</button><a className="image-credit" href={heroVisual.credit} target="_blank" rel="noreferrer">{heroVisual.label} ↗</a></div><div className="hero-summary"><p>{hero.summary}</p><div className="hero-summary-actions"><a className="primary-action" href={sourceUrlForStory(hero)} target="_blank" rel="noreferrer" title={`Open the original ${hero.source} article`}>{sourceActionForStory()} ↗</a><button onClick={()=>setSelectedStory(hero)}>Briefing</button><button onClick={()=>toggleSaved(hero.id)} className={savedIds.includes(hero.id)?"saved":""}>{savedIds.includes(hero.id)?"◆ Saved":"◇ Save"}</button></div></div><div className="carousel-navigator"><div className="carousel-progress" aria-label={`Headline ${heroIndex+1} of ${stories.length}`}><i style={{width:`${((heroIndex+1)/stories.length)*100}%`}}/></div><span>{String(heroIndex+1).padStart(3,"0")} / {stories.length}</span><label>Jump to<select value={heroIndex} onChange={(event)=>setHeroIndex(Number(event.target.value))} aria-label="Jump to a headline">{stories.map((story,index)=><option value={index} key={story.id}>{String(index+1).padStart(3,"0")} · {story.title}</option>)}</select></label></div></>:<div className="hero-feed-state"><span className="feed-spinner"/><h2>{feedStatus==="error"?"Publisher feeds are temporarily unavailable":"Loading verified headlines…"}</h2><p>{feedStatus==="error"?"No placeholder headlines or ages are being shown. Try refreshing in a moment.":"Connecting directly to publisher feeds for original URLs and publication times."}</p>{feedStatus==="error"&&<button onClick={()=>void loadNews()}>Retry feeds</button>}</div>}</section>

        <aside className="risk-panel panel" id="risk-section"><div className="panel-heading"><div><p>RISK PULSE</p><h3>Global pressure index</h3></div><button aria-label="Explain risk index" onClick={()=>setRiskOpen((open)=>!open)}>ⓘ</button></div><div className="risk-score"><strong>72</strong><div><span>↗ 8 pts</span><small>Elevated</small></div></div><div className="sparkline" aria-label="Risk index trend over 12 hours">{[24,30,27,38,42,39,58,54,68,63,77,72].map((height,index)=><i key={index} style={{height:`${height}%`}}/>)}</div><p className="axis-label"><span>12H AGO</span><span>NOW</span></p><div className="risk-list">{risks.map((risk)=><div key={risk.label}><div className="risk-row"><span><i className={risk.tone}/>{risk.label}</span><strong>{risk.value}<em>{risk.delta}</em></strong></div><div className="risk-track"><i className={risk.tone} style={{width:`${risk.value}%`}}/></div></div>)}</div>{riskOpen&&<div className="method-note"><strong>How it works</strong><p>A sample composite of security, trade, cyber and food-system signals. Values illustrate the dashboard experience and are not live analysis.</p></div>}</aside>

        <section className="map-panel panel" id="events-section"><div className="panel-heading map-heading"><div><p>LIVE SITUATION MAP</p><h3>{mapMode==="Events"?"Active geopolitical events":mapMode==="Risk"?"Global risk hotspots":"Strategic trade corridors"}</h3></div><div className="map-controls">{(["Events","Risk","Trade"] as MapMode[]).map((mode)=><button key={mode} className={mapMode===mode?"active":""} onClick={()=>setMapMode(mode)} aria-pressed={mapMode===mode}>{mode}</button>)}</div></div><WorldEventMap mode={mapMode} filter={[appliedQuery,category==="All"?"":category,region==="All regions"?"":region].filter(Boolean).join(" ")}/></section>

        <section className="headline-panel panel" id="stories-section"><div className="panel-heading feed-heading"><div><p>HEADLINE WIRE</p><h3>{appliedQuery?`Search: “${appliedQuery}”`:category==="All"?"Latest world headlines":`${category} headlines`}</h3><span className="result-count">{feedStatus==="loading"&&!stories.length?"Loading publisher feeds…":`${filteredStories.length} verified result${filteredStories.length===1?"":"s"} from ${feedSourceCount} publisher${feedSourceCount===1?"":"s"}`}</span></div><select value={region} onChange={(event)=>{setRegion(event.target.value);setShowAll(true);}} aria-label="Filter by region">{regions.map((item)=><option key={item}>{item}</option>)}</select></div>
          {feedStatus==="partial"&&<div className="feed-notice"><strong>Live feed partially available.</strong> Available publisher stories are shown with their original links and reported publication times.</div>}
          {feedStatus==="error"&&<div className="feed-notice error"><strong>Publisher feeds unavailable.</strong> No fabricated headlines or ages are being substituted. <button onClick={()=>void loadNews()}>Retry</button></div>}
          {(appliedQuery||category!=="All"||region!=="All regions")&&<div className="active-filters">{appliedQuery&&<span>Search: {appliedQuery}</span>}{category!=="All"&&<span>{category}</span>}{region!=="All regions"&&<span>{region}</span>}<button onClick={clearFilters}>Clear all ×</button></div>}
          <div className="headline-list">{filteredStories.slice(0,showAll?filteredStories.length:7).map((story)=><article key={story.id} className="headline-row"><button className="headline-main" onClick={()=>setSelectedStory(story)}><span className={`status-dot ${story.level}`}/><span className="headline-copy"><span className="headline-kicker">{story.region} · {story.category}</span><strong>{story.title}</strong><small>{story.source} · <time dateTime={story.publishedAt} title={`Published ${exactTime(story.publishedAt)}`}>{relativeTime(story.publishedAt,clock)}</time> · {story.read}</small></span></button><a className="headline-source" href={sourceUrlForStory(story)} target="_blank" rel="noreferrer" aria-label={`${sourceActionForStory()}: ${story.title}`} title={`Open the original ${story.source} article`}>↗<span>{sourceActionForStory()}</span></a><button className={`save-icon ${savedIds.includes(story.id)?"saved":""}`} onClick={()=>toggleSaved(story.id)} aria-label={`Save ${story.title}`}>{savedIds.includes(story.id)?"◆":"◇"}</button></article>)}</div>
          {!filteredStories.length&&feedStatus!=="loading"&&feedStatus!=="error"&&<div className="no-results"><span>⌕</span><h4>No matching headlines</h4><p>Try another country, topic, source or region.</p><button onClick={clearFilters}>Reset search</button></div>}{filteredStories.length>7&&<button className="all-briefings" onClick={()=>setShowAll((value)=>!value)}>{showAll?"Show fewer headlines":`View all ${filteredStories.length} headlines`} <span>{showAll?"↑":"↓"}</span></button>}
        </section>

        <section className="signals-panel panel" id="indicators-section"><div className="panel-heading"><div><p>GLOBAL SIGNALS</p><h3>Markets & movement</h3></div><span className="live-indicator"><i/> SAMPLE</span></div><div className="signal-grid">{[{k:"BRENT",v:"$89.49",d:"+0.6%",up:true},{k:"GOLD",v:"$2,482",d:"+1.2%",up:true},{k:"USD IDX",v:"103.8",d:"−0.3%",up:false},{k:"FREIGHT",v:"1,947",d:"+4.8%",up:true}].map((item)=><div key={item.k}><p>{item.k}</p><strong>{item.v}</strong><span className={item.up?"up":"down"}>{item.d}</span></div>)}</div><div className="ticker"><span>WATCH</span><p>Strait transit volume remains below its recent baseline</p></div></section>

        <section className="saved-panel panel" id="saved-section"><div className="panel-heading"><div><p>YOUR WATCHLIST</p><h3>Saved briefings</h3></div><span className="saved-total">{savedIds.length}</span></div>{savedIds.length?<div className="saved-grid">{stories.filter((story)=>savedIds.includes(story.id)).map((story)=><article key={story.id}><button onClick={()=>setSelectedStory(story)}><span>{story.category}</span><strong>{story.title}</strong><small><time dateTime={story.publishedAt} title={`Published ${exactTime(story.publishedAt)}`}>{relativeTime(story.publishedAt,clock)}</time> · Open briefing →</small></button><a href={sourceUrlForStory(story)} target="_blank" rel="noreferrer">{sourceActionForStory()} ↗</a></article>)}</div>:<div className="saved-empty"><span>◇</span><p>Save any headline or top story and it will appear here.</p></div>}</section>
      </div>
      <footer><span>ATLAS Intelligence</span><span>Headlines, canonical links and publication times from publisher feeds · Map © OpenStreetMap</span><span>{lastFetchedAt?`Feeds checked ${exactTime(lastFetchedAt)}`:"Connecting feeds"}</span></footer>
    </section>

    <nav className="mobile-nav" aria-label="Mobile navigation">
      {[
        {label:"Home",view:"Overview",glyph:"⌂"},
        {label:"News",view:"Briefings",glyph:"▤"},
        {label:"Map",view:"Live events",glyph:"⌁"},
        {label:"Topics",view:"Countries",glyph:"◎"},
        {label:"Saved",view:"Watchlist",glyph:"◇"},
      ].map((item)=><button key={item.label} className={activeView===item.view?"active":""} onClick={()=>navigateTo(item.view)} aria-label={item.label}><span aria-hidden>{item.glyph}</span><small>{item.label}</small>{item.view==="Watchlist"&&savedIds.length>0&&<i>{savedIds.length}</i>}</button>)}
    </nav>

    {selectedStory&&<div className="story-modal-backdrop" role="presentation" onMouseDown={()=>setSelectedStory(null)}><article className="story-modal" role="dialog" aria-modal="true" aria-labelledby="story-modal-title" onMouseDown={(event)=>event.stopPropagation()}><button className="modal-close" onClick={()=>setSelectedStory(null)} aria-label="Close briefing">×</button><p>{selectedStory.category} · {selectedStory.region}</p><h2 id="story-modal-title">{selectedStory.title}</h2><div className="modal-meta"><span className={`status-dot ${selectedStory.level}`}/>{selectedStory.source} · <time dateTime={selectedStory.publishedAt} title={`Published ${exactTime(selectedStory.publishedAt)}`}>{relativeTime(selectedStory.publishedAt,clock)}</time> · {selectedStory.read} read</div><p className="modal-summary">{selectedStory.summary}</p><div className="modal-tags">{selectedStory.tags.map((tag)=><button key={tag} onClick={()=>{setQuery(tag);setAppliedQuery(tag);setSelectedStory(null);setShowAll(true);requestAnimationFrame(()=>navigateTo("Briefings"));}}>#{tag}</button>)}</div><div className="modal-actions"><a className="primary-action" href={sourceUrlForStory(selectedStory)} target="_blank" rel="noreferrer">{sourceActionForStory()} ↗</a><button onClick={()=>toggleSaved(selectedStory.id)}>{savedIds.includes(selectedStory.id)?"◆ Remove saved":"◇ Save"}</button><button onClick={()=>setSelectedStory(null)}>Close</button></div><small className="demo-note">The direct article URL and publication timestamp come from {selectedStory.source}’s feed. Relative age recalculates every minute; hover or focus it to see the exact reported time.</small></article></div>}
  </main>;
}
