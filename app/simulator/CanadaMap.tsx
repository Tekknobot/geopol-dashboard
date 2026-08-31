"use client";
import {CircleMarker,MapContainer,TileLayer,Tooltip,ZoomControl,useMap} from "react-leaflet";
import {useEffect,useMemo,useRef,useState} from "react";
import "leaflet/dist/leaflet.css";
import {referencePins,type ReferenceKind} from "./canada-reference-pins";
import {metros} from "./city-data";

type Severity="critical"|"elevated"|"watch"|"stable";
type LiveEvent={id:string;title:string;summary:string;lat:number;lng:number;severity:Severity;source:string;sourceUrl:string;category:string;occurredAt:string;location?:string};
type Province={id:string;name:string;abbr:string;lat:number;lng:number;population:number;housing:number;grid:number;health:number;climate:number;transit:number;productivity:number};
type Scenario={homes:number;cleanPower:number;transit:number;health:number;adaptation:number;productivity:number};
const colours={critical:"#ff4b62",elevated:"#ff9d4a",watch:"#e7c65a",stable:"#63b9e6"};
const refColours:Record<ReferenceKind,string>={capital:"#f2f5f7",city:"#92a6b7",airport:"#6fb7de",port:"#58b8a3",energy:"#d7b35c",crossing:"#d77b69",corridor:"#a88bd5"};
const labels:Record<ReferenceKind,string>={capital:"Capitals",city:"Population centres",airport:"Airports",port:"Ports",energy:"Energy",crossing:"Border",corridor:"Corridors"};
const clamp=(n:number)=>Math.max(0,Math.min(100,n));
const score=(p:Province,s:Scenario)=>({resilience:(clamp(p.housing+s.homes*.55+s.transit*.08)+clamp(p.grid+s.cleanPower*.42+s.adaptation*.08)+clamp(p.health+s.health*.46+s.homes*.04)+clamp(p.climate+s.adaptation*.5+s.cleanPower*.13)+clamp(p.transit+s.transit*.5+s.homes*.05)+clamp(p.productivity+s.productivity*.38+s.transit*.08+s.cleanPower*.04))/6,housing:clamp(p.housing+s.homes*.55+s.transit*.08),grid:clamp(p.grid+s.cleanPower*.42+s.adaptation*.08)});
function MapFocus({cityId}:{cityId:string}) {
  const map = useMap();
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    const c = metros.find(x => x.id === cityId);

    if (c) {
      map.flyTo([c.lat, c.lng], 7, {
        duration: 0.7
      });
    }
  }, [cityId, map]);

  return null;
}
export default function CanadaMap({provinces,events,scenario,selected,onSelect,layer,selectedCity,onCitySelect}:{provinces:Province[];events:LiveEvent[];scenario:Scenario;selected:string;onSelect:(id:string)=>void;layer:"situation"|"resilience"|"housing"|"grid";selectedCity:string;onCitySelect:(id:string)=>void}){
 const [liveOn,setLiveOn]=useState(true),[referenceOn,setReferenceOn]=useState(true),[metroOn,setMetroOn]=useState(true);
 const [activeKinds,setActiveKinds]=useState<ReferenceKind[]>(["capital","airport","port","energy","crossing","corridor"]);
 const visibleReferences=useMemo(()=>referenceOn?referencePins.filter(p=>activeKinds.includes(p.kind)):[],[referenceOn,activeKinds]);
 const toggle=(kind:ReferenceKind)=>setActiveKinds(k=>k.includes(kind)?k.filter(x=>x!==kind):[...k,kind]);
 const total=(liveOn&&layer==="situation"?events.length:0)+visibleReferences.length+provinces.length+(metroOn?metros.length:0);
 return <div className="sim-map-shell">
   <div className="sim-map-tools" aria-label="Map layers">
     <div className="map-tool-row"><button type="button" className={liveOn?"on":""} onClick={()=>setLiveOn(v=>!v)}><i className="tool-dot live"/>Live signals <b>{events.length}</b></button><button type="button" className={metroOn?"on":""} onClick={()=>setMetroOn(v=>!v)}>Major metros <b>{metros.length}</b></button><button type="button" className={referenceOn?"on":""} onClick={()=>setReferenceOn(v=>!v)}>Reference network <b>{referencePins.length}</b></button></div>
     <div className="map-kind-row">{(Object.keys(labels) as ReferenceKind[]).filter(k=>k!=="city").map(kind=><button type="button" key={kind} disabled={!referenceOn} className={activeKinds.includes(kind)?"on":""} onClick={()=>toggle(kind)}><i style={{background:refColours[kind]}}/>{labels[kind]}</button>)}</div>
   </div>
   <div className="sim-map-count"><b>{total}</b><span>visible map objects</span></div>
   <MapContainer center={[56.1304, -106.3468]} zoom={4} minZoom={2} maxZoom={11} zoomControl={false} scrollWheelZoom className="sim-leaflet"><TileLayer className="sim-dark-tiles" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'/><ZoomControl position="topright"/><MapFocus cityId={selectedCity}/>
   {provinces.map(p=>{const s=score(p,scenario),value=layer==="housing"?s.housing:layer==="grid"?s.grid:s.resilience;return <CircleMarker key={p.id} center={[p.lat,p.lng]} radius={selected===p.id?12:8} pathOptions={{color:selected===p.id?"#fff":"#8093a4",weight:selected===p.id?2:1,fillColor:value>=80?"#5cae91":value>=65?"#718fac":value>=50?"#c0a256":"#b96969",fillOpacity:.82}} eventHandlers={{click:()=>onSelect(p.id)}}><Tooltip direction="top" className="sim-tooltip"><strong>{p.name}</strong><br/>{layer==="housing"?"Housing capacity":layer==="grid"?"Grid readiness":"Composite resilience"}: {Math.round(value)}<br/><small>Click to focus provincial analysis</small></Tooltip></CircleMarker>})}
   {metroOn&&metros.map(c=><CircleMarker key={`metro-${c.id}`} center={[c.lat,c.lng]} radius={selectedCity===c.id?7.5:5.2} pathOptions={{color:selectedCity===c.id?"#ffffff":"#78d6ff",weight:selectedCity===c.id?2.2:1.4,fillColor:"#0f7fa4",fillOpacity:.9}} eventHandlers={{click:()=>{onCitySelect(c.id);onSelect(c.province)}}}><Tooltip direction="top" className="sim-tooltip"><strong>{c.name}</strong><br/><span>Major metro · {c.provinceName}</span><br/><small>Click for local intelligence</small></Tooltip></CircleMarker>)}
   {visibleReferences.map(p=><CircleMarker key={p.id} center={[p.lat,p.lng]} radius={p.kind==="capital"?4.7:3.9} pathOptions={{color:refColours[p.kind],weight:1,fillColor:refColours[p.kind],fillOpacity:.72}}><Tooltip direction="top" className="sim-tooltip"><strong>{p.name}</strong><br/><span>{labels[p.kind]} · {p.province}</span><br/><small>{p.detail}</small></Tooltip></CircleMarker>)}
   {liveOn&&layer==="situation"&&events.map(e=><CircleMarker key={e.id} center={[e.lat,e.lng]} radius={e.severity==="critical"?8:e.severity==="elevated"?7:5.5} pathOptions={{color:colours[e.severity],weight:1.7,fillColor:colours[e.severity],fillOpacity:.78}}><Tooltip direction="top" className="sim-tooltip"><strong>{e.title}</strong><br/><span>{e.category} · {e.location??e.source}</span><br/><small>{e.source}</small></Tooltip></CircleMarker>)}
   </MapContainer>
 </div>;
}
