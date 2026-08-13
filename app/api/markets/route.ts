import { XMLParser } from "fast-xml-parser";

export const runtime = "edge";

type Quote = { id:string; label:string; value:number; display:string; change:number|null; changeDisplay:string; asOf:string; source:string; sourceUrl:string; cadence:string };
type Attempt = { provider:string; status:"ok"|"failed"; detail:string };
type Provider<T> = { label:string; url:string; cadence:string; load:()=>Promise<T> };
type FeedResult<T> = { data:T|null; label:string; url:string; cadence:string; degraded:boolean; attempts:Attempt[] };
type FeedStatus = "live"|"available"|"degraded"|"unavailable";
type SourceState = { id:"crypto"|"ecb"|"rates"|"cftc"|"breadth"|"volatility"; label:string; cadence:string; status:FeedStatus; asOf:string|null; sourceUrl:string; route:"primary"|"fallback"|"unavailable"; detail:string; attempts:Attempt[] };

const SOURCE_URLS={
  coinbase:"https://docs.cdp.coinbase.com/exchange/introduction/welcome",
  kraken:"https://docs.kraken.com/api-reference/market-data/get-ticker-information",
  ecb:"https://data.ecb.europa.eu/help/api/data-examples",
  treasury:"https://home.treasury.gov/treasury-daily-interest-rate-xml-feed",
  fred:"https://fred.stlouisfed.org/series/DGS10",
  cftc:"https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm",
  nasdaqBreadth:"https://www.nasdaqtrader.com/Trader.aspx?id=DailyMarketFiles",
  cboeVolatility:"https://www.cboe.com/tradable-products/vix/term-structure/",
  fredVolatility:"https://fred.stlouisfed.org/series/VIXCLS",
};

const record=(value:unknown):Record<string,unknown>=>value&&typeof value==="object"?value as Record<string,unknown>:{};
const list=<T,>(value:T|T[]|undefined):T[]=>value===undefined?[]:Array.isArray(value)?value:[value];
const scalar=(value:unknown):unknown=>value&&typeof value==="object"&&"#text" in record(value)?record(value)["#text"]:value;
const number=(value:unknown)=>{const parsed=Number(String(scalar(value)??"").replace(/,/g,"").trim());return Number.isFinite(parsed)?parsed:null;};
const signed=(value:number|null,suffix="%")=>value===null?"—":`${value>=0?"+":"−"}${Math.abs(value).toFixed(2)}${suffix}`;
const errorDetail=(error:unknown)=>{if(!(error instanceof Error))return "unknown upstream failure";if(error.name==="TimeoutError"||error.name==="AbortError")return "8s timeout";return error.message.replace(/https?:\/\/[^\s]+/g,"upstream").slice(0,90);};
const fetchText=async(url:string,timeoutMs=8000)=>{const response=await fetch(url,{headers:{Accept:"application/json, text/csv, application/xml, text/plain, application/octet-stream, */*","User-Agent":"Atlas-Market-Intelligence/1.0 (public-data monitor)"},cache:"no-store",signal:AbortSignal.timeout(timeoutMs)});if(!response.ok)throw new Error(`HTTP ${response.status} from ${new URL(url).hostname}`);return response.text();};

async function failover<T>(providers:Provider<T>[]):Promise<FeedResult<T>>{
  const attempts:Attempt[]=[];
  for(let index=0;index<providers.length;index+=1){const provider=providers[index];try{const data=await provider.load();attempts.push({provider:provider.label,status:"ok",detail:index===0?"primary responded":"fallback responded"});return{data,label:provider.label,url:provider.url,cadence:provider.cadence,degraded:index>0,attempts};}catch(error){attempts.push({provider:provider.label,status:"failed",detail:errorDetail(error)});}}
  const last=providers.at(-1)!;return{data:null,label:providers.map((provider)=>provider.label).join(" / "),url:last.url,cadence:last.cadence,degraded:false,attempts};
}

