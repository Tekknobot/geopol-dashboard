"use client";

import { FormEvent, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { MapMode } from "./components/WorldEventMap";

const WorldEventMap = dynamic(() => import("./components/WorldEventMap"), { ssr: false, loading: () => <div className="map-loading">Loading intelligence map…</div> });

type Story = { id:number; category:string; region:string; time:string; level:"critical"|"elevated"|"watch"|"stable"; title:string; summary:string; source:string; read:string; tags:string[] };

const coreStories: Story[] = [
  { id:1, category:"Energy", region:"Middle East", time:"12m", level:"critical", title:"Oil extends gains as uncertainty persists around Hormuz", summary:"Shipping access, insurance costs and Gulf diplomacy keep energy markets on alert.", source:"Reuters", read:"5 min", tags:["oil","shipping","strait","gulf"] },
  { id:2, category:"Security", region:"Europe", time:"18m", level:"critical", title:"Black Sea security talks turn to port infrastructure", summary:"Regional officials are prioritizing maritime access, air defence and grain terminals.", source:"AP", read:"4 min", tags:["ukraine","black sea","ports","grain"] },
  { id:3, category:"Technology", region:"Asia Pacific", time:"27m", level:"elevated", title:"Taiwan reviews network resilience after cyber disruption", summary:"Telecom and public-service operators are accelerating redundancy checks across the island.", source:"Financial Times", read:"6 min", tags:["taiwan","cyber","semiconductors"] },
  { id:4, category:"Trade", region:"Americas", time:"34m", level:"watch", title:"Panama Canal transit outlook improves as water levels stabilize", summary:"Carriers are reassessing schedules after the authority raised daily transit capacity.", source:"Bloomberg", read:"3 min", tags:["panama","shipping","logistics"] },
  { id:5, category:"Diplomacy", region:"Africa", time:"41m", level:"elevated", title:"Sahel neighbours reopen regional security dialogue", summary:"A new round of talks focuses on border coordination, food access and displacement.", source:"Al Jazeera", read:"5 min", tags:["sahel","borders","africa"] },
  { id:6, category:"Climate", region:"Africa", time:"52m", level:"watch", title:"Horn of Africa partners expand drought early-warning network", summary:"New monitoring stations aim to give farmers and relief agencies more lead time.", source:"ReliefWeb", read:"4 min", tags:["drought","food","humanitarian"] },
  { id:7, category:"Economy", region:"Americas", time:"1h", level:"watch", title:"Fresh inflation data resets the interest-rate outlook", summary:"Bond markets are repricing the path of central-bank decisions into year end.", source:"World Bank", read:"4 min", tags:["inflation","rates","markets"] },
  { id:8, category:"Security", region:"Middle East", time:"1h", level:"elevated", title:"Red Sea patrols adjust routes as merchant traffic shifts", summary:"Naval coordination is changing alongside a rise in longer Cape diversions.", source:"BBC", read:"5 min", tags:["red sea","suez","shipping"] },
  { id:9, category:"Trade", region:"Asia Pacific", time:"1h", level:"watch", title:"Malacca shipping volumes rise ahead of peak import season", summary:"Port calls and container bookings point to stronger near-term flows.", source:"Nikkei Asia", read:"3 min", tags:["malacca","trade","containers"] },
  { id:10, category:"Diplomacy", region:"Europe", time:"2h", level:"stable", title:"EU ministers advance a joint grid-security framework", summary:"The proposal links cross-border energy investment with resilience standards.", source:"Politico", read:"5 min", tags:["eu","grid","energy"] },
  { id:11, category:"Technology", region:"Americas", time:"2h", level:"watch", title:"Governments align reporting rules for critical cyber incidents", summary:"A common timeline could reduce gaps between national disclosure systems.", source:"The Record", read:"4 min", tags:["cyber","regulation","infrastructure"] },
  { id:12, category:"Climate", region:"Asia Pacific", time:"2h", level:"elevated", title:"Pacific states seek faster access to resilience finance", summary:"Leaders want smaller projects to receive funding without multi-year delays.", source:"UN News", read:"4 min", tags:["pacific","climate","finance"] },
  { id:13, category:"Economy", region:"Europe", time:"3h", level:"stable", title:"Manufacturing surveys show a mixed European recovery", summary:"Export orders improved while energy-intensive sectors remained under pressure.", source:"OECD", read:"3 min", tags:["manufacturing","europe","exports"] },
  { id:14, category:"Energy", region:"Africa", time:"3h", level:"watch", title:"East African power pool adds new cross-border capacity", summary:"The link is expected to improve reliability and support renewable balancing.", source:"African Development Bank", read:"5 min", tags:["electricity","africa","grid"] },
  { id:15, category:"Security", region:"Americas", time:"4h", level:"elevated", title:"Caribbean states coordinate a new maritime security plan", summary:"The plan combines coast-guard training, port screening and information sharing.", source:"Caricom", read:"4 min", tags:["caribbean","maritime","ports"] },
  { id:16, category:"Trade", region:"Middle East", time:"4h", level:"watch", title:"Gulf logistics hubs add capacity for overland cargo routes", summary:"Operators are expanding contingency options between ports and inland terminals.", source:"Arab News", read:"3 min", tags:["gulf","logistics","trade"] },
  { id:17, category:"Diplomacy", region:"Asia Pacific", time:"5h", level:"stable", title:"ASEAN working group resumes South China Sea consultations", summary:"Delegates are focusing on incident hotlines and practical confidence-building steps.", source:"Channel News Asia", read:"5 min", tags:["asean","south china sea","diplomacy"] },
  { id:18, category:"Climate", region:"Americas", time:"6h", level:"watch", title:"Amazon monitoring pact expands satellite data sharing", summary:"Participating states will share deforestation alerts through a regional hub.", source:"Mongabay", read:"4 min", tags:["amazon","forest","satellite"] },
];

const expansionRegions = [
  { place:"Baltic Sea", region:"Europe", focus:"ports and subsea infrastructure" },
  { place:"Western Balkans", region:"Europe", focus:"cross-border transport and investment" },
  { place:"Arctic Circle", region:"Europe", focus:"shipping access and northern infrastructure" },
  { place:"Eastern Mediterranean", region:"Middle East", focus:"energy routes and maritime coordination" },
  { place:"South Caucasus", region:"Europe", focus:"transit corridors and regional dialogue" },
  { place:"Central Asia", region:"Asia Pacific", focus:"rail links and critical-mineral supply" },
  { place:"Korean Peninsula", region:"Asia Pacific", focus:"security signalling and industrial output" },
  { place:"Mekong Basin", region:"Asia Pacific", focus:"water management and food production" },
  { place:"Bay of Bengal", region:"Asia Pacific", focus:"port capacity and cyclone resilience" },
  { place:"Indonesia", region:"Asia Pacific", focus:"nickel processing and maritime trade" },
  { place:"Gulf of Guinea", region:"Africa", focus:"shipping security and offshore energy" },
  { place:"Great Lakes region", region:"Africa", focus:"border commerce and humanitarian access" },
  { place:"Southern Africa", region:"Africa", focus:"power trading and freight corridors" },
  { place:"Andean region", region:"Americas", focus:"minerals, elections and infrastructure" },
  { place:"Mexico", region:"Americas", focus:"nearshoring, energy and border logistics" },
  { place:"Canadian Arctic", region:"Americas", focus:"northern access and climate monitoring" },
  { place:"Southern Cone", region:"Americas", focus:"agriculture, ports and monetary policy" },
];

const deskAngles = [
  { category:"Security", title:(place:string)=>`${place} officials expand monitoring of strategic infrastructure`, summary:(focus:string)=>`New coordination measures focus on ${focus} as agencies update regional contingency plans.` },
  { category:"Diplomacy", title:(place:string)=>`${place} partners open a new round of practical regional talks`, summary:(focus:string)=>`Delegations are seeking common ground on ${focus}, with technical working groups due to report next month.` },
  { category:"Economy", title:(place:string)=>`${place} indicators point to a shifting investment outlook`, summary:(focus:string)=>`Fresh data highlights how ${focus} are shaping business confidence, prices and capital spending.` },
  { category:"Energy", title:(place:string)=>`${place} energy planners accelerate resilience projects`, summary:(focus:string)=>`Utilities and governments are reviewing how ${focus} affect reliability, storage and cross-border supply.` },
  { category:"Technology", title:(place:string)=>`${place} launches shared data hub for critical systems`, summary:(focus:string)=>`The programme uses new monitoring tools to track ${focus} and shorten response times during disruptions.` },
  { category:"Climate", title:(place:string)=>`${place} adaptation plan links climate risk with trade`, summary:(focus:string)=>`The updated framework connects forecasts and financing to ${focus}, emphasizing earlier local warnings.` },
];

const deskSources = ["Reuters","AP","BBC","Financial Times","UN News","World Bank","OECD","ReliefWeb","Bloomberg","Politico","Nikkei Asia","Al Jazeera"];
const deskLevels:Story["level"][] = ["watch","stable","watch","elevated","stable","watch"];
const expandedStories:Story[] = expansionRegions.flatMap((location,locationIndex)=>deskAngles.map((angle,angleIndex)=>{
  const index=locationIndex*deskAngles.length+angleIndex;
  return { id:19+index, category:angle.category, region:location.region, time:`${7+Math.floor(index/5)}h`, level:deskLevels[angleIndex], title:angle.title(location.place), summary:angle.summary(location.focus), source:deskSources[index%deskSources.length], read:`${3+(index%4)} min`, tags:[location.place.toLowerCase(),angle.category.toLowerCase(),...location.focus.split(" ").filter((word)=>word.length>5).slice(0,2)] };
}));

const stories:Story[] = [...coreStories,...expandedStories];

const categories = ["All","Security","Diplomacy","Economy","Energy","Trade","Technology","Climate"];
const regions = ["All regions","Middle East","Europe","Asia Pacific","Africa","Americas"];
const heroStories = stories;
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

// Related editorial/file photography. Each source page carries the full creator,
// license and reuse terms. Sample headlines are deliberately not presented as
// photographs of a specific event that may not have occurred.
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
  if(heroMedia[story.id]) return heroMedia[story.id];
  const pool=editorialMedia[story.category] ?? editorialMedia.Diplomacy;
  const regionOffset=regions.indexOf(story.region);
  return pool[(story.id+Math.max(regionOffset,0))%pool.length];
};
const risks = [{label:"Energy security",value:86,delta:"+12",tone:"red"},{label:"Maritime trade",value:78,delta:"+08",tone:"orange"},{label:"Cyber activity",value:64,delta:"+05",tone:"amber"},{label:"Food systems",value:41,delta:"−03",tone:"blue"}];

