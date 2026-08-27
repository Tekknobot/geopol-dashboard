"use client";

import dynamic from "next/dynamic";
import {useCallback,useEffect,useMemo,useState} from "react";
import type {IntelPoint,IntelSeverity} from "../components/IntelligenceMap";

const IntelligenceMap=dynamic(()=>import("../components/IntelligenceMap"),{ssr:false,loading:()=><div className="intel-page-loading"><span/><strong>Building global operating picture</strong><small>Connecting attributed public sources…</small></div>});

type Story={id:number;desk:"world"|"entertainment"|"sports";category:string;region:string;publishedAt:string;level:IntelSeverity;title:string;summary:string;source:string;articleUrl:string;location?:{name:string;lat:number;lng:number;precision:"country"|"hotspot"}};
type NewsResponse={stories:Story[];sources:string[];fetchedAt:string;failedFeeds:number;totalFeeds:number};
type NaturalEvent={id:string;layer:Exclude<IntelPoint["layer"],"Headlines"|"Infrastructure"|"Airports"|"Ports">;title:string;summary:string;lat:number;lng:number;occurredAt:string;severity:IntelSeverity;source:string;sourceUrl:string;location?:string;category?:string;active?:boolean};
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
  {id:"infra-kiel",layer:"Infrastructure",title:"Kiel Canal",summary:"Artificial waterway linking the North Sea and Baltic Sea while bypassing the Danish peninsula.",lat:54.33,lng:9.95,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"Germany",category:"Maritime chokepoint",reference:true},
  {id:"infra-danish-straits",layer:"Infrastructure",title:"Danish Straits",summary:"Baltic maritime gateway formed by the Øresund, Great Belt and Little Belt passages.",lat:55.68,lng:12.7,occurredAt:"2026-01-01T00:00:00Z",severity:"watch",source:"ATLAS strategic reference layer",sourceUrl:"https://www.eia.gov/international/analysis/special-topics/World_Oil_Transit_Chokepoints",location:"Denmark and Sweden",category:"Maritime chokepoint",reference:true},
  {id:"infra-taiwan-strait",layer:"Infrastructure",title:"Taiwan Strait",summary:"High-traffic passage connecting Northeast Asian manufacturing and shipping networks with Southeast Asia.",lat:24,lng:119.5,occurredAt:"2026-01-01T00:00:00Z",severity:"watch",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"Western Pacific",category:"Maritime chokepoint",reference:true},
  {id:"infra-luzon-strait",layer:"Infrastructure",title:"Luzon Strait",summary:"Deep-water gateway between the South China Sea and Philippine Sea used by shipping and submarine cables.",lat:20.5,lng:121.5,occurredAt:"2026-01-01T00:00:00Z",severity:"watch",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"Philippines and Taiwan",category:"Maritime chokepoint",reference:true},
  {id:"infra-korea-strait",layer:"Infrastructure",title:"Korea Strait",summary:"Passage linking the East China Sea and Sea of Japan between Korea and Japan.",lat:34.5,lng:129,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"Korea and Japan",category:"Maritime chokepoint",reference:true},
  {id:"infra-sunda",layer:"Infrastructure",title:"Sunda Strait",summary:"Indonesian passage between Java and Sumatra providing an alternative to the Strait of Malacca.",lat:-5.9,lng:105.85,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"Indonesia",category:"Maritime chokepoint",reference:true},
  {id:"infra-lombok",layer:"Infrastructure",title:"Lombok Strait",summary:"Deep-water Indonesian route used by vessels that cannot transit shallower regional passages.",lat:-8.5,lng:115.75,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"Indonesia",category:"Maritime chokepoint",reference:true},
  {id:"infra-torres",layer:"Infrastructure",title:"Torres Strait",summary:"Shallow strategic passage between Australia and New Guinea connecting the Coral and Arafura seas.",lat:-10.6,lng:142.2,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"Australia and Papua New Guinea",category:"Maritime chokepoint",reference:true},
  {id:"infra-bering",layer:"Infrastructure",title:"Bering Strait",summary:"Narrow Arctic passage between Russia and Alaska with growing strategic shipping significance.",lat:65.8,lng:-168.9,occurredAt:"2026-01-01T00:00:00Z",severity:"watch",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"Arctic",category:"Maritime chokepoint",reference:true},
  {id:"infra-mozambique",layer:"Infrastructure",title:"Mozambique Channel",summary:"Indian Ocean corridor between Madagascar and mainland Africa used by energy and container traffic.",lat:-18,lng:41,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"Southeast Africa",category:"Maritime corridor",reference:true},
  {id:"infra-shanghai",layer:"Infrastructure",title:"Port of Shanghai",summary:"Major container and manufacturing gateway serving the Yangtze River Delta.",lat:31.23,lng:121.47,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"China",category:"Port",reference:true},
  {id:"infra-ningbo",layer:"Infrastructure",title:"Ningbo–Zhoushan Port",summary:"Large deep-water cargo complex serving East Asian container, bulk and energy routes.",lat:29.87,lng:121.55,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"China",category:"Port",reference:true},
  {id:"infra-shenzhen",layer:"Infrastructure",title:"Shenzhen port cluster",summary:"Major Pearl River Delta container gateway including Yantian, Shekou and Chiwan terminals.",lat:22.55,lng:114.1,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"China",category:"Port",reference:true},
  {id:"infra-busan",layer:"Infrastructure",title:"Port of Busan",summary:"Northeast Asian transshipment hub connecting Korean industry with Pacific shipping routes.",lat:35.1,lng:129.04,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"South Korea",category:"Port",reference:true},
  {id:"infra-jebel-ali",layer:"Infrastructure",title:"Jebel Ali Port",summary:"Large Gulf transshipment and logistics hub serving Middle Eastern, African and South Asian trade.",lat:25.01,lng:55.06,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"United Arab Emirates",category:"Port",reference:true},
  {id:"infra-colombo",layer:"Infrastructure",title:"Port of Colombo",summary:"Indian Ocean transshipment hub positioned near principal Europe–Asia shipping lanes.",lat:6.94,lng:79.84,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"Sri Lanka",category:"Port",reference:true},
  {id:"infra-port-klang",layer:"Infrastructure",title:"Port Klang",summary:"Primary Malaysian container gateway on the Strait of Malacca.",lat:3,lng:101.4,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"Malaysia",category:"Port",reference:true},
  {id:"infra-tanjung-pelepas",layer:"Infrastructure",title:"Port of Tanjung Pelepas",summary:"Major transshipment terminal near the eastern entrance of the Strait of Malacca.",lat:1.36,lng:103.55,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"Malaysia",category:"Port",reference:true},
  {id:"infra-piraeus",layer:"Infrastructure",title:"Port of Piraeus",summary:"Eastern Mediterranean container and passenger gateway linked to European inland corridors.",lat:37.94,lng:23.64,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"Greece",category:"Port",reference:true},
  {id:"infra-algeciras",layer:"Infrastructure",title:"Port of Algeciras",summary:"Large transshipment and energy port positioned beside the Strait of Gibraltar.",lat:36.13,lng:-5.45,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"Spain",category:"Port",reference:true},
  {id:"infra-antwerp",layer:"Infrastructure",title:"Port of Antwerp-Bruges",summary:"Major European container, chemical and industrial gateway connected to inland transport networks.",lat:51.26,lng:4.4,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"Belgium",category:"Port",reference:true},
  {id:"infra-hamburg",layer:"Infrastructure",title:"Port of Hamburg",summary:"Northern European container gateway connecting maritime trade to central European rail and river routes.",lat:53.54,lng:9.98,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"Germany",category:"Port",reference:true},
  {id:"infra-tanger-med",layer:"Infrastructure",title:"Tanger Med Port",summary:"Major Mediterranean transshipment and industrial hub near the Strait of Gibraltar.",lat:35.89,lng:-5.5,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"Morocco",category:"Port",reference:true},
  {id:"infra-durban",layer:"Infrastructure",title:"Port of Durban",summary:"Large container and logistics gateway serving southern Africa and Indian Ocean routes.",lat:-29.87,lng:31.04,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"South Africa",category:"Port",reference:true},
  {id:"infra-mombasa",layer:"Infrastructure",title:"Port of Mombasa",summary:"East African maritime gateway connected to regional road, rail and pipeline corridors.",lat:-4.04,lng:39.66,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"Kenya",category:"Port",reference:true},
  {id:"infra-djibouti",layer:"Infrastructure",title:"Port of Djibouti",summary:"Strategic Red Sea logistics hub serving the Horn of Africa near Bab el-Mandeb.",lat:11.59,lng:43.15,occurredAt:"2026-01-01T00:00:00Z",severity:"watch",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"Djibouti",category:"Port",reference:true},
  {id:"infra-lagos",layer:"Infrastructure",title:"Lagos port complex",summary:"Major West African container and commercial gateway centred on Apapa and Tin Can Island.",lat:6.45,lng:3.39,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"Nigeria",category:"Port",reference:true},
  {id:"infra-santos",layer:"Infrastructure",title:"Port of Santos",summary:"Largest Brazilian maritime gateway for containers, agricultural exports and industrial cargo.",lat:-23.96,lng:-46.33,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"Brazil",category:"Port",reference:true},
  {id:"infra-ny-nj",layer:"Infrastructure",title:"Port of New York and New Jersey",summary:"Large Atlantic container gateway serving the northeastern United States.",lat:40.68,lng:-74.04,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"United States",category:"Port",reference:true},
  {id:"infra-savannah",layer:"Infrastructure",title:"Port of Savannah",summary:"Fast-growing Atlantic container gateway connected to southeastern US logistics networks.",lat:32.08,lng:-81.09,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"United States",category:"Port",reference:true},
  {id:"infra-vancouver",layer:"Infrastructure",title:"Port of Vancouver",summary:"Canada's principal Pacific gateway for containers, bulk commodities and rail connections.",lat:49.3,lng:-123.1,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"Canada",category:"Port",reference:true},
  {id:"infra-prince-rupert",layer:"Infrastructure",title:"Port of Prince Rupert",summary:"North Pacific container and bulk gateway with direct rail links into North America.",lat:54.31,lng:-130.32,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://unctad.org/topic/transport-and-trade-logistics/review-of-maritime-transport",location:"Canada",category:"Port",reference:true},
  {id:"infra-ras-tanura",layer:"Infrastructure",title:"Ras Tanura oil terminal",summary:"Major crude-oil export terminal serving Saudi energy shipments through the Persian Gulf.",lat:26.64,lng:50.16,occurredAt:"2026-01-01T00:00:00Z",severity:"watch",source:"ATLAS strategic reference layer",sourceUrl:"https://www.eia.gov/international/analysis/special-topics/World_Oil_Transit_Chokepoints",location:"Saudi Arabia",category:"Energy terminal",reference:true},
  {id:"infra-ras-laffan",layer:"Infrastructure",title:"Ras Laffan Industrial City",summary:"Major liquefied-natural-gas production and export hub on the Persian Gulf.",lat:25.92,lng:51.55,occurredAt:"2026-01-01T00:00:00Z",severity:"watch",source:"ATLAS strategic reference layer",sourceUrl:"https://www.eia.gov/international/analysis/special-topics/World_Oil_Transit_Chokepoints",location:"Qatar",category:"Energy terminal",reference:true},
  {id:"infra-fujairah",layer:"Infrastructure",title:"Port of Fujairah energy hub",summary:"Oil storage, bunkering and export hub positioned outside the Strait of Hormuz.",lat:25.12,lng:56.35,occurredAt:"2026-01-01T00:00:00Z",severity:"watch",source:"ATLAS strategic reference layer",sourceUrl:"https://www.eia.gov/international/analysis/special-topics/World_Oil_Transit_Chokepoints",location:"United Arab Emirates",category:"Energy terminal",reference:true},
  {id:"infra-houston",layer:"Infrastructure",title:"Houston Ship Channel",summary:"Major US energy, petrochemical and freight corridor connecting Houston with the Gulf of Mexico.",lat:29.73,lng:-95.27,occurredAt:"2026-01-01T00:00:00Z",severity:"watch",source:"ATLAS strategic reference layer",sourceUrl:"https://www.eia.gov/international/analysis/special-topics/World_Oil_Transit_Chokepoints",location:"United States",category:"Energy and port corridor",reference:true},
  {id:"infra-marseille-cables",layer:"Infrastructure",title:"Marseille submarine-cable hub",summary:"Major Mediterranean landing point connecting European data networks with Africa, the Middle East and Asia.",lat:43.3,lng:5.37,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://www.submarinecablemap.com/",location:"France",category:"Digital cable hub",reference:true},
  {id:"infra-virginia-beach",layer:"Infrastructure",title:"Virginia Beach cable landings",summary:"Dense trans-Atlantic submarine-cable landing cluster serving eastern North American data routes.",lat:36.85,lng:-75.98,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://www.submarinecablemap.com/",location:"United States",category:"Digital cable hub",reference:true},
  {id:"infra-porthcurno",layer:"Infrastructure",title:"Porthcurno cable landing area",summary:"Historic and continuing submarine-cable landing region linking the United Kingdom with Atlantic routes.",lat:50.04,lng:-5.66,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://www.submarinecablemap.com/",location:"United Kingdom",category:"Digital cable hub",reference:true},
  {id:"infra-mumbai-cables",layer:"Infrastructure",title:"Mumbai submarine-cable hub",summary:"Major Indian cable landing and network gateway connecting South Asia to global data routes.",lat:19.08,lng:72.88,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://www.submarinecablemap.com/",location:"India",category:"Digital cable hub",reference:true},
  {id:"infra-chikura",layer:"Infrastructure",title:"Chikura cable landing area",summary:"Important Pacific submarine-cable landing cluster supporting Japanese and trans-Pacific connectivity.",lat:34.98,lng:139.95,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://www.submarinecablemap.com/",location:"Japan",category:"Digital cable hub",reference:true},
  {id:"infra-anchorage-air",layer:"Infrastructure",title:"Ted Stevens Anchorage air-cargo hub",summary:"Strategically positioned trans-Pacific air-freight and technical-stop hub between Asia and North America.",lat:61.17,lng:-150,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://www.icao.int/sustainability/Pages/eap-fp-air-traffic.aspx",location:"United States",category:"Air cargo hub",reference:true},
  {id:"infra-memphis-air",layer:"Infrastructure",title:"Memphis air-cargo hub",summary:"Large overnight parcel and air-freight distribution hub serving North American logistics networks.",lat:35.04,lng:-89.98,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://www.icao.int/sustainability/Pages/eap-fp-air-traffic.aspx",location:"United States",category:"Air cargo hub",reference:true},
  {id:"infra-dubai-air",layer:"Infrastructure",title:"Dubai international aviation hub",summary:"Major passenger and air-cargo transfer hub linking Europe, Asia, Africa and the Middle East.",lat:25.25,lng:55.36,occurredAt:"2026-01-01T00:00:00Z",severity:"stable",source:"ATLAS strategic reference layer",sourceUrl:"https://www.icao.int/sustainability/Pages/eap-fp-air-traffic.aspx",location:"United Arab Emirates",category:"Aviation hub",reference:true},
];

const referenceDate="2026-01-01T00:00:00Z";
const airportRecords:Array<[string,string,string,number,number]>=[
  ["yyz","Toronto Pearson International Airport","Canada",43.68,-79.63],
  ["yvr","Vancouver International Airport","Canada",49.19,-123.18],
  ["yul","Montréal–Trudeau International Airport","Canada",45.47,-73.74],
  ["yyc","Calgary International Airport","Canada",51.12,-114.02],
  ["yeg","Edmonton International Airport","Canada",53.31,-113.58],
  ["yow","Ottawa International Airport","Canada",45.32,-75.67],
  ["yhz","Halifax Stanfield International Airport","Canada",44.88,-63.51],
  ["jfk","John F. Kennedy International Airport","United States",40.64,-73.78],
  ["lax","Los Angeles International Airport","United States",33.94,-118.41],
  ["ord","Chicago O’Hare International Airport","United States",41.98,-87.9],
  ["atl","Hartsfield–Jackson Atlanta International Airport","United States",33.64,-84.43],
  ["mex","Mexico City International Airport","Mexico",19.44,-99.07],
  ["gru","São Paulo–Guarulhos International Airport","Brazil",-23.44,-46.47],
  ["bog","El Dorado International Airport","Colombia",4.7,-74.15],
  ["lhr","London Heathrow Airport","United Kingdom",51.47,-0.45],
  ["cdg","Paris Charles de Gaulle Airport","France",49.01,2.55],
  ["fra","Frankfurt Airport","Germany",50.04,8.56],
  ["ams","Amsterdam Airport Schiphol","Netherlands",52.31,4.77],
  ["ist","Istanbul Airport","Türkiye",41.28,28.75],
  ["cai","Cairo International Airport","Egypt",30.12,31.41],
  ["jnb","O. R. Tambo International Airport","South Africa",-26.14,28.25],
  ["nbo","Jomo Kenyatta International Airport","Kenya",-1.32,36.93],
  ["add","Addis Ababa Bole International Airport","Ethiopia",8.98,38.8],
  ["doh","Hamad International Airport","Qatar",25.26,51.61],
  ["del","Indira Gandhi International Airport","India",28.56,77.1],
  ["bom","Chhatrapati Shivaji Maharaj International Airport","India",19.09,72.87],
  ["sin","Singapore Changi Airport","Singapore",1.36,103.99],
  ["hkg","Hong Kong International Airport","Hong Kong",22.31,113.92],
  ["pvg","Shanghai Pudong International Airport","China",31.14,121.81],
  ["pek","Beijing Capital International Airport","China",40.08,116.6],
  ["hnd","Tokyo Haneda Airport","Japan",35.55,139.78],
  ["icn","Incheon International Airport","South Korea",37.46,126.44],
  ["bkk","Suvarnabhumi Airport","Thailand",13.69,100.75],
  ["kul","Kuala Lumpur International Airport","Malaysia",2.75,101.71],
  ["syd","Sydney Airport","Australia",-33.94,151.18],
];

const portRecords:Array<[string,string,string,number,number]>=[
  ["montreal","Port of Montréal","Canada",45.57,-73.52],
  ["halifax","Port of Halifax","Canada",44.64,-63.57],
  ["seattle-tacoma","Northwest Seaport Alliance","United States",47.27,-122.42],
  ["manzanillo","Port of Manzanillo","Mexico",19.05,-104.32],
  ["callao","Port of Callao","Peru",-12.05,-77.15],
  ["valencia","Port of Valencia","Spain",39.45,-0.32],
  ["le-havre","Port of Le Havre","France",49.49,0.1],
  ["salalah","Port of Salalah","Oman",16.94,54],
  ["chattogram","Port of Chattogram","Bangladesh",22.31,91.8],
  ["cape-town","Port of Cape Town","South Africa",-33.91,18.43],
  ["dar-es-salaam","Port of Dar es Salaam","Tanzania",-6.82,39.3],
  ["melbourne","Port of Melbourne","Australia",-37.82,144.91],
  ["sydney","Port Botany","Australia",-33.97,151.22],
  ["auckland","Port of Auckland","New Zealand",-36.84,174.79],
];

const airportReferences:IntelPoint[]=airportRecords.map(([id,title,location,lat,lng])=>({
  id:`airport-${id}`,layer:"Airports",title,summary:"Major international passenger and cargo gateway included as a global transport reference point.",lat,lng,occurredAt:referenceDate,severity:"stable",source:"OurAirports public data",sourceUrl:"https://ourairports.com/data/",location,category:"Major airport",reference:true,
}));
const portReferences:IntelPoint[]=portRecords.map(([id,title,location,lat,lng])=>({
  id:`port-${id}`,layer:"Ports",title,summary:"Major commercial seaport included as a global maritime transport reference point.",lat,lng,occurredAt:referenceDate,severity:"stable",source:"NGA World Port Index",sourceUrl:"https://msi.nga.mil/Publications/WPI",location,category:"Major port",reference:true,
}));
const categorizedInfrastructure:IntelPoint[]=infrastructure.map((point)=>{
  const category=(point.category??point.title).toLowerCase();
  if(/air|aviation/.test(category))return {...point,layer:"Airports"};
  if(/port/.test(category)&&!/energy/.test(category))return {...point,layer:"Ports"};
  return point;
});

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
      fetch("/api/news",{signal:AbortSignal.timeout(10000)}).then(async(response)=>{if(!response.ok)throw new Error("news");return response.json() as Promise<NewsResponse>;}),
      fetch("/api/intelligence",{signal:AbortSignal.timeout(10000)}).then(async(response)=>{if(!response.ok)throw new Error("intelligence");return response.json() as Promise<IntelligenceResponse>;}),
    ]);
    if(newsResult.status==="fulfilled"){setStories(newsResult.value.stories);setNewsSources(newsResult.value.sources);setNewsState(newsResult.value.failedFeeds?"partial":"live");setFetchedAt(newsResult.value.fetchedAt);}else setNewsState("unavailable");
    if(intelResult.status==="fulfilled"){setNatural(intelResult.value.events);setNaturalSources(intelResult.value.sources);setNaturalState(intelResult.value.status);setFetchedAt((current)=>current??intelResult.value.fetchedAt);}else setNaturalState("unavailable");
  },[]);
  useEffect(()=>{void load();const timer=setInterval(()=>{if(document.visibilityState==="visible")void load();},15*60*1000);return()=>clearInterval(timer);},[load]);

  const points=useMemo<IntelPoint[]>(()=>[
    ...stories.filter((story)=>story.desk==="world"&&story.location).map((story)=>({id:`news-${story.id}`,layer:"Headlines" as const,title:story.title,summary:story.summary,lat:story.location!.lat,lng:story.location!.lng,occurredAt:story.publishedAt,severity:story.level,source:story.source,sourceUrl:story.articleUrl,location:story.location!.name,category:story.category})),
    ...natural,
    ...categorizedInfrastructure,
    ...airportReferences,
    ...portReferences,
  ],[natural,stories]);
  const status=newsState==="loading"||naturalState==="loading"?"loading":newsState==="live"&&naturalState==="live"?"live":newsState!=="unavailable"||naturalState!=="unavailable"?"partial":"unavailable";
  const liveNaturalSources=naturalSources.filter((source)=>source.status==="live").map((source)=>source.label);
  const sourceLine=[newsSources.length?`${newsSources.length} news publishers`:"News feeds unavailable",...liveNaturalSources,"ATLAS reference layer"].join(" · ");
  return <IntelligenceMap points={points} status={status} fetchedAt={fetchedAt} sourceLine={sourceLine}/>;
}
