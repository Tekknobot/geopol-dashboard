"use client";

import dynamic from "next/dynamic";
import {useCallback,useEffect,useMemo,useState} from "react";
import type {IntelPoint,IntelSeverity} from "../components/IntelligenceMap";

const IntelligenceMap=dynamic(()=>import("../components/IntelligenceMap"),{ssr:false,loading:()=><div className="intel-page-loading"><span/><strong>Building global operating picture</strong><small>Connecting attributed public sources…</small></div>});

type Story={id:number;desk:"world"|"entertainment"|"sports";category:string;region:string;publishedAt:string;level:IntelSeverity;title:string;summary:string;source:string;articleUrl:string;location?:{name:string;lat:number;lng:number;precision:"country"|"hotspot"}};
type NewsResponse={stories:Story[];sources:string[];fetchedAt:string;failedFeeds:number;totalFeeds:number};
type NaturalEvent={id:string;layer:Exclude<IntelPoint["layer"],"Headlines"|"Infrastructure">;title:string;summary:string;lat:number;lng:number;occurredAt:string;severity:IntelSeverity;source:string;sourceUrl:string};
type IntelligenceResponse={fetchedAt:string;status:"live"|"partial"|"unavailable";events:NaturalEvent[];sources:Array<{id:string;label:string;url:string;status:"live"|"unavailable"}>};

const infrastructure:IntelPoint[]=[
  {id:"infra-suez",layer:"Infrastructure",title:"Suez Canal",summary:"Strategic connection between the Mediterranean and Red Sea used by Europe–Asia trade routes.",lat:30.1,lng:32.57,occurredAt:"2026-01-01T00:00:00Z",severity:"watch",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"Egypt",reference:true},
  {id:"infra-hormuz",layer:"Infrastructure",title:"Strait of Hormuz",summary:"Strategic energy-shipping passage connecting the Persian Gulf with the Gulf of Oman.",lat:26.56,lng:56.25,occurredAt:"2026-01-01T00:00:00Z",severity:"watch",source:"ATLAS strategic reference layer",sourceUrl:"https://www.eia.gov/international/analysis/special-topics/World_Oil_Transit_Chokepoints",location:"Persian Gulf",reference:true},
  {id:"infra-bab",layer:"Infrastructure",title:"Bab el-Mandeb",summary:"Narrow maritime passage linking the Red Sea with the Gulf of Aden and Indian Ocean.",lat:12.59,lng:43.34,occurredAt:"2026-01-01T00:00:00Z",severity:"watch",source:"ATLAS strategic reference layer",sourceUrl:"https://www.eia.gov/international/analysis/special-topics/World_Oil_Transit_Chokepoints",location:"Red Sea",reference:true},
  {id:"infra-malacca",layer:"Infrastructure",title:"Strait of Malacca",summary:"One of the principal maritime corridors connecting the Indian and Pacific Oceans.",lat:2.5,lng:101.3,occurredAt:"2026-01-01T00:00:00Z",severity:"watch",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"Southeast Asia",reference:true},
  {id:"infra-panama",layer:"Infrastructure",title:"Panama Canal",summary:"Strategic canal connecting Atlantic and Pacific maritime networks.",lat:9.08,lng:-79.68,occurredAt:"2026-01-01T00:00:00Z",severity:"watch",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"Panama",reference:true},
  {id:"infra-gibraltar",layer:"Infrastructure",title:"Strait of Gibraltar",summary:"Maritime gateway between the Atlantic Ocean and Mediterranean Sea.",lat:35.98,lng:-5.55,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"Western Mediterranean",reference:true},
  {id:"infra-bosphorus",layer:"Infrastructure",title:"Turkish Straits",summary:"Bosporus and Dardanelles passage connecting the Black Sea with Mediterranean routes.",lat:41.12,lng:29.05,occurredAt:"2026-01-01T00:00:00Z",severity:"watch",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"Türkiye",reference:true},
  {id:"infra-dover",layer:"Infrastructure",title:"Strait of Dover",summary:"High-density shipping passage connecting the North Sea and English Channel.",lat:51.0,lng:1.5,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"Northwest Europe",reference:true},
  {id:"infra-cape",layer:"Infrastructure",title:"Cape of Good Hope",summary:"Alternative long-distance route around southern Africa when canal passages are disrupted.",lat:-34.36,lng:18.47,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"South Africa",reference:true},
  {id:"infra-singapore",layer:"Infrastructure",title:"Port of Singapore",summary:"Major global transshipment and maritime services hub at the junction of Asian routes.",lat:1.27,lng:103.82,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"Singapore",reference:true},
  {id:"infra-rotterdam",layer:"Infrastructure",title:"Port of Rotterdam",summary:"Major European port and gateway for energy, containers and inland distribution.",lat:51.94,lng:4.14,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"Netherlands",reference:true},
  {id:"infra-la",layer:"Infrastructure",title:"San Pedro Bay ports",summary:"Large Pacific gateway complex connecting trans-Pacific shipping with North American distribution.",lat:33.73,lng:-118.25,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"United States",reference:true},
];