const csvRows=(input:string)=>{const rows:string[][]=[];let row:string[]=[];let field="";let quoted=false;for(let index=0;index<input.length;index+=1){const character=input[index];if(character==='"'){if(quoted&&input[index+1]==='"'){field+='"';index+=1;}else quoted=!quoted;}else if(character===","&&!quoted){row.push(field.trim());field="";}else if((character==="\n"||character==="\r")&&!quoted){if(character==="\r"&&input[index+1]==="\n")index+=1;row.push(field.trim());field="";if(row.some(Boolean))rows.push(row);row=[];}else field+=character;}if(field||row.length){row.push(field.trim());rows.push(row);}return rows;};
const normalizedHeader=(value:string)=>value.toUpperCase().replace(/[^A-Z0-9]/g,"");
const clamp=(value:number,min=0,max=100)=>Math.min(max,Math.max(min,value));

async function coinbaseQuotes():Promise<{quotes:Quote[];asOf:string}>{
  const products=[{id:"BTC-USD",label:"Bitcoin",digits:0},{id:"ETH-USD",label:"Ethereum",digits:0},{id:"SOL-USD",label:"Solana",digits:2}];
  const quotes=await Promise.all(products.map(async product=>{const[tickerText,statsText]=await Promise.all([fetchText(`https://api.exchange.coinbase.com/products/${product.id}/ticker`),fetchText(`https://api.exchange.coinbase.com/products/${product.id}/stats`)]);const ticker=JSON.parse(tickerText) as Record<string,unknown>;const stats=JSON.parse(statsText) as Record<string,unknown>;const price=number(ticker.price);const open=number(stats.open);if(price===null)throw new Error(`missing ${product.id} quote`);const change=open&&open!==0?((price-open)/open)*100:null;const asOf=typeof ticker.time==="string"?ticker.time:new Date().toISOString();return{id:product.id,label:product.label,value:price,display:`$${price.toLocaleString("en-US",{maximumFractionDigits:product.digits})}`,change,changeDisplay:signed(change),asOf,source:"Coinbase Exchange",sourceUrl:SOURCE_URLS.coinbase,cadence:"Real-time public market feed"} satisfies Quote;}));
  return{quotes,asOf:quotes.map(quote=>quote.asOf).sort().at(-1)??new Date().toISOString()};
}

async function krakenQuotes():Promise<{quotes:Quote[];asOf:string}>{
  const payload=JSON.parse(await fetchText("https://api.kraken.com/0/public/Ticker?pair=XBTUSD,ETHUSD,SOLUSD")) as {error?:unknown[];result?:Record<string,unknown>};
  if(payload.error?.length||!payload.result)throw new Error(`Kraken payload error: ${String(payload.error?.[0]??"missing result")}`);
  const entries=Object.entries(payload.result);const asOf=new Date().toISOString();const products=[{id:"BTC-USD",label:"Bitcoin",needle:"XBT",digits:0},{id:"ETH-USD",label:"Ethereum",needle:"ETH",digits:0},{id:"SOL-USD",label:"Solana",needle:"SOL",digits:2}];
  const quotes=products.map(product=>{const ticker=record(entries.find(([key])=>key.includes(product.needle)&&key.includes("USD"))?.[1]);const price=number(list<unknown>(ticker.c)[0]);const open=number(ticker.o);if(price===null)throw new Error(`missing Kraken ${product.id} quote`);const change=open&&open!==0?((price-open)/open)*100:null;return{id:product.id,label:product.label,value:price,display:`$${price.toLocaleString("en-US",{maximumFractionDigits:product.digits})}`,change,changeDisplay:signed(change),asOf,source:"Kraken Spot (fallback)",sourceUrl:SOURCE_URLS.kraken,cadence:"Real-time quote; timestamped at retrieval"} satisfies Quote;});
  return{quotes,asOf};
}

