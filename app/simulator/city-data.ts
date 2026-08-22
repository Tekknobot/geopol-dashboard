export type Metro={
  id:string; name:string; cma:string; province:string; provinceName:string;
  lat:number; lng:number; radiusKm:number; populationFallback:number;
  strengths:string[];
};

export const metros:Metro[]=[
 {id:"toronto",name:"Toronto",cma:"Toronto, Ontario",province:"ON",provinceName:"Ontario",lat:43.6532,lng:-79.3832,radiusKm:85,populationFallback:7.1,strengths:["finance","technology","advanced manufacturing","logistics"]},
 {id:"montreal",name:"Montréal",cma:"Montréal, Quebec",province:"QC",provinceName:"Quebec",lat:45.5019,lng:-73.5674,radiusKm:75,populationFallback:4.6,strengths:["aerospace","AI","life sciences","culture"]},
 {id:"vancouver",name:"Vancouver",cma:"Vancouver, British Columbia",province:"BC",provinceName:"British Columbia",lat:49.2827,lng:-123.1207,radiusKm:75,populationFallback:3.0,strengths:["Pacific trade","technology","film","tourism"]},
 {id:"calgary",name:"Calgary",cma:"Calgary, Alberta",province:"AB",provinceName:"Alberta",lat:51.0447,lng:-114.0719,radiusKm:80,populationFallback:1.7,strengths:["energy","engineering","logistics","technology"]},
 {id:"edmonton",name:"Edmonton",cma:"Edmonton, Alberta",province:"AB",provinceName:"Alberta",lat:53.5461,lng:-113.4938,radiusKm:75,populationFallback:1.6,strengths:["energy services","government","AI","manufacturing"]},
 {id:"ottawa",name:"Ottawa–Gatineau",cma:"Ottawa - Gatineau, Ontario/Quebec",province:"ON",provinceName:"Ontario / Quebec",lat:45.4215,lng:-75.6972,radiusKm:70,populationFallback:1.6,strengths:["federal government","technology","defence","research"]},
 {id:"winnipeg",name:"Winnipeg",cma:"Winnipeg, Manitoba",province:"MB",provinceName:"Manitoba",lat:49.8951,lng:-97.1384,radiusKm:65,populationFallback:.94,strengths:["transport","agri-food","aerospace","manufacturing"]},
 {id:"quebec",name:"Québec City",cma:"Québec, Quebec",province:"QC",provinceName:"Quebec",lat:46.8139,lng:-71.2080,radiusKm:60,populationFallback:.88,strengths:["government","insurance","technology","tourism"]},
 {id:"hamilton",name:"Hamilton",cma:"Hamilton, Ontario",province:"ON",provinceName:"Ontario",lat:43.2557,lng:-79.8711,radiusKm:50,populationFallback:.85,strengths:["steel","health sciences","port logistics","advanced manufacturing"]},
 {id:"kitchener",name:"Kitchener–Cambridge–Waterloo",cma:"Kitchener - Cambridge - Waterloo, Ontario",province:"ON",provinceName:"Ontario",lat:43.4516,lng:-80.4925,radiusKm:50,populationFallback:.68,strengths:["technology","advanced manufacturing","education","startups"]},
 {id:"halifax",name:"Halifax",cma:"Halifax, Nova Scotia",province:"NS",provinceName:"Nova Scotia",lat:44.6488,lng:-63.5752,radiusKm:55,populationFallback:.52,strengths:["port logistics","defence","ocean tech","education"]},
 {id:"victoria",name:"Victoria",cma:"Victoria, British Columbia",province:"BC",provinceName:"British Columbia",lat:48.4284,lng:-123.3656,radiusKm:45,populationFallback:.44,strengths:["government","technology","tourism","marine"]},
 {id:"saskatoon",name:"Saskatoon",cma:"Saskatoon, Saskatchewan",province:"SK",provinceName:"Saskatchewan",lat:52.1332,lng:-106.6700,radiusKm:50,populationFallback:.36,strengths:["agriculture","mining services","research","biotech"]},
 {id:"regina",name:"Regina",cma:"Regina, Saskatchewan",province:"SK",provinceName:"Saskatchewan",lat:50.4452,lng:-104.6189,radiusKm:45,populationFallback:.28,strengths:["government","agriculture","insurance","energy services"]},
 {id:"london",name:"London",cma:"London, Ontario",province:"ON",provinceName:"Ontario",lat:42.9849,lng:-81.2453,radiusKm:50,populationFallback:.59,strengths:["health","education","manufacturing","finance"]},
 {id:"windsor",name:"Windsor",cma:"Windsor, Ontario",province:"ON",provinceName:"Ontario",lat:42.3149,lng:-83.0364,radiusKm:45,populationFallback:.48,strengths:["automotive","cross-border trade","manufacturing","logistics"]},
 {id:"st-johns",name:"St. John's",cma:"St. John's, Newfoundland and Labrador",province:"NL",provinceName:"Newfoundland and Labrador",lat:47.5615,lng:-52.7126,radiusKm:45,populationFallback:.23,strengths:["offshore energy","ocean tech","government","education"]}
];

export const metroById=(id:string)=>metros.find(m=>m.id===id);