export default function IntelligencePage(){
  const [stories,setStories]=useState<Story[]>([]);
  const [natural,setNatural]=useState<NaturalEvent[]>([]);
  const [newsSources,setNewsSources]=useState<string[]>([]);
  const [naturalSources,setNaturalSources]=useState<IntelligenceResponse["sources"]>([]);
  const [newsState,setNewsState]=useState<"loading"|"live"|"partial"|"unavailable">("loading");
  const [naturalState,setNaturalState]=useState<"loading"|"live"|"partial"|"unavailable">("loading");
  const [fetchedAt,setFetchedAt]=useState<string|null>(null);

  const load=useCallback(async()=>{
    setNewsState("loading");setNaturalState("loading");
    const [newsResult,intelResult]=await Promise.allSettled([
      fetch("/api/news",{cache:"no-store",signal:AbortSignal.timeout(10000)}).then(async(response)=>{if(!response.ok)throw new Error("news");return response.json() as Promise<NewsResponse>;}),
      fetch("/api/intelligence",{cache:"no-store",signal:AbortSignal.timeout(10000)}).then(async(response)=>{if(!response.ok)throw new Error("intelligence");return response.json() as Promise<IntelligenceResponse>;}),
    ]);
    if(newsResult.status==="fulfilled"){setStories(newsResult.value.stories);setNewsSources(newsResult.value.sources);setNewsState(newsResult.value.failedFeeds?"partial":"live");setFetchedAt(newsResult.value.fetchedAt);}else setNewsState("unavailable");
    if(intelResult.status==="fulfilled"){setNatural(intelResult.value.events);setNaturalSources(intelResult.value.sources);setNaturalState(intelResult.value.status);setFetchedAt((current)=>current??intelResult.value.fetchedAt);}else setNaturalState("unavailable");
  },[]);
  useEffect(()=>{void load();const timer=setInterval(()=>void load(),5*60*1000);return()=>clearInterval(timer);},[load]);

  const points=useMemo<IntelPoint[]>(()=>[
    ...stories.filter((story)=>story.desk==="world"&&story.location).map((story)=>({id:`news-${story.id}`,layer:"Headlines" as const,title:story.title,summary:story.summary,lat:story.location!.lat,lng:story.location!.lng,occurredAt:story.publishedAt,severity:story.level,source:story.source,sourceUrl:story.articleUrl,location:story.location!.name,category:story.category})),
    ...natural,
    ...infrastructure,
  ],[natural,stories]);
  const status=newsState==="loading"||naturalState==="loading"?"loading":newsState==="live"&&naturalState==="live"?"live":newsState!=="unavailable"||naturalState!=="unavailable"?"partial":"unavailable";
  const liveNaturalSources=naturalSources.filter((source)=>source.status==="live").map((source)=>source.label);
  const sourceLine=[newsSources.length?`${newsSources.length} news publishers`:"News feeds unavailable",...liveNaturalSources,"ATLAS reference layer"].join(" · ");
  return <IntelligenceMap points={points} status={status} fetchedAt={fetchedAt} sourceLine={sourceLine}/>;
}
