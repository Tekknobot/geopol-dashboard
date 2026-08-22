export const runtime = "edge";

type GeoFeature = { geometry?: { coordinates?: unknown }; properties?: Record<string, unknown> };
type GeoPayload = { features?: GeoFeature[]; numberMatched?: number; numberReturned?: number };
type MetricStatus = "live" | "release" | "reference" | "unavailable";
type MetricGroup = "markets" | "environment" | "labour" | "economy" | "housing" | "population" | "trade" | "health";

type Metric = {
  id: string;
  label: string;
  value: string;
  raw?: number;
  unit?: string;
  detail: string;
  source: string;
  sourceUrl: string;
  observedAt?: string;
  status: MetricStatus;
  group: MetricGroup;
  scope?: string;
  cadence?: string;
  change?: string;
};

type WdsMember={memberId:number;memberNameEn?:string;terminated?:number;memberUomCode?:number|null};
type WdsDimension={dimensionPositionId:number;dimensionNameEn?:string;member?:WdsMember[]};
type WdsMetadata={productId?:string|number;cubeTitleEn?:string;releaseTime?:string;dimension?:WdsDimension[]};

type StatMetricSpec={
  id:string; label:string; productId:number; group:MetricGroup; detail:string; cadence:string;
  sourceUrl:string; forceCanada?:boolean; selectors?:Array<{dimension:string[];members:string[]}>;
  formatter:(value:number)=>string; unit?:string;
};

const GEO_NAMES:Record<string,string>={CA:"Canada",BC:"British Columbia",AB:"Alberta",SK:"Saskatchewan",MB:"Manitoba",ON:"Ontario",QC:"Quebec",NB:"New Brunswick",NS:"Nova Scotia",PE:"Prince Edward Island",NL:"Newfoundland and Labrador",YT:"Yukon",NT:"Northwest Territories",NU:"Nunavut"};
const safeNumber=(value:unknown)=>{const n=typeof value==="string"?Number(value):value;return typeof n==="number"&&Number.isFinite(n)?n:null;};
const safeText=(value:unknown)=>typeof value==="string"?value:"";
const norm=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();

async function jsonFetch(url:string,timeout=7500){const response=await fetch(url,{headers:{Accept:"application/json, application/geo+json","User-Agent":"Atlas-Canada-Simulator/3.0"},signal:AbortSignal.timeout(timeout)});if(!response.ok)throw new Error(`${response.status}`);return response.json() as Promise<any>;}
async function postJson(url:string,body:unknown,timeout=8500){const response=await fetch(url,{method:"POST",headers:{Accept:"application/json","Content-Type":"application/json","User-Agent":"Atlas-Canada-Simulator/3.0"},body:JSON.stringify(body),signal:AbortSignal.timeout(timeout)});if(!response.ok)throw new Error(`${response.status}`);return response.json() as Promise<any>;}
function latestValet(payload:any,code:string){const rows=Array.isArray(payload?.observations)?payload.observations:[];for(let i=rows.length-1;i>=0;i--){const value=safeNumber(rows[i]?.[code]?.v);if(value!==null)return {value,date:safeText(rows[i]?.d)};}return null;}
function maxAqhi(features:GeoFeature[]){let maximum:{value:number;location:string;date:string}|null=null;for(const feature of features){const p=feature.properties??{};const value=[p.aqhi,p.AQHI,p.aqhi_value,p.AQHI_VALUE,p.value].map(safeNumber).find(v=>v!==null)??null;if(value===null)continue;const location=safeText(p.location_name_en)||safeText(p.LOCATION_NAME_EN)||safeText(p.zone_name_en)||safeText(p.name_en)||safeText(p.location_id)||"Canadian station";const date=safeText(p.observation_datetime)||safeText(p.OBSERVATION_DATETIME)||safeText(p.date_stamp)||safeText(p.valid_datetime);if(!maximum||value>maximum.value)maximum={value,location,date};}return maximum;}

