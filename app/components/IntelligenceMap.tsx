"use client";

import {useEffect,useMemo,useState} from "react";
import {divIcon} from "leaflet";
import {CircleMarker,MapContainer,Marker,Polyline,TileLayer,Tooltip,useMap,useMapEvents,ZoomControl} from "react-leaflet";

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
  active?:boolean;
};

type Cluster={key:string;lat:number;lng:number;points:IntelPoint[];severity:IntelSeverity};
type Basemap="dark"|"light"|"terrain";
const layerOrder:IntelLayer[]=["Headlines","Earthquakes","Wildfires","Storms","Volcanoes","Floods","Other natural","Infrastructure"];
const layerIcons:Record<IntelLayer,string>={Headlines:"▤",Earthquakes:"≋",Wildfires:"♨",Storms:"◌",Volcanoes:"△",Floods:"≈","Other natural":"◇",Infrastructure:"⌘"};
const colors:Record<IntelSeverity,string>={critical:"#ff4d5b",elevated:"#ff8b4a",watch:"#f6ce52",stable:"#4dd4a8"};
const severityRank:Record<IntelSeverity,number>={critical:4,elevated:3,watch:2,stable:1};
const outlineSvg=(body:string)=>`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
const markerSymbols:Record<IntelLayer,string>={
  Headlines:outlineSvg('<path d="M5 4h14v16H5z"/><path d="M8 8h3v3H8zM14 8h3M14 11h3M8 15h9M8 18h6"/>'),
  Earthquakes:outlineSvg('<path d="M3 13h4l2-7 4 13 2-8 2 4h4"/>'),
  Wildfires:outlineSvg('<path d="M12 21c-4 0-7-2.7-7-6.4 0-2.5 1.5-4.4 3.8-6.8.2 2 1.3 3.1 2.2 3.8.2-3.4 1.8-5.8 4.1-8.1.2 3 1.3 4.8 2.4 6.3 1 1.4 1.5 2.9 1.5 4.8 0 3.7-3 6.4-7 6.4Z"/><path d="M12 21c-1.8 0-3.1-1.2-3.1-2.9 0-1.5.9-2.5 2.4-4.1.2 1.3.8 2 1.4 2.5.2-1.5.8-2.7 1.6-3.7.5 1.7.9 2.5.9 3.7 0 2.4-1.4 4.5-3.2 4.5Z"/>'),
  Storms:outlineSvg('<path d="M5 8.5c1.7-3 5.4-4.2 8.5-2.7 2.5 1.2 3.7 4.2 2.5 6.7-1 2-3.4 2.9-5.4 1.9-1.6-.8-2.3-2.7-1.5-4.3.6-1.2 2.1-1.7 3.3-1.1"/><path d="M3.5 15.5c2.3 3.4 6.8 4.7 10.6 3"/>'),
  Volcanoes:outlineSvg('<path d="m3 20 6.2-10 2.8 4 2.3-3.2L21 20Z"/><path d="M9.2 10 11 7.4 13 10l1.6-2.2"/><path d="M10 5.3c-.2-1.1.5-2.1 1.6-2.3M14 5.3c.4-1 .1-2-.7-2.7"/>'),
  Floods:outlineSvg('<path d="M3 8c2 0 2 1.5 4 1.5S9 8 11 8s2 1.5 4 1.5S17 8 19 8s2 1.5 2 1.5M3 13c2 0 2 1.5 4 1.5S9 13 11 13s2 1.5 4 1.5S17 13 19 13s2 1.5 2 1.5M3 18c2 0 2 1.5 4 1.5S9 18 11 18s2 1.5 4 1.5S17 18 19 18s2 1.5 2 1.5"/>'),
  "Other natural":outlineSvg('<path d="m12 3 9 9-9 9-9-9Z"/><path d="M12 7.5v5.5M12 16.5h.01"/>'),
  Infrastructure:outlineSvg('<path d="M4 20h16M6 20V9l6-5 6 5v11M9 20v-6h6v6"/>'),
};
const infrastructureSymbols={
  port:outlineSvg('<circle cx="12" cy="5" r="2"/><path d="M12 7v13M5 10h14M5 15c1.5 3.5 3.8 5 7 5s5.5-1.5 7-5M5 15H2.8M19 15h2.2"/>'),
  route:outlineSvg('<path d="M5 3v5c0 4 2 5 7 5s7 1 7 5v3M19 3v5c0 3-1.5 4.5-4.5 4.9M5 21v-3c0-2.7 1-4.1 3.2-4.7"/>'),
  energy:outlineSvg('<path d="m13.5 2-7 11h5L10.5 22l7-12h-5Z"/>'),
  digital:outlineSvg('<circle cx="5" cy="12" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="m7 11 10-4M7 13l10 4M19 8v8"/>'),
  aviation:outlineSvg('<path d="m3 14 7-3 2-8 2 1-1 7 6 3c1 .5 1.5 1.3 1.5 2L13 15l-1 5-1.5-.5-.5-5-7-1Z"/>'),
};
const clusterSymbol=outlineSvg('<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><path d="M16.5 13v7M13 16.5h7"/>');
function symbolFor(point:IntelPoint){
  if(point.layer!=="Infrastructure")return markerSymbols[point.layer];
  const category=(point.category??point.title).toLowerCase();
  if(/air|aviation/.test(category))return infrastructureSymbols.aviation;
  if(/digital|cable|network/.test(category))return infrastructureSymbols.digital;
  if(/energy|oil|gas|lng/.test(category))return infrastructureSymbols.energy;
  if(/chokepoint|corridor|strait|canal|passage/.test(category))return infrastructureSymbols.route;
  if(/port|terminal|maritime/.test(category))return infrastructureSymbols.port;
  return markerSymbols.Infrastructure;
}
function iconFor(cluster:Cluster){
  const count=cluster.points.length;
  const size=count>1?40:34;
  const symbol=count>1?clusterSymbol:symbolFor(cluster.points[0]);
  return divIcon({
    className:"intel-div-icon",
    html:`<span class="intel-symbol-marker ${cluster.severity} ${count>1?"cluster":""}">${symbol}${count>1?`<b>${count}</b>`:""}</span>`,
    iconSize:[size,size],
    iconAnchor:[size/2,size/2],
    tooltipAnchor:[0,-size/2+3],
  });
}
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
    return points.filter((point)=>activeLayers.has(point.layer)&&(point.reference||point.active||Date.parse(point.occurredAt)>=cutoff)&&(!needle||[point.title,point.summary,point.source,point.location,point.category,point.layer].join(" ").toLowerCase().includes(needle)));
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
            return <Marker
              key={cluster.key}
              position={[cluster.lat,cluster.lng]}
              icon={iconFor(cluster)}
              title={count>1?`${count} signals`:primary.title}
              eventHandlers={{click:inspect}}
            >
              <Tooltip direction="top" offset={[0,-5]} opacity={1}>
                {count>1?<><strong>{count} signals</strong><span>Click to inspect cluster</span></>:<><strong>{primary.title}</strong><span>{primary.category?`${primary.category} · `:""}{primary.layer} · {primary.source}</span></>}
              </Tooltip>
            </Marker>;
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