async function ecbQuotes():Promise<{quotes:Quote[];asOf:string}>{
  const rows=csvRows(await fetchText("https://data-api.ecb.europa.eu/service/data/EXR/D.USD+GBP+JPY.EUR.SP00.A?lastNObservations=2&format=csvdata"));const headers=rows.shift()?.map(header=>header.toUpperCase())??[];const index=(name:string)=>headers.indexOf(name);const currencyIndex=index("CURRENCY"),dateIndex=index("TIME_PERIOD"),valueIndex=index("OBS_VALUE");if(currencyIndex<0||dateIndex<0||valueIndex<0)throw new Error("unexpected ECB response");const byCurrency=new Map<string,Array<{date:string;value:number}>>();for(const row of rows){const value=number(row[valueIndex]);if(value===null)continue;const currency=row[currencyIndex];byCurrency.set(currency,[...(byCurrency.get(currency)??[]),{date:row[dateIndex],value}]);}const labelFor:Record<string,string>={USD:"EUR / USD",GBP:"EUR / GBP",JPY:"EUR / JPY"};const quotes=[...byCurrency.entries()].flatMap(([currency,observations])=>{const ordered=observations.sort((left,right)=>left.date.localeCompare(right.date));const latest=ordered.at(-1),previous=ordered.at(-2);if(!latest)return[];const change=previous&&previous.value!==0?((latest.value-previous.value)/previous.value)*100:null;return[{id:`EUR-${currency}`,label:labelFor[currency]??`EUR / ${currency}`,value:latest.value,display:latest.value.toLocaleString("en-US",{minimumFractionDigits:currency==="JPY"?2:4,maximumFractionDigits:currency==="JPY"?2:4}),change,changeDisplay:signed(change),asOf:`${latest.date}T16:00:00Z`,source:"European Central Bank",sourceUrl:SOURCE_URLS.ecb,cadence:"Daily reference rate"} satisfies Quote];});const asOf=quotes.map(quote=>quote.asOf).sort().at(-1);if(!asOf||!quotes.length)throw new Error("no ECB observations");return{quotes,asOf};
}

type Rates={quotes:Quote[];asOf:string;curve:{twoTen:number|null;threeMonthTen:number|null}};

async function treasuryQuotes():Promise<Rates>{
  const year=new Date().getUTCFullYear();const url=`https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=${year}`;const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:"@",removeNSPrefix:true,parseTagValue:false});const feed=record(parser.parse(await fetchText(url)).feed);const observations=list(feed.entry).flatMap(entry=>{const item=record(entry);const properties=record(record(item.content).properties);const date=String(scalar(properties.NEW_DATE??properties.Date??item.updated)??"");return date&&date!=="[object Object]"?[{date,properties}]:[];}).sort((left,right)=>left.date.localeCompare(right.date));const latest=observations.at(-1),previous=observations.at(-2);if(!latest)throw new Error("no Treasury observations");const maturities=[{id:"US-2Y",label:"US 2Y",field:"BC_2YEAR"},{id:"US-10Y",label:"US 10Y",field:"BC_10YEAR"},{id:"US-30Y",label:"US 30Y",field:"BC_30YEAR"}];const quotes=maturities.flatMap(({id,label,field})=>{const value=number(latest.properties[field]);if(value===null)return[];const prior=previous?number(previous.properties[field]):null;const change=prior===null?null:(value-prior)*100;return[{id,label,value,display:`${value.toFixed(2)}%`,change,changeDisplay:signed(change," bp"),asOf:new Date(latest.date).toISOString(),source:"U.S. Treasury",sourceUrl:SOURCE_URLS.treasury,cadence:"Daily close, about 3:30 PM ET"} satisfies Quote];});if(quotes.length<3)throw new Error("incomplete Treasury curve");const two=number(latest.properties.BC_2YEAR),ten=number(latest.properties.BC_10YEAR),threeMonth=number(latest.properties.BC_3MONTH);return{quotes,asOf:quotes[0].asOf,curve:{twoTen:two===null||ten===null?null:(ten-two)*100,threeMonthTen:threeMonth===null||ten===null?null:(ten-threeMonth)*100}};
}