const moneyCompact=(n:number)=>new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD",notation:"compact",maximumFractionDigits:1}).format(n);
const numberCompact=(n:number)=>new Intl.NumberFormat("en-CA",{notation:"compact",maximumFractionDigits:1}).format(n);
const pct=(n:number)=>`${n.toFixed(1)}%`;
const index=(n:number)=>n.toFixed(1);
const dollars=(n:number)=>new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD",maximumFractionDigits:0}).format(n);
const scalarMultiplier=(code:unknown)=>{const n=safeNumber(code);return n===null||n<0||n>12?1:10**n;};

function memberMatch(dim:WdsDimension|undefined,aliases:string[]){if(!dim)return null;const members=(dim.member??[]).filter(m=>m.terminated!==1);const targets=aliases.map(norm);for(const target of targets){const exact=members.find(m=>norm(m.memberNameEn??"")===target);if(exact)return exact;}for(const target of targets){const contains=members.find(m=>norm(m.memberNameEn??"").includes(target));if(contains)return contains;}return null;}
function dimMatch(dims:WdsDimension[],aliases:string[]){const targets=aliases.map(norm);for(const target of targets){const exact=dims.find(d=>norm(d.dimensionNameEn??"")===target);if(exact)return exact;}for(const target of targets){const contains=dims.find(d=>norm(d.dimensionNameEn??"").includes(target));if(contains)return contains;}return undefined;}
function smartDefault(dim:WdsDimension){const name=norm(dim.dimensionNameEn??"");const options:string[][]=[];if(name.includes("statistics"))options.push(["Estimate"]);if(name.includes("data type"))options.push(["Seasonally adjusted"]);if(name.includes("gender")||name.includes("sex"))options.push(["Total - Gender","Both sexes","Total, gender"]);if(name.includes("age"))options.push(["15 years and over","Total, all ages"]);if(name.includes("type of unit"))options.push(["Total units","Total, all unit types"]);for(const a of options){const m=memberMatch(dim,a);if(m)return m;}return (dim.member??[]).find(m=>m.terminated!==1)??null;}

async function statcanMetric(spec:StatMetricSpec,geoCode:string):Promise<Metric>{
  const metadataPayload=await postJson("https://www150.statcan.gc.ca/t1/wds/rest/getCubeMetadata",[{productId:spec.productId}]);
  const wrapper=Array.isArray(metadataPayload)?metadataPayload[0]:metadataPayload;
  const meta=(wrapper?.object??wrapper) as WdsMetadata;
  const dims=Array.isArray(meta?.dimension)?meta.dimension:[];
  if(!dims.length)throw new Error("metadata");
  const coordinate=Array(10).fill(0);
  const requestedGeo=spec.forceCanada?"Canada":(GEO_NAMES[geoCode]??"Canada");
  for(const dim of dims){let member:WdsMember|null=null;const dname=norm(dim.dimensionNameEn??"");if(dname.includes("geography")){member=memberMatch(dim,[requestedGeo,requestedGeo==="Yukon"?"Yukon Territory":"",requestedGeo==="Canada"?"Canada":""].filter(Boolean));if(!member)throw new Error(`geography:${requestedGeo}`);}
    if(!member){const selector=spec.selectors?.find(s=>s.dimension.some(a=>dname.includes(norm(a))));if(selector){member=memberMatch(dim,selector.members);if(!member)throw new Error(`selector:${dim.dimensionNameEn}`);}}
    if(!member)member=smartDefault(dim);
    if(member&&dim.dimensionPositionId>=1&&dim.dimensionPositionId<=10)coordinate[dim.dimensionPositionId-1]=member.memberId;
  }
  const data=await postJson("https://www150.statcan.gc.ca/t1/wds/rest/getDataFromCubePidCoordAndLatestNPeriods",[{productId:spec.productId,coordinate:coordinate.join("."),latestN:2}]);
  const row=Array.isArray(data)?data[0]:data;const obj=row?.object??row;const points=obj?.vectorDataPoint??obj?.vectorDataPoints??[];if(!Array.isArray(points)||!points.length)throw new Error("datapoint");
  const latest=points[points.length-1];const previous=points.length>1?points[points.length-2]:null;const raw=safeNumber(latest?.value);if(raw===null)throw new Error("value");const value=raw*scalarMultiplier(latest?.scalarFactorCode??latest?.scalorFactorCode);
  const prevRaw=safeNumber(previous?.value);const prev=prevRaw===null?null:prevRaw*scalarMultiplier(previous?.scalarFactorCode??previous?.scalorFactorCode);
  let change:string|undefined;if(prev!==null&&prev!==0){const delta=((value-prev)/Math.abs(prev))*100;if(Number.isFinite(delta))change=`${delta>=0?"+":""}${delta.toFixed(1)}% vs prior`;}
  return {id:spec.id,label:spec.label,value:spec.formatter(value),raw:value,unit:spec.unit,detail:spec.detail,source:`Statistics Canada · Table ${String(spec.productId).replace(/^(\d{2})(\d{2})(\d{4})$/,"$1-$2-$3-01")}`,sourceUrl:spec.sourceUrl,observedAt:safeText(latest?.refPer)||safeText(latest?.refPerRaw)||safeText(meta?.releaseTime),status:"release",group:spec.group,scope:spec.forceCanada?"Canada-wide":requestedGeo,cadence:spec.cadence,change};
}

