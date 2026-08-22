"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import "./simulator.css";

const CanadaMap=dynamic(()=>import("./CanadaMap"),{ssr:false,loading:()=> <div className="sim-map-loading">Loading Canadian operating picture…</div>});

type Severity="critical"|"elevated"|"watch"|"stable";
type LiveEvent={id:string;title:string;summary:string;lat:number;lng:number;severity:Severity;source:string;sourceUrl:string;category:string;occurredAt:string;location?:string};
type Province={id:string;name:string;abbr:string;lat:number;lng:number;population:number;housing:number;grid:number;health:number;climate:number;transit:number;productivity:number};

type Scenario={homes:number;cleanPower:number;transit:number;health:number;adaptation:number;productivity:number};

const provinces:Province[]=[
{id:"BC",name:"British Columbia",abbr:"BC",lat:53.7,lng:-124.8,population:5.7,housing:61,grid:86,health:72,climate:63,transit:67,productivity:76},
{id:"AB",name:"Alberta",abbr:"AB",lat:54.4,lng:-115.1,population:5.0,housing:72,grid:58,health:73,climate:55,transit:54,productivity:83},
{id:"SK",name:"Saskatchewan",abbr:"SK",lat:54.4,lng:-106.4,population:1.25,housing:78,grid:55,health:70,climate:57,transit:43,productivity:75},
{id:"MB",name:"Manitoba",abbr:"MB",lat:54.6,lng:-97.2,population:1.5,housing:76,grid:91,health:71,climate:60,transit:51,productivity:70},
{id:"ON",name:"Ontario",abbr:"ON",lat:50.1,lng:-85.3,population:16.2,housing:55,grid:84,health:74,climate:67,transit:72,productivity:82},
{id:"QC",name:"Quebec",abbr:"QC",lat:52.2,lng:-71.8,population:9.1,housing:69,grid:94,health:75,climate:70,transit:74,productivity:74},
{id:"NB",name:"New Brunswick",abbr:"NB",lat:46.6,lng:-66.3,population:.86,housing:75,grid:69,health:68,climate:65,transit:42,productivity:65},
{id:"NS",name:"Nova Scotia",abbr:"NS",lat:45.1,lng:-63.3,population:1.08,housing:64,grid:61,health:68,climate:64,transit:50,productivity:67},
{id:"PE",name:"Prince Edward Island",abbr:"PE",lat:46.4,lng:-63.4,population:.18,housing:68,grid:72,health:66,climate:62,transit:38,productivity:63},
{id:"NL",name:"Newfoundland and Labrador",abbr:"NL",lat:53.1,lng:-59.5,population:.55,housing:77,grid:82,health:67,climate:58,transit:40,productivity:69},
{id:"YT",name:"Yukon",abbr:"YT",lat:64.0,lng:-135.0,population:.047,housing:60,grid:70,health:69,climate:50,transit:34,productivity:68},
{id:"NT",name:"Northwest Territories",abbr:"NT",lat:64.8,lng:-124.8,population:.045,housing:52,grid:48,health:65,climate:45,transit:31,productivity:69},
{id:"NU",name:"Nunavut",abbr:"NU",lat:70.3,lng:-86.0,population:.041,housing:39,grid:39,health:58,climate:41,transit:25,productivity:57}
];

const initialScenario:Scenario={homes:0,cleanPower:0,transit:0,health:0,adaptation:0,productivity:0};
const clamp=(n:number)=>Math.max(0,Math.min(100,n));

function scoreProvince(p:Province,s:Scenario){
  const housing=clamp(p.housing+s.homes*.55+s.transit*.08);
  const grid=clamp(p.grid+s.cleanPower*.42+s.adaptation*.08);
  const health=clamp(p.health+s.health*.46+s.homes*.04);
  const climate=clamp(p.climate+s.adaptation*.5+s.cleanPower*.13);
  const transit=clamp(p.transit+s.transit*.5+s.homes*.05);
  const productivity=clamp(p.productivity+s.productivity*.38+s.transit*.08+s.cleanPower*.04);
  const resilience=(housing+grid+health+climate+transit+productivity)/6;
  return {housing,grid,health,climate,transit,productivity,resilience};
}