export default function Home(){
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
  const [lastUpdated,setLastUpdated]=useState("2 min ago");
  const hero=heroStories[heroIndex];
  const heroVisual=mediaForStory(hero);

  const filteredStories=useMemo(()=>{const needle=appliedQuery.trim().toLowerCase();return stories.filter((story)=>{const inCategory=category==="All"||story.category===category;const inRegion=region==="All regions"||story.region===region;const haystack=[story.title,story.summary,story.category,story.region,story.source,...story.tags].join(" ").toLowerCase();return inCategory&&inRegion&&(!needle||haystack.includes(needle));});},[appliedQuery,category,region]);
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
      </nav><div className="sidebar-bottom"><div className="sync-status"><span/> Sample feeds operational</div><div className="analyst-card"><div className="avatar">AR</div><div><strong>Analyst workspace</strong><small>Global desk</small></div></div></div>
    </aside>
    <section className="workspace" id="top">
      <header className="topbar"><div><p className="eyebrow">GLOBAL INTELLIGENCE / <span>{activeView.toUpperCase()}</span></p><h1>World news monitor</h1></div><div className="top-actions">
        <form className="search-form" onSubmit={submitSearch}><label className="search"><span>⌕</span><input aria-label="Search all headlines" placeholder="Search countries, events, topics" value={query} onChange={(event)=>setQuery(event.target.value)}/><button type="submit" aria-label="Run search">↵</button></label>{query&&<div className="search-hint"><strong>Press Enter to search all stories</strong><span>Try “Taiwan”, “energy”, “Africa” or “shipping”</span></div>}</form>
        <button className="icon-button" aria-label="Open notifications" onClick={()=>setNotificationsOpen((open)=>!open)}>◉<span className="notification-dot"/></button><button className="refresh-button" onClick={()=>setLastUpdated("just now")}><span>↻</span> Updated {lastUpdated}</button>
        {notificationsOpen&&<div className="notifications-popover"><strong>Intelligence alerts</strong><button onClick={()=>{setQuery("Hormuz");setAppliedQuery("Hormuz");setNotificationsOpen(false);navigateTo("Briefings");}}>Hormuz risk moved to critical <span>12m</span></button><button onClick={()=>{setMapMode("Risk");setNotificationsOpen(false);navigateTo("Live events");}}>Two new risk markers added <span>41m</span></button></div>}
      </div></header>

      <section className="category-strip" id="categories-section" aria-label="News categories"><div><p>EXPLORE THE DESK</p><h2>Topics</h2></div><div className="category-buttons">{categories.map((item)=><button key={item} className={category===item?"active":""} onClick={()=>chooseCategory(item)}>{item}<span>{item==="All"?stories.length:stories.filter((story)=>story.category===item).length}</span></button>)}</div></section>

      <div className="dashboard-grid">
        <section className="hero-card" id="overview-section"><div key={hero.id} className="hero-image-wrap hero-image-change"><img className="hero-photo" src={heroVisual.image} alt={`Related file photo: ${heroVisual.label}`} onError={(event)=>{event.currentTarget.src=heroMedia[1].image;}}/><div className="hero-image-overlay"/><div className="hero-label"><span/> FILE PHOTO · HEADLINE {heroIndex+1} / {heroStories.length}</div><div className="hero-caption"><p>{hero.category.toUpperCase()} · {hero.region.toUpperCase()}</p><h2>{hero.title}</h2><div className="story-meta"><span>{hero.source}</span><span>{hero.time} ago</span><span>{hero.read} read</span></div></div><button className="carousel-arrow previous" aria-label="Previous headline" onClick={()=>setHeroIndex((heroIndex-1+heroStories.length)%heroStories.length)}>‹</button><button className="carousel-arrow next" aria-label="Next headline" onClick={()=>setHeroIndex((heroIndex+1)%heroStories.length)}>›</button><a className="image-credit" href={heroVisual.credit} target="_blank" rel="noreferrer">{heroVisual.label} · license ↗</a></div><div className="hero-summary"><p>{hero.summary}</p><div className="hero-summary-actions"><button className="primary-action" onClick={()=>setSelectedStory(hero)}>Open briefing</button><button onClick={()=>toggleSaved(hero.id)} className={savedIds.includes(hero.id)?"saved":""}>{savedIds.includes(hero.id)?"◆ Saved":"◇ Save"}</button></div></div><div className="carousel-navigator"><div className="carousel-progress" aria-label={`Headline ${heroIndex+1} of ${heroStories.length}`}><i style={{width:`${((heroIndex+1)/heroStories.length)*100}%`}}/></div><span>{String(heroIndex+1).padStart(3,"0")} / {heroStories.length}</span><label>Jump to<select value={heroIndex} onChange={(event)=>setHeroIndex(Number(event.target.value))} aria-label="Jump to a headline">{heroStories.map((story,index)=><option value={index} key={story.id}>{String(index+1).padStart(3,"0")} · {story.title}</option>)}</select></label></div></section>

        <aside className="risk-panel panel" id="risk-section"><div className="panel-heading"><div><p>RISK PULSE</p><h3>Global pressure index</h3></div><button aria-label="Explain risk index" onClick={()=>setRiskOpen((open)=>!open)}>ⓘ</button></div><div className="risk-score"><strong>72</strong><div><span>↗ 8 pts</span><small>Elevated</small></div></div><div className="sparkline" aria-label="Risk index trend over 12 hours">{[24,30,27,38,42,39,58,54,68,63,77,72].map((height,index)=><i key={index} style={{height:`${height}%`}}/>)}</div><p className="axis-label"><span>12H AGO</span><span>NOW</span></p><div className="risk-list">{risks.map((risk)=><div key={risk.label}><div className="risk-row"><span><i className={risk.tone}/>{risk.label}</span><strong>{risk.value}<em>{risk.delta}</em></strong></div><div className="risk-track"><i className={risk.tone} style={{width:`${risk.value}%`}}/></div></div>)}</div>{riskOpen&&<div className="method-note"><strong>How it works</strong><p>A sample composite of security, trade, cyber and food-system signals. Values illustrate the dashboard experience and are not live analysis.</p></div>}</aside>

        <section className="map-panel panel" id="events-section"><div className="panel-heading map-heading"><div><p>LIVE SITUATION MAP</p><h3>{mapMode==="Events"?"Active geopolitical events":mapMode==="Risk"?"Global risk hotspots":"Strategic trade corridors"}</h3></div><div className="map-controls">{(["Events","Risk","Trade"] as MapMode[]).map((mode)=><button key={mode} className={mapMode===mode?"active":""} onClick={()=>setMapMode(mode)} aria-pressed={mapMode===mode}>{mode}</button>)}</div></div><WorldEventMap mode={mapMode} filter={[appliedQuery,category==="All"?"":category,region==="All regions"?"":region].filter(Boolean).join(" ")}/></section>

        <section className="headline-panel panel" id="stories-section"><div className="panel-heading feed-heading"><div><p>HEADLINE WIRE</p><h3>{appliedQuery?`Search: “${appliedQuery}”`:category==="All"?"Latest world headlines":`${category} headlines`}</h3><span className="result-count">{filteredStories.length} result{filteredStories.length===1?"":"s"}</span></div><select value={region} onChange={(event)=>{setRegion(event.target.value);setShowAll(true);}} aria-label="Filter by region">{regions.map((item)=><option key={item}>{item}</option>)}</select></div>
          {(appliedQuery||category!=="All"||region!=="All regions")&&<div className="active-filters">{appliedQuery&&<span>Search: {appliedQuery}</span>}{category!=="All"&&<span>{category}</span>}{region!=="All regions"&&<span>{region}</span>}<button onClick={clearFilters}>Clear all ×</button></div>}
          <div className="headline-list">{filteredStories.slice(0,showAll?filteredStories.length:7).map((story)=><article key={story.id} className="headline-row"><button className="headline-main" onClick={()=>setSelectedStory(story)}><span className={`status-dot ${story.level}`}/><span className="headline-copy"><span className="headline-kicker">{story.region} · {story.category}</span><strong>{story.title}</strong><small>{story.source} · {story.time} ago · {story.read}</small></span></button><button className={`save-icon ${savedIds.includes(story.id)?"saved":""}`} onClick={()=>toggleSaved(story.id)} aria-label={`Save ${story.title}`}>{savedIds.includes(story.id)?"◆":"◇"}</button></article>)}</div>
          {!filteredStories.length&&<div className="no-results"><span>⌕</span><h4>No matching headlines</h4><p>Try another country, topic, source or region.</p><button onClick={clearFilters}>Reset search</button></div>}{filteredStories.length>7&&<button className="all-briefings" onClick={()=>setShowAll((value)=>!value)}>{showAll?"Show fewer headlines":`View all ${filteredStories.length} headlines`} <span>{showAll?"↑":"↓"}</span></button>}
        </section>

        <section className="signals-panel panel" id="indicators-section"><div className="panel-heading"><div><p>GLOBAL SIGNALS</p><h3>Markets & movement</h3></div><span className="live-indicator"><i/> SAMPLE</span></div><div className="signal-grid">{[{k:"BRENT",v:"$89.49",d:"+0.6%",up:true},{k:"GOLD",v:"$2,482",d:"+1.2%",up:true},{k:"USD IDX",v:"103.8",d:"−0.3%",up:false},{k:"FREIGHT",v:"1,947",d:"+4.8%",up:true}].map((item)=><div key={item.k}><p>{item.k}</p><strong>{item.v}</strong><span className={item.up?"up":"down"}>{item.d}</span></div>)}</div><div className="ticker"><span>WATCH</span><p>Strait transit volume remains below its recent baseline</p></div></section>

        <section className="saved-panel panel" id="saved-section"><div className="panel-heading"><div><p>YOUR WATCHLIST</p><h3>Saved briefings</h3></div><span className="saved-total">{savedIds.length}</span></div>{savedIds.length?<div className="saved-grid">{stories.filter((story)=>savedIds.includes(story.id)).map((story)=><button key={story.id} onClick={()=>setSelectedStory(story)}><span>{story.category}</span><strong>{story.title}</strong><small>{story.time} ago →</small></button>)}</div>:<div className="saved-empty"><span>◇</span><p>Save any headline or top story and it will appear here.</p></div>}</section>
      </div>
      <footer><span>ATLAS Intelligence</span><span>Demonstration data · Map © OpenStreetMap · File-photo attribution on every slide</span><span>12 Aug 2026 · 14:32 UTC</span></footer>
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

    {selectedStory&&<div className="story-modal-backdrop" role="presentation" onMouseDown={()=>setSelectedStory(null)}><article className="story-modal" role="dialog" aria-modal="true" aria-labelledby="story-modal-title" onMouseDown={(event)=>event.stopPropagation()}><button className="modal-close" onClick={()=>setSelectedStory(null)} aria-label="Close briefing">×</button><p>{selectedStory.category} · {selectedStory.region}</p><h2 id="story-modal-title">{selectedStory.title}</h2><div className="modal-meta"><span className={`status-dot ${selectedStory.level}`}/>{selectedStory.source} · {selectedStory.time} ago · {selectedStory.read} read</div><p className="modal-summary">{selectedStory.summary}</p><div className="modal-tags">{selectedStory.tags.map((tag)=><button key={tag} onClick={()=>{setQuery(tag);setAppliedQuery(tag);setSelectedStory(null);setShowAll(true);requestAnimationFrame(()=>navigateTo("Briefings"));}}>#{tag}</button>)}</div><div className="modal-actions"><button className="primary-action" onClick={()=>toggleSaved(selectedStory.id)}>{savedIds.includes(selectedStory.id)?"◆ Remove from watchlist":"◇ Save to watchlist"}</button><button onClick={()=>setSelectedStory(null)}>Close</button></div><small className="demo-note">This is a demonstration briefing assembled from sample dashboard data.</small></article></div>}
  </main>;
}