const STAT_SPECS:StatMetricSpec[]=[
 {id:"unemployment",label:"Unemployment rate",productId:14100287,group:"labour",detail:"Seasonally adjusted unemployment rate, age 15+.",cadence:"Monthly",sourceUrl:"https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1410028701",selectors:[{dimension:["labour force characteristics"],members:["Unemployment rate"]},{dimension:["data type"],members:["Seasonally adjusted"]},{dimension:["gender"],members:["Total - Gender"]},{dimension:["age group"],members:["15 years and over"]},{dimension:["statistics"],members:["Estimate"]}],formatter:pct,unit:"%"},
 {id:"employment",label:"Employment",productId:14100287,group:"labour",detail:"Seasonally adjusted employed population, age 15+.",cadence:"Monthly",sourceUrl:"https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1410028701",selectors:[{dimension:["labour force characteristics"],members:["Employment"]},{dimension:["data type"],members:["Seasonally adjusted"]},{dimension:["gender"],members:["Total - Gender"]},{dimension:["age group"],members:["15 years and over"]},{dimension:["statistics"],members:["Estimate"]}],formatter:numberCompact},
 {id:"gdp",label:"Provincial GDP",productId:36100402,group:"economy",detail:"Latest expenditure-based provincial/territorial GDP observation.",cadence:"Annual",sourceUrl:"https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610040201",selectors:[{dimension:["estimates","income and expenditure account"],members:["Gross domestic product at market prices","Gross domestic product, expenditure-based"]}],formatter:moneyCompact,unit:"CAD"},
 {id:"productivity",label:"Labour productivity",productId:36100206,group:"economy",detail:"Business-sector labour productivity index; national series.",cadence:"Quarterly",sourceUrl:"https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610020601",forceCanada:true,selectors:[{dimension:["labour productivity measures","estimates"],members:["Labour productivity","Labour productivity index"]}],formatter:index},
 {id:"income",label:"Median after-tax income",productId:11100190,group:"economy",detail:"Families and unattached individuals; latest annual release.",cadence:"Annual",sourceUrl:"https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1110019001",selectors:[{dimension:["income concept"],members:["After-tax income"]},{dimension:["statistics"],members:["Median"]},{dimension:["economic family type"],members:["Economic families and persons not in an economic family","Economic families and unattached individuals"]}],formatter:dollars,unit:"CAD"},
 {id:"housing-starts",label:"Housing starts",productId:34100157,group:"housing",detail:"CMHC six-month moving-average housing starts series distributed by Statistics Canada.",cadence:"Monthly",sourceUrl:"https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3410015701",selectors:[{dimension:["housing estimates"],members:["Housing starts"]}],formatter:numberCompact,unit:"units"},
 {id:"building-permits",label:"Building permits",productId:34100292,group:"housing",detail:"Latest building-permit construction value.",cadence:"Monthly",sourceUrl:"https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3410029201",selectors:[{dimension:["type of structure"],members:["Total, type of structure","Total, all structures"]},{dimension:["type of work"],members:["Total, type of work","Total, all types of work"]}],formatter:moneyCompact,unit:"CAD"},
 {id:"population",label:"Population estimate",productId:17100009,group:"population",detail:"Official quarterly demographic estimate.",cadence:"Quarterly",sourceUrl:"https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1710000901",formatter:numberCompact},
 {id:"interprovincial",label:"Net interprovincial migration",productId:17100020,group:"population",detail:"Quarterly net movement between provinces and territories.",cadence:"Quarterly",sourceUrl:"https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1710002001",selectors:[{dimension:["components of interprovincial migration","migration component"],members:["Net interprovincial migration","Net interprovincial migrants"]}],formatter:(n)=>`${n>=0?"+":""}${numberCompact(n)}`},
 {id:"exports",label:"Domestic exports",productId:12100175,group:"trade",detail:"Monthly customs-basis domestic exports to principal trading partners combined.",cadence:"Monthly",sourceUrl:"https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1210017501",selectors:[{dimension:["trade"],members:["Domestic exports"]},{dimension:["commodity"],members:["Total, all commodities","Total, all merchandise","Total commodities"]},{dimension:["trading partner","principal trading partner"],members:["All countries","Total, all countries"]}],formatter:moneyCompact,unit:"CAD"},
 {id:"health-workforce",label:"Health-sector employment",productId:14100355,group:"health",detail:"Employment in health care and social assistance; seasonally adjusted.",cadence:"Monthly",sourceUrl:"https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1410035501",selectors:[{dimension:["industry"],members:["Health care and social assistance [62]","Health care and social assistance"]},{dimension:["data type"],members:["Seasonally adjusted"]},{dimension:["gender"],members:["Total - Gender"]},{dimension:["statistics"],members:["Estimate"]}],formatter:numberCompact},
];