export default function SimulatorPage(){
 const [scenario,setScenario]=useState<Scenario>(initialScenario);
 const [selected,setSelected]=useState("CA");
 const [events,setEvents]=useState<LiveEvent[]>([]);
 const [status,setStatus]=useState<"loading"|"live"|"partial">("loading");
 const [layer,setLayer]=useState<"situation"|"resilience"|"housing"|"grid">("situation");
 const [horizon,setHorizon]=useState(2035);

 useEffect(()=>{
   let cancelled=false;
   Promise.allSettled([
     fetch("/api/intelligence",{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject()),
     fetch("/api/news",{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject())
   ]).then(results=>{
     if(cancelled)return;
     const merged:LiveEvent[]=[];
     const intel=results[0].status==="fulfilled"?results[0].value:null;
     const news=results[1].status==="fulfilled"?results[1].value:null;
     for(const e of intel?.events??[]){
       if(e.lat>=40&&e.lat<=84&&e.lng>=-142&&e.lng<=-50)merged.push({id:`intel-${e.id}`,title:e.title,summary:e.summary,lat:e.lat,lng:e.lng,severity:e.severity,source:e.source,sourceUrl:e.sourceUrl,category:e.layer??e.category??"Hazard",occurredAt:e.occurredAt,location:e.location});
     }
     for(const s of news?.stories??[]){
       if((s.region==="Canada"||/canada|canadian|ontario|quebec|alberta|british columbia|manitoba|saskatchewan|nova scotia|new brunswick|newfoundland|nunavut|yukon|northwest territories/i.test(`${s.title} ${s.summary}`))&&s.location){
         merged.push({id:`news-${s.id}`,title:s.title,summary:s.summary,lat:s.location.lat,lng:s.location.lng,severity:s.level,source:s.source,sourceUrl:s.articleUrl,category:s.category,occurredAt:s.publishedAt,location:s.location.name});
       }
     }
     setEvents(merged.sort((a,b)=>Date.parse(b.occurredAt)-Date.parse(a.occurredAt)).slice(0,120));
     setStatus(results.every(r=>r.status==="fulfilled")?"live":"partial");
   });
   return()=>{cancelled=true};
 },[]);

 const selectedProvince=provinces.find(p=>p.id===selected);
 const aggregate=useMemo(()=>{
   const total=provinces.reduce((a,p)=>a+p.population,0);
   const sums=provinces.reduce((acc,p)=>{const s=scoreProvince(p,scenario);for(const k of Object.keys(s) as Array<keyof typeof s>)acc[k]+=s[k]*p.population;return acc;},{housing:0,grid:0,health:0,climate:0,transit:0,productivity:0,resilience:0});
   for(const k of Object.keys(sums) as Array<keyof typeof sums>)sums[k]/=total;
   return sums;
 },[scenario]);
 const focus=selectedProvince?scoreProvince(selectedProvince,scenario):aggregate;
 const investment=Math.round((scenario.homes*1.8+scenario.cleanPower*1.35+scenario.transit*1.55+scenario.health*1.2+scenario.adaptation*.9+scenario.productivity*.75)*10)/10;
 const horizonFactor=(horizon-2026)/9;
 const homesAdded=Math.round(scenario.homes*17500*horizonFactor);
 const cleanAdded=Math.round(scenario.cleanPower*410*horizonFactor)/10;
 const transitGain=Math.round(scenario.transit*.12*horizonFactor*10)/10;
 const pressure=Math.max(0,Math.round((100-focus.resilience)+(events.filter(e=>e.severity==="critical"||e.severity==="elevated").length*1.8)));
 const change=(key:keyof Scenario,value:number)=>setScenario(s=>({...s,[key]:value}));

 return <main className="sim-root">
   <header className="sim-topbar"><Link href="/" className="sim-brand">ATLAS<span>.</span></Link><div><p>CANADA / NATIONAL MODEL</p><h1>Atlas Simulator</h1></div><nav><Link href="/">World</Link><Link href="/intelligence">Intelligence</Link><b>Simulator</b></nav><span className={`sim-live ${status}`}><i/>{status==="loading"?"SYNCING":status.toUpperCase()}</span></header>
   <section className="sim-hero"><div><span className="eyebrow">NATIONAL SITUATIONAL AWARENESS + OPEN-DATA SCENARIO LAB</span><h2>See Canada now.<br/><em>Change what happens next.</em></h2><p>Live Atlas signals sit beside a transparent scenario model. Adjust policy levers, select a province, and compare projected system resilience through {horizon}. Simulation outputs are illustrative—not forecasts.</p></div><aside><small>NATIONAL PRESSURE</small><strong>{pressure}</strong><span>/ 100</span><p>{pressure>55?"High combined pressure":pressure>35?"Elevated operating pressure":"Moderate operating pressure"}</p></aside></section>

   <div className="sim-grid">
    <section className="sim-map-card">
      <div className="sim-section-head"><div><span>OPERATING PICTURE</span><h3>Canada live map</h3></div><div className="sim-tabs">{(["situation","resilience","housing","grid"] as const).map(x=><button key={x} className={layer===x?"active":""} onClick={()=>setLayer(x)}>{x}</button>)}</div></div>
      <CanadaMap provinces={provinces} events={events} scenario={scenario} selected={selected} onSelect={setSelected} layer={layer}/>
      <div className="sim-map-footer"><span><i className="critical"/>Critical</span><span><i className="elevated"/>Elevated</span><span><i className="watch"/>Watch</span><span><i className="stable"/>Stable</span><strong>{events.length} current mapped signals</strong></div>
    </section>

    <aside className="sim-controls">
      <div className="sim-section-head"><div><span>SCENARIO LAB</span><h3>Policy levers</h3></div><button className="reset" onClick={()=>setScenario(initialScenario)}>Reset</button></div>
      <label className="sim-horizon"><span>Projection horizon</span><b>{horizon}</b><input type="range" min="2030" max="2050" step="5" value={horizon} onChange={e=>setHorizon(Number(e.target.value))}/></label>
      <Slider label="Housing supply" value={scenario.homes} unit="intensity" onChange={v=>change("homes",v)}/>
      <Slider label="Clean power build-out" value={scenario.cleanPower} unit="intensity" onChange={v=>change("cleanPower",v)}/>
      <Slider label="Transit expansion" value={scenario.transit} unit="intensity" onChange={v=>change("transit",v)}/>
      <Slider label="Health capacity" value={scenario.health} unit="intensity" onChange={v=>change("health",v)}/>
      <Slider label="Climate adaptation" value={scenario.adaptation} unit="intensity" onChange={v=>change("adaptation",v)}/>
      <Slider label="Productivity / innovation" value={scenario.productivity} unit="intensity" onChange={v=>change("productivity",v)}/>
      <div className="sim-cost"><span>MODELLED PROGRAM SCALE</span><strong>${investment}B</strong><small>Illustrative relative investment envelope</small></div>
    </aside>
   </div>

   <section className="sim-output">
     <div className="sim-section-head"><div><span>{selectedProvince?selectedProvince.name.toUpperCase():"CANADA"}</span><h3>Scenario outcomes</h3></div><select value={selected} onChange={e=>setSelected(e.target.value)}><option value="CA">Canada</option>{provinces.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
     <div className="sim-score-grid"><Score label="Resilience" value={focus.resilience}/><Score label="Housing" value={focus.housing}/><Score label="Grid" value={focus.grid}/><Score label="Health" value={focus.health}/><Score label="Climate" value={focus.climate}/><Score label="Transit" value={focus.transit}/><Score label="Productivity" value={focus.productivity}/></div>
     <div className="sim-projections"><article><span>ADDITIONAL HOMES</span><strong>+{homesAdded.toLocaleString()}</strong><small>scenario-equivalent capacity by {horizon}</small></article><article><span>CLEAN CAPACITY</span><strong>+{cleanAdded} GW</strong><small>scenario-equivalent generation build-out</small></article><article><span>TRANSIT ACCESS</span><strong>+{transitGain} pts</strong><small>modelled accessibility improvement</small></article><article><span>RESILIENCE INDEX</span><strong>{Math.round(focus.resilience)}</strong><small>composite 0–100 model score</small></article></div>
   </section>

   <section className="sim-bottom-grid">
    <div className="sim-feed"><div className="sim-section-head"><div><span>LIVE SIGNALS</span><h3>Canadian situation queue</h3></div><small>Atlas public-source ingestion</small></div>{events.slice(0,8).map(e=><a key={e.id} href={e.sourceUrl} target="_blank" rel="noreferrer"><i className={e.severity}/><div><span>{e.category} · {e.location??e.source}</span><strong>{e.title}</strong><small>{e.source}</small></div><b>↗</b></a>)}{!events.length&&<p className="sim-empty">No Canadian Atlas signals are available from the current feeds.</p>}</div>
    <div className="sim-method"><span>MODEL TRANSPARENCY</span><h3>What is real vs simulated?</h3><p><b>Live layer:</b> current Atlas news and hazard feeds are mapped when they resolve to Canadian coordinates.</p><p><b>Baseline layer:</b> province profiles are normalized prototype indicators intended to be replaced by Statistics Canada and department-specific vectors.</p><p><b>Scenario layer:</b> policy sliders use explicit deterministic weights. They demonstrate interaction design, not causal forecasts.</p><div><a href="https://www.statcan.gc.ca/en/developers/wds" target="_blank" rel="noreferrer">Statistics Canada WDS ↗</a><a href="https://www.canada.ca/en/environment-climate-change/services/weather-general-tools-resources/weather-tools-specialized-data/msc-geomet-api-geospatial-web-services.html" target="_blank" rel="noreferrer">ECCC GeoMet ↗</a></div></div>
   </section>
 </main>
}

function Slider({label,value,onChange}:{label:string;value:number;unit:string;onChange:(v:number)=>void}){return <label className="sim-slider"><div><span>{label}</span><b>{value}%</b></div><input type="range" min="0" max="100" step="5" value={value} onChange={e=>onChange(Number(e.target.value))}/></label>}
function Score({label,value}:{label:string;value:number}){return <article className="sim-score"><div><span>{label}</span><b>{Math.round(value)}</b></div><meter min="0" max="100" value={value}/></article>}
