"use client";

import { useMemo, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMapEvents } from "react-leaflet";

export type MapMode = "Events" | "Risk" | "Trade";
export type MapStory = {
  id:number;
  category:string;
  region:string;
  level:"critical"|"elevated"|"watch"|"stable";
  title:string;
  summary:string;
  source:string;
  publishedAt:string;
  articleUrl:string;
  tags:string[];
  location?:{name:string;lat:number;lng:number;precision:"country"|"hotspot"};
};

type MappedStory = MapStory & {location:NonNullable<MapStory["location"]>};
type StoryCluster = {key:string;position:[number,number];stories:MappedStory[];tone:MapStory["level"]};

const colors:Record<MapStory["level"],string>={critical:"#d92b36",elevated:"#e66b35",watch:"#dfa927",stable:"#4b9a78"};
const toneFor=(stories:MappedStory[]):MapStory["level"]=>stories.some((story)=>story.level==="critical")?"critical":stories.some((story)=>story.level==="elevated")?"elevated":stories.some((story)=>story.level==="watch")?"watch":"stable";
const tradeCategories=new Set(["Trade","Energy","Supply Chains","Maritime","Transport","Critical Minerals"]);
const isTradeStory=(story:MappedStory)=>tradeCategories.has(story.category)||/trade|tariff|shipping|freight|port|canal|oil|gas|pipeline/i.test([story.title,...story.tags].join(" "));

function ZoomObserver({onZoom}:{onZoom:(zoom:number)=>void}){
  useMapEvents({zoomend:(event)=>onZoom(event.target.getZoom())});
  return null;
}

function jitteredClusters(points:MappedStory[]):StoryCluster[]{
  const groups=new Map<string,MappedStory[]>();
  points.forEach((story)=>{
    const key=`${story.location.lat.toFixed(3)}:${story.location.lng.toFixed(3)}`;
    groups.set(key,[...(groups.get(key)??[]),story]);
  });
  return [...groups.entries()].flatMap(([locationKey,stories])=>stories.map((story,index)=>{
    if(stories.length===1)return {key:String(story.id),position:[story.location.lat,story.location.lng],stories:[story],tone:story.level};
    const angle=(index/stories.length)*Math.PI*2;
    const radius=Math.min(story.location.precision==="country"?.7:.28,.12+stories.length*.025);
    const latitudeOffset=Math.sin(angle)*radius;
    const longitudeScale=Math.max(.35,Math.cos(story.location.lat*Math.PI/180));
    const longitudeOffset=Math.cos(angle)*radius/longitudeScale;
    return {key:`${locationKey}:${story.id}`,position:[story.location.lat+latitudeOffset,story.location.lng+longitudeOffset],stories:[story],tone:story.level};
  }));
}

function clusterStories(points:MappedStory[],zoom:number):StoryCluster[]{
  const cellSize=zoom<=2?18:zoom===3?10:zoom===4?5:zoom===5?2.5:0;
  if(!cellSize)return jitteredClusters(points);
  const cells=new Map<string,MappedStory[]>();
  points.forEach((story)=>{
    const key=`${Math.floor((story.location.lat+90)/cellSize)}:${Math.floor((story.location.lng+180)/cellSize)}`;
    cells.set(key,[...(cells.get(key)??[]),story]);
  });
  return [...cells.entries()].map(([key,stories])=>({
    key,
    position:[stories.reduce((total,story)=>total+story.location.lat,0)/stories.length,stories.reduce((total,story)=>total+story.location.lng,0)/stories.length],
    stories,
    tone:toneFor(stories),
  }));
}

export default function WorldEventMap({mode,stories,filter=""}:{mode:MapMode;stories:MapStory[];filter?:string}){
  const [zoom,setZoom]=useState(2);
  const mappedStories=useMemo(()=>stories.filter((story):story is MappedStory=>Boolean(story.location)),[stories]);
  const modeStories=useMemo(()=>mappedStories.filter((story)=>mode==="Events"||(mode==="Risk"?(story.level==="critical"||story.level==="elevated"):isTradeStory(story))),[mappedStories,mode]);
  const points=useMemo(()=>{
    const terms=filter.toLowerCase().split(/\s+/).filter(Boolean);
    return modeStories.filter((story)=>{
      if(!terms.length)return true;
      const haystack=[story.location.name,story.title,story.summary,story.region,story.category,story.source,...story.tags].join(" ").toLowerCase();
      return terms.every((term)=>haystack.includes(term));
    });
  },[filter,modeStories]);
  const clusters=useMemo(()=>clusterStories(points,zoom),[points,zoom]);

  return <div className="leaflet-map-shell">
    <MapContainer center={[22,12]} zoom={2} minZoom={2} maxZoom={7} scrollWheelZoom worldCopyJump className="leaflet-world-map">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
      <ZoomObserver onZoom={setZoom}/>
      {clusters.map((cluster)=>{
        const count=cluster.stories.length;
        return <CircleMarker key={cluster.key} center={cluster.position} radius={count===1?8:Math.min(21,9+Math.log2(count)*3)} pathOptions={{color:"#fff",weight:3,fillColor:colors[cluster.tone],fillOpacity:.94}}>
          {count>1&&<Tooltip permanent direction="center" className="cluster-label" opacity={1}>{count}</Tooltip>}
          <Popup><div className="news-map-popup"><strong>{count===1?cluster.stories[0].location.name:`${count} headlines in this area`}</strong>{cluster.stories.slice(0,5).map((story)=><a key={story.id} href={story.articleUrl} target="_blank" rel="noreferrer"><span>{story.title}</span><small>{story.source} · {story.location.name} ↗</small></a>)}{count>5&&<em>Zoom in to separate {count-5} more headlines.</em>}{count===1&&<em>{cluster.stories[0].location.precision==="country"?"Placed at the country’s geographic centre.":"Placed at the named location."}</em>}</div></Popup>
        </CircleMarker>;
      })}
    </MapContainer>
    <div className="map-count"><strong>{points.length}</strong> headline pin{points.length===1?"":"s"}<span>{clusters.length} visible marker{clusters.length===1?"":"s"} · zoom to separate</span></div>
    <div className="map-coverage">{mappedStories.length} of {stories.length} live headlines mapped</div>
    <div className="map-legend" aria-label="Map risk legend"><span><i className="red"/> Critical</span><span><i className="orange"/> Elevated</span><span><i className="amber"/> Watch</span><span><i className="green"/> Stable</span></div>
    {!points.length&&<div className="map-empty"><strong>No located headlines match these filters</strong><span>Clear search or choose All topics.</span></div>}
  </div>;
}