async function fredRates():Promise<Rates>{
  const start=new Date(Date.now()-45*24*60*60*1000).toISOString().slice(0,10);const rows=csvRows(await fetchText(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS3MO,DGS2,DGS10,DGS30&cosd=${start}`));const headers=rows.shift()?.map(header=>header.toUpperCase())??[];const dateIndex=headers.findIndex(header=>header==="OBSERVATION_DATE"||header==="DATE");const indexes={threeMonth:headers.indexOf("DGS3MO"),two:headers.indexOf("DGS2"),ten:headers.indexOf("DGS10"),thirty:headers.indexOf("DGS30")};if(dateIndex<0||Object.values(indexes).some(index=>index<0))throw new Error("unexpected FRED response");const complete=rows.flatMap(row=>{const values={threeMonth:number(row[indexes.threeMonth]),two:number(row[indexes.two]),ten:number(row[indexes.ten]),thirty:number(row[indexes.thirty])};return Object.values(values).every(value=>value!==null)?[{date:row[dateIndex],values:values as {threeMonth:number;two:number;ten:number;thirty:number}}]:[];}).sort((left,right)=>left.date.localeCompare(right.date));const latest=complete.at(-1),previous=complete.at(-2);if(!latest)throw new Error("no complete FRED curve");const asOf=`${latest.date}T20:00:00Z`;const configs=[{id:"US-2Y",label:"US 2Y",field:"two" as const},{id:"US-10Y",label:"US 10Y",field:"ten" as const},{id:"US-30Y",label:"US 30Y",field:"thirty" as const}];const quotes=configs.map(({id,label,field})=>{const value=latest.values[field],prior=previous?.values[field]??null,change=prior===null?null:(value-prior)*100;return{id,label,value,display:`${value.toFixed(2)}%`,change,changeDisplay:signed(change," bp"),asOf,source:"FRED / Federal Reserve (fallback)",sourceUrl:SOURCE_URLS.fred,cadence:"Daily H.15 observation"} satisfies Quote;});return{quotes,asOf,curve:{twoTen:(latest.values.ten-latest.values.two)*100,threeMonthTen:(latest.values.ten-latest.values.threeMonth)*100}};
}

type Breadth={asOf:string;advances:number;declines:number;unchanged:number;participation:number;netAdvances:number;advanceDeclineRatio:number};

async function nasdaqBreadth():Promise<Breadth>{
  const year=new Date().getUTCFullYear();
  const rows=csvRows(await fetchText(`https://www.nasdaqtrader.com/dynamic/dailyfiles/daily${year}.csv`,15000));
  const headers=rows.shift()?.map(normalizedHeader)??[];
  const find=(...needles:string[])=>headers.findIndex(header=>needles.some(needle=>header===needle||header.endsWith(needle)));
  const dateIndex=find("TRADEDATE","DATE"),advancesIndex=find("NASDAQADVANCES","ADVANCES"),declinesIndex=find("NASDAQDECLINES","DECLINES"),unchangedIndex=find("NASDAQUNCHANGED","UNCHANGED");
  if([dateIndex,advancesIndex,declinesIndex,unchangedIndex].some(index=>index<0))throw new Error("unexpected Nasdaq breadth response");
  const observations=rows.flatMap(row=>{const advances=number(row[advancesIndex]),declines=number(row[declinesIndex]),unchanged=number(row[unchangedIndex]);const date=row[dateIndex];return date&&advances!==null&&declines!==null&&unchanged!==null?[{date,advances,declines,unchanged}]:[];}).sort((left,right)=>Date.parse(left.date)-Date.parse(right.date));
  const latest=observations.at(-1);if(!latest)throw new Error("no Nasdaq breadth observation");
  const directional=latest.advances+latest.declines;if(!directional)throw new Error("empty Nasdaq breadth universe");
  return{asOf:new Date(`${new Date(latest.date).toISOString().slice(0,10)}T21:00:00Z`).toISOString(),advances:latest.advances,declines:latest.declines,unchanged:latest.unchanged,participation:(latest.advances/directional)*100,netAdvances:latest.advances-latest.declines,advanceDeclineRatio:latest.advances/latest.declines};
}

type Volatility={asOf:string;points:Array<{id:string;label:string;value:number}>;frontBackSpread:number;shape:"contango"|"flat"|"backwardation"};

async function cboeVolatility():Promise<Volatility>{
  const series=[{id:"VIX9D",label:"9D"},{id:"VIX",label:"30D"},{id:"VIX3M",label:"3M"},{id:"VIX6M",label:"6M"}];
  const observations=await Promise.all(series.map(async item=>{const rows=csvRows(await fetchText(`https://cdn.cboe.com/api/global/us_indices/daily_prices/${item.id}_History.csv`));const headers=rows.shift()?.map(normalizedHeader)??[];const dateIndex=headers.indexOf("DATE"),closeIndex=headers.indexOf("CLOSE");if(dateIndex<0||closeIndex<0)throw new Error(`unexpected Cboe ${item.id} response`);const valid=rows.flatMap(row=>{const value=number(row[closeIndex]);return row[dateIndex]&&value!==null?[{date:row[dateIndex],value}]:[];}).sort((left,right)=>Date.parse(left.date)-Date.parse(right.date));const latest=valid.at(-1);if(!latest)throw new Error(`no Cboe ${item.id} observation`);return{...item,...latest};}));
  const oldestDate=observations.map(item=>new Date(item.date).getTime()).sort((a,b)=>a-b)[0];
  const vix=observations.find(item=>item.id==="VIX")!.value,vix3m=observations.find(item=>item.id==="VIX3M")!.value;
  const spread=vix3m-vix;return{asOf:new Date(oldestDate+21*60*60*1000).toISOString(),points:observations.map(({id,label,value})=>({id,label,value})),frontBackSpread:spread,shape:Math.abs(spread)<0.25?"flat":spread>0?"contango":"backwardation"};
}

async function fredVolatility():Promise<Volatility>{
  const start=new Date(Date.now()-30*24*60*60*1000).toISOString().slice(0,10);
  const rows=csvRows(await fetchText(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=VIXCLS,VXVCLS&cosd=${start}`));
  const headers=rows.shift()?.map(normalizedHeader)??[];const dateIndex=headers.findIndex(header=>header==="OBSERVATIONDATE"||header==="DATE"),vixIndex=headers.indexOf("VIXCLS"),vix3mIndex=headers.indexOf("VXVCLS");
  if([dateIndex,vixIndex,vix3mIndex].some(index=>index<0))throw new Error("unexpected FRED volatility response");
  const complete=rows.flatMap(row=>{const vix=number(row[vixIndex]),vix3m=number(row[vix3mIndex]);return row[dateIndex]&&vix!==null&&vix3m!==null?[{date:row[dateIndex],vix,vix3m}]:[];}).sort((left,right)=>left.date.localeCompare(right.date));
  const latest=complete.at(-1);if(!latest)throw new Error("no complete FRED volatility curve");const spread=latest.vix3m-latest.vix;
  return{asOf:`${latest.date}T21:00:00Z`,points:[{id:"VIX",label:"30D",value:latest.vix},{id:"VIX3M",label:"3M",value:latest.vix3m}],frontBackSpread:spread,shape:Math.abs(spread)<0.25?"flat":spread>0?"contango":"backwardation"};
}

function regimeProxy(breadth:Breadth|null,volatility:Volatility|null,rates:Rates|null,crypto:{quotes:Quote[];asOf:string}|null){
  if(!breadth||!volatility||!rates)return null;
  const vix=volatility.points.find(point=>point.id==="VIX")?.value??0;
  const vix3m=volatility.points.find(point=>point.id==="VIX3M")?.value??vix;
  const btcChange=crypto?.quotes.find(quote=>quote.id==="BTC-USD")?.change??null;
  const components:Record<string,number>={breadth:clamp(breadth.participation),volatility:clamp(50+((vix3m-vix)/Math.max(vix,1))*250),curve:clamp(50+(rates.curve.twoTen??0)/4)};
  const weights:Record<string,number>=btcChange===null?{breadth:.45,volatility:.35,curve:.2}:{breadth:.4,volatility:.3,curve:.2,crypto:.1};
  if(btcChange!==null)components.crypto=clamp(50+btcChange*5);
  const score=Math.round(Object.entries(components).reduce((total,[key,value])=>total+value*weights[key],0));
  const label=score>=65?"Broad risk participation":score>=45?"Mixed conditions":"Defensive conditions";
  const asOf=[breadth.asOf,volatility.asOf,rates.asOf,...(crypto?[crypto.asOf]:[])].sort().at(0)!;
  return{score,label,asOf,components,method:btcChange===null?"45% Nasdaq breadth · 35% Cboe vol curve · 20% 2s10s":"40% Nasdaq breadth · 30% Cboe vol curve · 20% 2s10s · 10% BTC 24h"};
}

async function cftcPositioning(){const rows=csvRows(await fetchText("https://www.cftc.gov/dea/newcot/FinFutWk.txt"));const row=rows.find(candidate=>candidate[0]?.startsWith("S&P 500 Consolidated"));if(!row)throw new Error("S&P 500 CFTC row unavailable");const leveragedLong=number(row[14]),leveragedShort=number(row[15]),assetManagerLong=number(row[11]),assetManagerShort=number(row[12]),openInterest=number(row[7]);if([leveragedLong,leveragedShort,assetManagerLong,assetManagerShort,openInterest].some(value=>value===null))throw new Error("incomplete CFTC row");return{label:"S&P 500 consolidated futures",leveragedNet:leveragedLong!-leveragedShort!,assetManagerNet:assetManagerLong!-assetManagerShort!,openInterest:openInterest!,asOf:`${row[2]}T20:00:00Z`,source:"CFTC Traders in Financial Futures",sourceUrl:SOURCE_URLS.cftc,cadence:"Weekly; Tuesday positions released Friday"};}

const sourceState=<T extends {asOf:string}>(id:SourceState["id"],result:FeedResult<T>,live=false):SourceState=>{const failed=result.attempts.filter(attempt=>attempt.status==="failed");return{id,label:result.label,cadence:result.cadence,status:result.data?(result.degraded?"degraded":live?"live":"available"):"unavailable",asOf:result.data?.asOf??null,sourceUrl:result.url,route:result.data?(result.degraded?"fallback":"primary"):"unavailable",detail:result.degraded?`Fallback active after ${failed.map(attempt=>`${attempt.provider}: ${attempt.detail}`).join("; ")}`:result.data?"Primary provider healthy":failed.map(attempt=>`${attempt.provider}: ${attempt.detail}`).join("; "),attempts:result.attempts};};

export async function GET(){
  const fetchedAt=new Date().toISOString();
  const[crypto,ecb,rates,cftc,breadth,volatility]=await Promise.all([
    failover([{label:"Coinbase Exchange",url:SOURCE_URLS.coinbase,cadence:"Real time",load:coinbaseQuotes},{label:"Kraken Spot (fallback)",url:SOURCE_URLS.kraken,cadence:"Real time",load:krakenQuotes}]),
    failover([{label:"European Central Bank",url:SOURCE_URLS.ecb,cadence:"Daily",load:ecbQuotes}]),
    failover([{label:"U.S. Treasury",url:SOURCE_URLS.treasury,cadence:"Daily close",load:treasuryQuotes},{label:"FRED / Federal Reserve (fallback)",url:SOURCE_URLS.fred,cadence:"Daily H.15",load:fredRates}]),
    failover([{label:"CFTC positioning",url:SOURCE_URLS.cftc,cadence:"Weekly",load:cftcPositioning}]),
    failover([{label:"Nasdaq Daily Market Statistics",url:SOURCE_URLS.nasdaqBreadth,cadence:"Daily close",load:nasdaqBreadth}]),
    failover([{label:"Cboe Volatility Indices",url:SOURCE_URLS.cboeVolatility,cadence:"Daily close",load:cboeVolatility},{label:"FRED / Cboe VIX fallback",url:SOURCE_URLS.fredVolatility,cadence:"Daily close",load:fredVolatility}]),
  ]);
  const sources=[sourceState("crypto",crypto,true),sourceState("ecb",ecb),sourceState("rates",rates),sourceState("cftc",cftc),sourceState("breadth",breadth),sourceState("volatility",volatility)];const availableCount=sources.filter(source=>source.status!=="unavailable").length;const degraded=sources.some(source=>source.status==="degraded");
  const regime=regimeProxy(breadth.data,volatility.data,rates.data,crypto.data);
  return Response.json({fetchedAt,status:availableCount===6?(degraded?"degraded":"live"):availableCount?"partial":"unavailable",crypto:crypto.data?.quotes??[],fx:ecb.data?.quotes??[],treasury:rates.data?.quotes??[],curve:rates.data?.curve??{twoTen:null,threeMonthTen:null},positioning:cftc.data,breadth:breadth.data,volatility:volatility.data,regime,sources},{headers:{"Cache-Control":"public, s-maxage=15, stale-while-revalidate=120"}});
}