export async function GET(request:Request){
 const fetchedAt=new Date().toISOString();const url=new URL(request.url);const geoCode=(url.searchParams.get("geo")||"CA").toUpperCase();const metrics:Metric[]=[];
 const [bank,alerts,aqhi,hydro,...statResults]=await Promise.allSettled([
   jsonFetch("https://www.bankofcanada.ca/valet/observations/V39079,FXUSDCAD,STATIC_TOTALCPICHANGE,BD.CDN.10YR.DQ.YLD/json?recent=15"),
   jsonFetch("https://api.weather.gc.ca/collections/weather-alerts/items?f=json&limit=250"),
   jsonFetch("https://api.weather.gc.ca/collections/aqhi-observations-realtime/items?f=json&limit=500"),
   jsonFetch("https://api.weather.gc.ca/collections/hydrometric-realtime/items?f=json&limit=500"),
   ...STAT_SPECS.map(spec=>statcanMetric(spec,geoCode)),
 ]);
 if(bank.status==="fulfilled"){const rate=latestValet(bank.value,"V39079"),fx=latestValet(bank.value,"FXUSDCAD"),cpi=latestValet(bank.value,"STATIC_TOTALCPICHANGE"),bond=latestValet(bank.value,"BD.CDN.10YR.DQ.YLD");if(rate)metrics.push({id:"policy-rate",label:"Policy rate",value:`${rate.value.toFixed(2)}%`,raw:rate.value,unit:"%",detail:"Target for the overnight rate",source:"Bank of Canada Valet",sourceUrl:"https://www.bankofcanada.ca/valet/",observedAt:rate.date,status:"live",group:"markets",scope:"Canada-wide",cadence:"Policy decision"});if(fx)metrics.push({id:"usd-cad",label:"USD / CAD",value:fx.value.toFixed(4),raw:fx.value,detail:"Daily Bank of Canada exchange rate",source:"Bank of Canada Valet",sourceUrl:"https://www.bankofcanada.ca/rates/exchange/",observedAt:fx.date,status:"live",group:"markets",scope:"Canada-wide",cadence:"Daily"});if(cpi)metrics.push({id:"inflation",label:"CPI inflation",value:`${cpi.value.toFixed(1)}%`,raw:cpi.value,unit:"% y/y",detail:"Total CPI, year-over-year change",source:"Bank of Canada Valet",sourceUrl:"https://www.bankofcanada.ca/rates/indicators/key-variables/inflation-control-target/",observedAt:cpi.date,status:"live",group:"markets",scope:"Canada-wide",cadence:"Monthly"});if(bond)metrics.push({id:"bond-10y",label:"Canada 10Y",value:`${bond.value.toFixed(2)}%`,raw:bond.value,unit:"%",detail:"Government of Canada benchmark yield",source:"Bank of Canada Valet",sourceUrl:"https://www.bankofcanada.ca/rates/interest-rates/canadian-bonds/",observedAt:bond.date,status:"live",group:"markets",scope:"Canada-wide",cadence:"Daily"});}
 if(alerts.status==="fulfilled"){const payload=alerts.value as GeoPayload,features=Array.isArray(payload.features)?payload.features:[],provinces=new Set(features.map(f=>safeText(f.properties?.province)).filter(Boolean));metrics.push({id:"weather-alerts",label:"Weather alerts",value:String(payload.numberMatched??features.length),raw:payload.numberMatched??features.length,detail:`Active/returned ECCC alerts across ${provinces.size||"multiple"} provinces/territories`,source:"ECCC MSC GeoMet",sourceUrl:"https://api.weather.gc.ca/collections/weather-alerts",status:"live",group:"environment",scope:"Canada-wide",cadence:"Real time"});}
 if(aqhi.status==="fulfilled"){const payload=aqhi.value as GeoPayload,features=Array.isArray(payload.features)?payload.features:[],peak=maxAqhi(features);metrics.push({id:"aqhi-reporting",label:"AQHI observations",value:String(payload.numberMatched??features.length),raw:payload.numberMatched??features.length,detail:"Real-time air-quality observations returned by GeoMet",source:"ECCC MSC GeoMet",sourceUrl:"https://api.weather.gc.ca/collections/aqhi-observations-realtime",status:"live",group:"environment",scope:"Canada-wide",cadence:"Real time"});if(peak)metrics.push({id:"aqhi-peak",label:"Peak AQHI",value:peak.value>=10?"10+":String(Math.round(peak.value)),raw:peak.value,detail:`Highest value in returned sample · ${peak.location}`,source:"ECCC MSC GeoMet",sourceUrl:"https://api.weather.gc.ca/collections/aqhi-observations-realtime",observedAt:peak.date,status:"live",group:"environment",scope:"Canada-wide",cadence:"Real time"});}
 if(hydro.status==="fulfilled"){const payload=hydro.value as GeoPayload,features=Array.isArray(payload.features)?payload.features:[],stations=new Set(features.map(f=>safeText(f.properties?.STATION_NUMBER)).filter(Boolean)),provinces=new Set(features.map(f=>safeText(f.properties?.PROV_TERR_STATE_LOC)).filter(Boolean));metrics.push({id:"hydro",label:"Water observations",value:String(stations.size||features.length),raw:stations.size||features.length,detail:`Real-time hydrometric stations in returned sample · ${provinces.size} jurisdictions`,source:"Water Survey of Canada / ECCC GeoMet",sourceUrl:"https://api.weather.gc.ca/collections/hydrometric-realtime",status:"live",group:"environment",scope:"Canada-wide",cadence:"Real time"});}
 const statMetrics:Metric[]=[];const statStatus:Record<string,boolean>={};statResults.forEach((result,i)=>{const spec=STAT_SPECS[i];statStatus[spec.id]=result.status==="fulfilled";if(result.status==="fulfilled")statMetrics.push(result.value as Metric);});
 const sourceStatus={bankOfCanada:bank.status==="fulfilled",weatherAlerts:alerts.status==="fulfilled",airQuality:aqhi.status==="fulfilled",hydrometric:hydro.status==="fulfilled",...statStatus};
 const allResults=[bank,alerts,aqhi,hydro,...statResults];
 return Response.json({fetchedAt,geo:geoCode,geoName:GEO_NAMES[geoCode]??"Canada",metrics,fundamentals:statMetrics,sourceStatus,availableFeeds:allResults.filter(r=>r.status==="fulfilled").length,totalFeeds:allResults.length},{headers:{"Cache-Control":"public, max-age=120, s-maxage=600, stale-while-revalidate=1800"}});
}
