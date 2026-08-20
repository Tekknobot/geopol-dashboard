"use client";

import {useEffect,useMemo,useState} from "react";
import {CircleMarker,MapContainer,Polyline,TileLayer,Tooltip,useMap,useMapEvents,ZoomControl} from "react-leaflet";

export type IntelSeverity="critical"|"elevated"|"watch"|"stable";
export type IntelLayer="Headlines"|"Earthquakes"|"Wildfires"|"Storms"|"Volcanoes"|"Floods"|"Other natural"|"Infrastructure";
export type IntelPoint={
  id:string;
  layer:IntelLayer;
  title:string;
  summary:string;
  lat:number;
  lng:number;
  occurredAt:string;
  severity:IntelSeverity;
  source:string;
  sourceUrl?:string;
  location?:string;
  category?:string;
  reference?:boolean;
};

type Cluster={key:string;lat:number;lng:number;points:IntelPoint[];severity:IntelSeverity};
type Basemap="dark"|"light"|"terrain";
const layerOrder:IntelLayer[]=["Headlines","Earthquakes","Wildfires","Storms","Volcanoes","Floods","Other natural","Infrastructure"];
const layerIcons:Record<IntelLayer,string>={Headlines:"▤",Earthquakes:"≋",Wildfires:"♨",Storms:"◌",Volcanoes:"△",Floods:"≈","Other natural":"◇",Infrastructure:"⌘"};
const colors:Record<IntelSeverity,string>={critical:"#ff4d5b",elevated:"#ff8b4a",watch:"#f6ce52",stable:"#4dd4a8"};
const severityRank:Record<IntelSeverity,number>={critical:4,elevated:3,watch:2,stable:1};
const basemaps:Record<Basemap,{url:string;attribution:string}>={
  dark:{url:"https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'},
  light:{url:"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'},
  terrain:{url:"https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",attribution:'Map data &copy; OpenStreetMap contributors, SRTM | Map style &copy; OpenTopoMap'},
};
const regions=[
  {label:"Global",lat:18,lng:8,zoom:2},
  {label:"Americas",lat:18,lng:-78,zoom:3},
  {label:"Europe",lat:50,lng:14,zoom:4},
  {label:"MENA",lat:28,lng:41,zoom:4},
  {label:"Africa",lat:2,lng:21,zoom:3},
  {label:"Asia",lat:30,lng:105,zoom:3},
  {label:"Pacific",lat:-9,lng:151,zoom:3},
];
const tradeRoutes:Array<{name:string;points:[number,number][]}>=[
  {name:"Europe–Asia corridor",points:[[51.9,4.5],[36.1,-5.4],[30.1,32.6],[12.6,43.4],[6.9,79.9],[1.3,103.8]]},
  {name:"Gulf energy corridor",points:[[26.6,56.3],[12.6,43.4],[30.1,32.6],[36.1,-5.4]]},
  {name:"Atlantic corridor",points:[[51.9,4.5],[36.1,-5.4],[9.1,-79.7],[-23,-43.2]]},
];

const relativeTime=(value:string)=>{
  const elapsed=Math.max(0,Date.now()-Date.parse(value));
  const minutes=Math.floor(elapsed/60000);
  if(minutes<1)return "now";
  if(minutes<60)return `${minutes}m`;
  const hours=Math.floor(minutes/60);
  if(hours<24)return `${hours}h`;
  return `${Math.floor(hours/24)}d`;
};

function toneFor(points:IntelPoint[]):IntelSeverity{return points.reduce<IntelSeverity>((tone,point)=>severityRank[point.severity]>severityRank[tone]?point.severity:tone,"stable");}
function clustersFor(points:IntelPoint[],zoom:number):Cluster[]{
  const cell=zoom<=2?20:zoom===3?11:zoom===4?5.5:zoom===5?2.5:zoom===6?1.1:.35;
  const groups=new Map<string,IntelPoint[]>();
  points.forEach((point)=>{const key=`${Math.floor((point.lat+90)/cell)}:${Math.floor((point.lng+180)/cell)}`;groups.set(key,[...(groups.get(key)??[]),point]);});
  return [...groups.entries()].map(([key,items])=>({key,lat:items.reduce((sum,item)=>sum+item.lat,0)/items.length,lng:items.reduce((sum,item)=>sum+item.lng,0)/items.length,points:items,severity:toneFor(items)}));
}

function MapMotion({focus}:{focus:{lat:number;lng:number;zoom:number;key:number}}){
  const map=useMap();
  useEffect(()=>{map.flyTo([focus.lat,focus.lng],focus.zoom,{duration:.8});const timer=setTimeout(()=>map.invalidateSize(),260);return()=>clearTimeout(timer);},[focus,map]);
  return null;
}
function ZoomWatch({onZoom}:{onZoom:(zoom:number)=>void}){useMapEvents({zoomend:(event)=>onZoom(event.target.getZoom())});return null;}

export default function IntelligenceMap({points,status,fetchedAt,sourceLine}:{points:IntelPoint[];status:"loading"|"live"|"partial"|"unavailable";fetchedAt:string|null;sourceLine:string}){
  const [activeLayers,setActiveLayers]=useState<Set<IntelLayer>>(()=>new Set(layerOrder));
  const [timeWindow,setTimeWindow]=useState<6|24|168>(24);
  const [query,setQuery]=useState("");
  const [zoom,setZoom]=useState(2);
  const [basemap,setBasemap]=useState<Basemap>("dark");
  const [pressure,setPressure]=useState(true);
  const [routes,setRoutes]=useState(true);
  const [selected,setSelected]=useState<IntelPoint|null>(null);
  const [selectedCluster,setSelectedCluster]=useState<IntelPoint[]|null>(null);
  const [focus,setFocus]=useState({lat:18,lng:8,zoom:2,key:0});
  const [mobilePanel,setMobilePanel]=useState<"layers"|"feed"|null>(null);
  const [focusMode,setFocusMode]=useState(false);
  const [saved,setSaved]=useState<string[]>([]);
  const [copied,setCopied]=useState(false);

  useEffect(()=>{try{const stored=JSON.parse(localStorage.getItem("atlas:intelligence:saved:v1")??"[]");if(Array.isArray(stored))setSaved(stored.filter((item):item is string=>typeof item==="string"));}catch{/* device storage unavailable */}},[]);
  useEffect(()=>{const shortcut=(event:KeyboardEvent)=>{if(event.key==="Escape"){setSelected(null);setSelectedCluster(null);setMobilePanel(null);}if(event.key==="/"&&document.activeElement?.tagName!=="INPUT"){event.preventDefault();document.getElementById("intel-search")?.focus();}};window.addEventListener("keydown",shortcut);return()=>window.removeEventListener("keydown",shortcut);},[]);

  const counts=useMemo(()=>new Map(layerOrder.map((layer)=>[layer,points.filter((point)=>point.layer===layer).length])),[points]);
  const filtered=useMemo(()=>{
    const needle=query.trim().toLowerCase();
    const cutoff=Date.now()-timeWindow*3600000;
    return points.filter((point)=>activeLayers.has(point.layer)&&(point.reference||Date.parse(point.occurredAt)>=cutoff)&&(!needle||[point.title,point.summary,point.source,point.location,point.category,point.layer].join(" ").toLowerCase().includes(needle)));
  },[activeLayers,points,query,timeWindow]);
  const sorted=useMemo(()=>[...filtered].sort((a,b)=>severityRank[b.severity]-severityRank[a.severity]||Date.parse(b.occurredAt)-Date.parse(a.occurredAt)),[filtered]);
  const clusters=useMemo(()=>clustersFor(filtered,zoom),[filtered,zoom]);
  const urgent=filtered.filter((point)=>point.severity==="critical"||point.severity==="elevated").length;
  const locations=new Set(filtered.map((point)=>`${point.lat.toFixed(1)}:${point.lng.toFixed(1)}`)).size;
  const timeline=useMemo(()=>[...filtered].filter((point)=>!point.reference).sort((a,b)=>Date.parse(b.occurredAt)-Date.parse(a.occurredAt)).slice(0,10),[filtered]);
  const shown=selectedCluster??(selected?[selected]:sorted.slice(0,14));

  const toggleLayer=(layer:IntelLayer)=>setActiveLayers((current)=>{const next=new Set(current);if(next.has(layer))next.delete(layer);else next.add(layer);return next;});
  const choosePoint=(point:IntelPoint)=>{setSelected(point);setSelectedCluster(null);setFocus({lat:point.lat,lng:point.lng,zoom:Math.max(zoom,5),key:Date.now()});setMobilePanel("feed");};
  const toggleSaved=(id:string)=>setSaved((current)=>{const next=current.includes(id)?current.filter((item)=>item!==id):[id,...current].slice(0,100);try{localStorage.setItem("atlas:intelligence:saved:v1",JSON.stringify(next));}catch{/* device storage unavailable */}return next;});
  const share=async(point:IntelPoint)=>{const value=point.sourceUrl??window.location.href;try{await navigator.clipboard.writeText(value);setCopied(true);setTimeout(()=>setCopied(false),1300);}catch{/* clipboard unavailable */}};

  return <main className={`intelligence-workspace ${focusMode?"focus-mode":""}`}>
    <header className="intel-topbar">
      <a className="intel-brand" href="/"><span><i/><i/><i/></span>ATLAS<b>.</b></a>
      <div className="intel-title"><p>GLOBAL SITUATION ROOM</p><h1>Intelligence Map</h1></div>
      <div className={`intel-live ${status}`}><i/><span>{status==="loading"?"SYNCING":status.toUpperCase()}</span><small>{fetchedAt?`Updated ${relativeTime(fetchedAt)} ago`:"Connecting sources"}</small></div>
      <nav><a href="/">World desk</a><a href="/entertainment">Entertainment</a><a href="/sports">Sports</a></nav>
    </header>

    <div className="intel-layout">
      <aside className={`intel-layers ${mobilePanel==="layers"?"mobile-open":""}`}>
        <div className="intel-panel-head"><div><span>OPERATING PICTURE</span><strong>Map controls</strong></div><button onClick={()=>setMobilePanel(null)} aria-label="Close layers">×</button></div>
        <label className="intel-search"><span>⌕</span><input id="intel-search" value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search signals, places, sources"/><kbd>/</kbd></label>
        <section><div className="intel-section-label"><span>TIME WINDOW</span><small>Live data</small></div><div className="intel-segmented">{([6,24,168] as const).map((hours)=><button className={timeWindow===hours?"active":""} key={hours} onClick={()=>setTimeWindow(hours)}>{hours===168?"7D":`${hours}H`}</button>)}</div></section>
        <section><div className="intel-section-label"><span>DATA LAYERS</span><button onClick={()=>setActiveLayers(activeLayers.size?new Set():new Set(layerOrder))}>{activeLayers.size?"Clear":"All"}</button></div><div className="intel-layer-list">{layerOrder.map((layer)=><button key={layer} onClick={()=>toggleLayer(layer)} className={activeLayers.has(layer)?"active":""}><i>{layerIcons[layer]}</i><span>{layer}<small>{layer==="Infrastructure"?"Reference":layer==="Headlines"?"Publisher feeds":"Official feed"}</small></span><b>{counts.get(layer)??0}</b><em/></button>)}</div></section>
        <section><div className="intel-section-label"><span>ANALYTIC OVERLAYS</span></div><label className="intel-switch"><span>Pressure fields<small>Urgency-weighted halos</small></span><input type="checkbox" checked={pressure} onChange={(event)=>setPressure(event.target.checked)}/><i/></label><label className="intel-switch"><span>Trade corridors<small>Schematic reference routes</small></span><input type="checkbox" checked={routes} onChange={(event)=>setRoutes(event.target.checked)}/><i/></label></section>
        <section><div className="intel-section-label"><span>BASEMAP</span></div><div className="intel-basemaps">{(["dark","light","terrain"] as Basemap[]).map((name)=><button key={name} className={basemap===name?"active":""} onClick={()=>setBasemap(name)}><i/><span>{name}</span></button>)}</div></section>
        <section><div className="intel-section-label"><span>REGION JUMP</span></div><div className="intel-region-grid">{regions.map((region)=><button key={region.label} onClick={()=>setFocus({...region,key:Date.now()})}>{region.label}</button>)}</div></section>
        <footer><span>{sourceLine}</span><small>Each signal retains its original source and timestamp. Infrastructure and routes are clearly marked as reference layers.</small></footer>
      </aside>

      <section className="intel-map-stage">
        <MapContainer center={[18,8]} zoom={2} minZoom={2} maxZoom={9} zoomControl={false} scrollWheelZoom worldCopyJump className="intel-leaflet-map">
          <TileLayer key={basemap} url={basemaps[basemap].url} attribution={basemaps[basemap].attribution}/>
          <ZoomControl position="topright"/>
          <ZoomWatch onZoom={setZoom}/><MapMotion focus={focus}/>
          {routes&&activeLayers.has("Infrastructure")&&tradeRoutes.map((route)=><Polyline key={route.name} positions={route.points} pathOptions={{color:"#51b9d6",weight:1.4,opacity:.52,dashArray:"7 9"}}><Tooltip sticky>{route.name} · schematic reference corridor</Tooltip></Polyline>)}
          {pressure&&clusters.filter((cluster)=>cluster.points.some((point)=>point.layer==="Headlines")).map((cluster)=><CircleMarker key={`pressure-${cluster.key}`} center={[cluster.lat,cluster.lng]} radius={Math.min(46,18+cluster.points.length*2.5)} interactive={false} pathOptions={{stroke:false,fillColor:colors[cluster.severity],fillOpacity:.11}}/>)}
          {clusters.map((cluster)=>{
            const count=cluster.points.length;
            const primary=cluster.points[0];
            const inspect=()=>{
              if(count===1){choosePoint(primary);return;}
              setSelected(null);
              setSelectedCluster([...cluster.points].sort((a,b)=>severityRank[b.severity]-severityRank[a.severity]));
              setMobilePanel("feed");
            };
            return <CircleMarker
              key={cluster.key}
              center={[cluster.lat,cluster.lng]}
              radius={count===1?(primary.layer==="Infrastructure"?7:8):Math.min(24,10+Math.log2(count)*3)}
              eventHandlers={{click:inspect}}
              className={`intel-map-marker ${cluster.severity} ${count>1?"cluster":""}`}
              pathOptions={{color:count>1?"#eaf4fa":"#07131c",weight:count>1?2.5:2,fillColor:colors[cluster.severity],fillOpacity:.96}}
            >
              <Tooltip direction="top" offset={[0,-8]} opacity={1}>
                {count>1?<><strong>{count} signals</strong><span>Click to inspect cluster</span></>:<><strong>{primary.title}</strong><span>{primary.layer} · {primary.source}</span></>}
              </Tooltip>
            </CircleMarker>;
          })}
        </MapContainer>

        <div className="intel-map-stats"><article><span>VISIBLE SIGNALS</span><strong>{filtered.length}</strong></article><article><span>URGENT</span><strong>{urgent}</strong></article><article><span>LOCATIONS</span><strong>{locations}</strong></article><article><span>SOURCES</span><strong>{new Set(filtered.map((point)=>point.source)).size}</strong></article></div>
        <div className="intel-map-actions"><button onClick={()=>setMobilePanel("layers")}><span>☷</span> Layers</button><button onClick={()=>setMobilePanel("feed")}><span>▤</span> Signals</button><button onClick={()=>setFocusMode((value)=>!value)}><span>{focusMode?"⊟":"⊞"}</span> {focusMode?"Exit focus":"Focus map"}</button></div>
        <div className="intel-legend"><span><i className="critical"/>Critical</span><span><i className="elevated"/>Elevated</span><span><i className="watch"/>Watch</span><span><i className="stable"/>Stable</span></div>
        {!filtered.length&&<div className="intel-empty"><strong>No signals match this operating picture</strong><span>Enable another layer, expand the time window or clear search.</span><button onClick={()=>{setQuery("");setActiveLayers(new Set(layerOrder));setTimeWindow(168);}}>Reset view</button></div>}
        <div className="intel-timeline"><div><span>RECENT SIGNALS</span><small>{timeWindow===168?"7 days":`${timeWindow} hours`} · newest first</small></div><section>{timeline.map((point)=><button key={point.id} onClick={()=>choosePoint(point)}><i className={point.severity}/><time>{relativeTime(point.occurredAt)}</time><span>{point.title}</span></button>)}</section></div>
      </section>

      <aside className={`intel-feed ${mobilePanel==="feed"?"mobile-open":""}`}>
        <div className="intel-panel-head"><div><span>{selectedCluster?"CLUSTER INSPECTOR":selected?"SIGNAL INSPECTOR":"PRIORITY QUEUE"}</span><strong>{selectedCluster?`${selectedCluster.length} related signals`:selected?selected.layer:"Live signal feed"}</strong></div><button onClick={()=>{setMobilePanel(null);setSelected(null);setSelectedCluster(null);}} aria-label="Close signal panel">×</button></div>
        {selected&&<article className="intel-detail">
          <div className="intel-detail-meta"><span className={selected.severity}>{selected.severity}</span><time>{relativeTime(selected.occurredAt)} ago</time></div>
          <p>{selected.layer}{selected.category?` · ${selected.category}`:""}</p><h2>{selected.title}</h2>
          <div className="intel-location"><span>◎</span><strong>{selected.location??`${selected.lat.toFixed(2)}, ${selected.lng.toFixed(2)}`}</strong><small>{selected.reference?"Reference location":"Mapped event location"}</small></div>
          <p className="intel-summary">{selected.summary}</p>
          <div className="intel-source-card"><span>SOURCE</span><strong>{selected.source}</strong><small>{selected.reference?"Reference layer · not a live status report":`Published ${new Date(selected.occurredAt).toLocaleString()}`}</small></div>
          <div className="intel-detail-actions">{selected.sourceUrl&&<a href={selected.sourceUrl} target="_blank" rel="noreferrer">Open source ↗</a>}<button onClick={()=>toggleSaved(selected.id)}>{saved.includes(selected.id)?"◆ Saved":"◇ Save"}</button><button onClick={()=>void share(selected)}>{copied?"Copied":"Share"}</button></div>
        </article>}
        {!selected&&<div className="intel-feed-list">{selectedCluster&&<button className="intel-back" onClick={()=>setSelectedCluster(null)}>← Back to priority queue</button>}{shown.map((point,index)=><button key={point.id} onClick={()=>choosePoint(point)}><div><span className={point.severity}>{point.layer}</span><time>{relativeTime(point.occurredAt)}</time></div><strong>{point.title}</strong><small>{point.location??point.source}</small><em>{String(index+1).padStart(2,"0")}</em></button>)}</div>}
        {!selected&&shown.length===0&&<div className="intel-feed-empty">No visible signals</div>}
      </aside>
    </div>
  </main>;
}
