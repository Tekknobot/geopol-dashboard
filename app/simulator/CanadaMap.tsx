"use client";
import {CircleMarker,MapContainer,TileLayer,Tooltip,ZoomControl} from "react-leaflet";
import "leaflet/dist/leaflet.css";

type Severity="critical"|"elevated"|"watch"|"stable";
type LiveEvent={id:string;title:string;summary:string;lat:number;lng:number;severity:Severity;source:string;sourceUrl:string;category:string;occurredAt:string;location?:string};
type Province={id:string;name:string;abbr:string;lat:number;lng:number;population:number;housing:number;grid:number;health:number;climate:number;transit:number;productivity:number};
type Scenario={homes:number;cleanPower:number;transit:number;health:number;adaptation:number;productivity:number};
const colours={critical:"#ff3f55",elevated:"#ff8f3f",watch:"#e8c55b",stable:"#60b9e9"};
const clamp=(n:number)=>Math.max(0,Math.min(100,n));
const score=(p:Province,s:Scenario)=>({resilience:(clamp(p.housing+s.homes*.55+s.transit*.08)+clamp(p.grid+s.cleanPower*.42+s.adaptation*.08)+clamp(p.health+s.health*.46+s.homes*.04)+clamp(p.climate+s.adaptation*.5+s.cleanPower*.13)+clamp(p.transit+s.transit*.5+s.homes*.05)+clamp(p.productivity+s.productivity*.38+s.transit*.08+s.cleanPower*.04))/6,housing:clamp(p.housing+s.homes*.55+s.transit*.08),grid:clamp(p.grid+s.cleanPower*.42+s.adaptation*.08)});
export default function CanadaMap({provinces,events,scenario,selected,onSelect,layer}:{provinces:Province[];events:LiveEvent[];scenario:Scenario;selected:string;onSelect:(id:string)=>void;layer:"situation"|"resilience"|"housing"|"grid"}){
 return <MapContainer center={[58,-96]} zoom={3} minZoom={2} maxZoom={8} zoomControl={false} scrollWheelZoom className="sim-leaflet"><TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution='&copy; OpenStreetMap &copy; CARTO'/><ZoomControl position="topright"/>
 {provinces.map(p=>{const s=score(p,scenario);const value=layer==="housing"?s.housing:layer==="grid"?s.grid:s.resilience;return <CircleMarker key={p.id} center={[p.lat,p.lng]} radius={selected===p.id?12:8} pathOptions={{color:selected===p.id?"#fff":"#7b8ca1",weight:selected===p.id?2:1,fillColor:value>=80?"#5cae91":value>=65?"#6f91b7":value>=50?"#c6a45b":"#b76565",fillOpacity:.82}} eventHandlers={{click:()=>onSelect(p.id)}}><Tooltip direction="top"><strong>{p.name}</strong><br/>{layer==="housing"?"Housing":layer==="grid"?"Grid":"Resilience"}: {Math.round(value)}</Tooltip></CircleMarker>})}
 {layer==="situation"&&events.map(e=><CircleMarker key={e.id} center={[e.lat,e.lng]} radius={e.severity==="critical"?8:e.severity==="elevated"?7:5} pathOptions={{color:colours[e.severity],weight:1.5,fillColor:colours[e.severity],fillOpacity:.72}}><Tooltip direction="top"><strong>{e.title}</strong><br/>{e.category} · {e.source}</Tooltip></CircleMarker>)}
 </MapContainer>
}
