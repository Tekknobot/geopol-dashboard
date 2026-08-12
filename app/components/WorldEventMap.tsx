"use client";

import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

export type MapMode = "Events" | "Risk" | "Trade";
type MapPoint = { name:string; position:[number,number]; tone:"critical"|"elevated"|"watch"; detail:string; region:string; category:string; tags:string[] };

const events:MapPoint[]=[
  {name:"Strait of Hormuz",position:[26.5,56.3],tone:"critical",detail:"Shipping access and energy security",region:"Middle East",category:"Energy",tags:["oil","shipping","gulf"]},
  {name:"Black Sea",position:[43.3,34],tone:"critical",detail:"Port and grain corridor security",region:"Europe",category:"Security",tags:["ukraine","ports","grain"]},
  {name:"Taiwan Strait",position:[24.2,120.2],tone:"elevated",detail:"Cross-strait cyber and security activity",region:"Asia Pacific",category:"Technology",tags:["taiwan","cyber","chips"]},
  {name:"Panama Canal",position:[9.1,-79.7],tone:"watch",detail:"Transit capacity and water levels",region:"Americas",category:"Trade",tags:["panama","shipping"]},
  {name:"Central Sahel",position:[15.2,2.4],tone:"elevated",detail:"Border security and humanitarian pressure",region:"Africa",category:"Diplomacy",tags:["sahel","borders"]},
  {name:"Red Sea",position:[18.4,39.3],tone:"critical",detail:"Merchant routes and patrol activity",region:"Middle East",category:"Security",tags:["red sea","suez"]},
  {name:"Strait of Malacca",position:[3.2,101.2],tone:"watch",detail:"Container flows and peak-season demand",region:"Asia Pacific",category:"Trade",tags:["malacca","containers"]},
  {name:"Horn of Africa",position:[8.7,46.2],tone:"elevated",detail:"Drought and food-system pressure",region:"Africa",category:"Climate",tags:["drought","food"]},
  {name:"Caribbean",position:[18.2,-74.1],tone:"elevated",detail:"Maritime security coordination",region:"Americas",category:"Security",tags:["caribbean","ports"]},
  {name:"South China Sea",position:[13,114],tone:"watch",detail:"Regional maritime consultations",region:"Asia Pacific",category:"Diplomacy",tags:["asean","maritime"]},
  {name:"Amazon Basin",position:[-4.4,-62.8],tone:"watch",detail:"Satellite monitoring cooperation",region:"Americas",category:"Climate",tags:["amazon","forest"]},
  {name:"Eastern Africa Grid",position:[-2.2,35.4],tone:"watch",detail:"New cross-border power capacity",region:"Africa",category:"Energy",tags:["electricity","grid"]},
  {name:"European Grid",position:[50.2,10.2],tone:"watch",detail:"Joint resilience framework",region:"Europe",category:"Energy",tags:["eu","grid"]},
  {name:"North Atlantic",position:[48,-32],tone:"watch",detail:"Cable and maritime infrastructure monitoring",region:"Europe",category:"Technology",tags:["cables","cyber"]},
  {name:"Central Pacific",position:[-12,-170],tone:"elevated",detail:"Resilience finance and climate exposure",region:"Asia Pacific",category:"Climate",tags:["pacific","finance"]},
  {name:"Gulf Logistics Arc",position:[24.5,51.2],tone:"watch",detail:"New overland cargo capacity",region:"Middle East",category:"Trade",tags:["gulf","logistics"]},
];

const layers:Record<MapMode,MapPoint[]>={
  Events:events,
  Risk:[events[0],events[1],events[2],events[4],events[5],events[7],events[8],events[9],events[10],events[14]],
  Trade:[events[0],events[1],events[3],events[5],events[6],events[9],events[15],{name:"Suez Canal",position:[30.5,32.3],tone:"critical",detail:"Europe–Asia shipping corridor",region:"Middle East",category:"Trade",tags:["suez","shipping"]},{name:"Bosporus",position:[41.1,29],tone:"watch",detail:"Black Sea access corridor",region:"Europe",category:"Trade",tags:["bosporus","shipping"]},{name:"Cape of Good Hope",position:[-34.4,18.5],tone:"elevated",detail:"Long-route shipping diversion",region:"Africa",category:"Trade",tags:["cape","shipping"]}],
};
const colors={critical:"#d92b36",elevated:"#e66b35",watch:"#dfa927"};

export default function WorldEventMap({mode,filter=""}:{mode:MapMode;filter?:string}){
  const terms=filter.toLowerCase().split(/\s+/).filter(Boolean);
  const points=layers[mode].filter((point)=>{if(!terms.length)return true;const haystack=[point.name,point.detail,point.region,point.category,...point.tags].join(" ").toLowerCase();return terms.every((term)=>haystack.includes(term));});
  return <div className="leaflet-map-shell">
    <MapContainer center={[22,12]} zoom={2} minZoom={2} maxZoom={7} scrollWheelZoom worldCopyJump className="leaflet-world-map"><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>{points.map((point)=><CircleMarker key={point.name} center={point.position} radius={9} pathOptions={{color:"#fff",weight:3,fillColor:colors[point.tone],fillOpacity:.95}}><Popup><strong>{point.name}</strong><span>{point.detail}</span><small>{point.region} · {point.category}</small></Popup></CircleMarker>)}</MapContainer>
    <div className="map-count">{points.length} of {layers[mode].length} pins shown</div><div className="map-legend" aria-label="Map risk legend"><span><i className="red"/> Critical</span><span><i className="orange"/> Elevated</span><span><i className="amber"/> Watch</span></div>{!points.length&&<div className="map-empty"><strong>No pins match these filters</strong><span>Clear search or choose All topics.</span></div>}
  </div>;
}
