import { XMLParser } from "fast-xml-parser";

export const runtime = "edge";

type Quote = {
  id: string;
  label: string;
  value: number;
  display: string;
  change: number | null;
  changeDisplay: string;
  asOf: string;
  source: string;
  sourceUrl: string;
  cadence: string;
};

type SourceState = {
  id: "coinbase" | "ecb" | "treasury" | "cftc";
  label: string;
  cadence: string;
  status: "live" | "available" | "unavailable";
  asOf: string | null;
  sourceUrl: string;
};

const SOURCE_URLS = {
  coinbase: "https://docs.cdp.coinbase.com/exchange/introduction/welcome",
  ecb: "https://data.ecb.europa.eu/help/api/data-examples",
  treasury: "https://home.treasury.gov/treasury-daily-interest-rate-xml-feed",
  cftc: "https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm",
};

const number = (value: unknown) => {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
};
const signed = (value: number | null, suffix = "%") => value === null ? "—" : `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}${suffix}`;
const fetchText = async (url: string) => {
  const response = await fetch(url, {
    headers: { "Accept": "application/json, text/csv, application/xml, text/plain" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`${response.status} from ${new URL(url).hostname}`);
  return response.text();
};

const csvRows = (input: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"') {
      if (quoted && input[index + 1] === '"') { field += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(field.trim()); field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(field.trim()); field = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else field += character;
  }
  if (field || row.length) { row.push(field.trim()); rows.push(row); }
  return rows;
};

async function coinbaseQuotes(): Promise<{quotes: Quote[]; asOf: string}> {
  const products = [
    {id:"BTC-USD",label:"Bitcoin",digits:0},
    {id:"ETH-USD",label:"Ethereum",digits:0},
    {id:"SOL-USD",label:"Solana",digits:2},
  ];
  const quotes = await Promise.all(products.map(async (product) => {
    const [tickerText, statsText] = await Promise.all([
      fetchText(`https://api.exchange.coinbase.com/products/${product.id}/ticker`),
      fetchText(`https://api.exchange.coinbase.com/products/${product.id}/stats`),
    ]);
    const ticker = JSON.parse(tickerText) as Record<string, unknown>;
    const stats = JSON.parse(statsText) as Record<string, unknown>;
    const price = number(ticker.price);
    const open = number(stats.open);
    if (price === null) throw new Error(`Missing ${product.id} quote`);
    const change = open && open !== 0 ? ((price - open) / open) * 100 : null;
    const asOf = typeof ticker.time === "string" ? ticker.time : new Date().toISOString();
    return {
      id: product.id,
      label: product.label,
      value: price,
      display: `$${price.toLocaleString("en-US",{maximumFractionDigits:product.digits})}`,
      change,
      changeDisplay: signed(change),
      asOf,
      source: "Coinbase Exchange",
      sourceUrl: SOURCE_URLS.coinbase,
      cadence: "Real-time public market feed",
    } satisfies Quote;
  }));
  return {quotes, asOf: quotes.map((quote)=>quote.asOf).sort().at(-1) ?? new Date().toISOString()};
}

async function ecbQuotes(): Promise<{quotes: Quote[]; asOf: string}> {
  const url = "https://data-api.ecb.europa.eu/service/data/EXR/D.USD+GBP+JPY.EUR.SP00.A?lastNObservations=2&format=csvdata";
  const rows = csvRows(await fetchText(url));
  const headers = rows.shift()?.map((header)=>header.toUpperCase()) ?? [];
  const index = (name:string) => headers.indexOf(name);
  const currencyIndex = index("CURRENCY");
  const dateIndex = index("TIME_PERIOD");
  const valueIndex = index("OBS_VALUE");
  if (currencyIndex < 0 || dateIndex < 0 || valueIndex < 0) throw new Error("Unexpected ECB response");
  const byCurrency = new Map<string,Array<{date:string;value:number}>>();
  for (const row of rows) {
    const value = number(row[valueIndex]);
    if (value === null) continue;
    const currency = row[currencyIndex];
    byCurrency.set(currency,[...(byCurrency.get(currency) ?? []),{date:row[dateIndex],value}]);
  }
  const labelFor:Record<string,string>={USD:"EUR / USD",GBP:"EUR / GBP",JPY:"EUR / JPY"};
  const quotes = [...byCurrency.entries()].flatMap(([currency, observations]) => {
    const ordered = observations.sort((left,right)=>left.date.localeCompare(right.date));
    const latest = ordered.at(-1);
    const previous = ordered.at(-2);
    if (!latest) return [];
    const change = previous && previous.value !== 0 ? ((latest.value-previous.value)/previous.value)*100 : null;
    return [{
      id:`EUR-${currency}`,
      label:labelFor[currency] ?? `EUR / ${currency}`,
      value:latest.value,
      display:latest.value.toLocaleString("en-US",{minimumFractionDigits:currency==="JPY"?2:4,maximumFractionDigits:currency==="JPY"?2:4}),
      change,
      changeDisplay:signed(change),
      asOf:`${latest.date}T16:00:00Z`,
      source:"European Central Bank",
      sourceUrl:SOURCE_URLS.ecb,
      cadence:"Daily reference rate",
    } satisfies Quote];
  });
  const asOf = quotes.map((quote)=>quote.asOf).sort().at(-1);
  if (!asOf || !quotes.length) throw new Error("No ECB observations");
  return {quotes,asOf};
}

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
const list = <T,>(value:T|T[]|undefined):T[] => value === undefined ? [] : Array.isArray(value) ? value : [value];

async function treasuryQuotes(): Promise<{quotes: Quote[]; asOf: string; curve:{twoTen:number|null;threeMonthTen:number|null}}> {
  const year = new Date().getUTCFullYear();
  const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=${year}`;
  const parser = new XMLParser({ignoreAttributes:false,attributeNamePrefix:"@",removeNSPrefix:true,parseTagValue:false});
  const feed = record(parser.parse(await fetchText(url)).feed);
  const observations = list(feed.entry).flatMap((entry) => {
    const item = record(entry);
    const properties = record(record(item.content).properties);
    const date = String(properties.NEW_DATE ?? properties.Date ?? item.updated ?? "");
    return date ? [{date,properties}] : [];
  }).sort((left,right)=>left.date.localeCompare(right.date));
  const latest = observations.at(-1);
  const previous = observations.at(-2);
  if (!latest) throw new Error("No Treasury observations");
  const maturities = [
    {id:"US-2Y",label:"US 2Y",field:"BC_2YEAR"},
    {id:"US-10Y",label:"US 10Y",field:"BC_10YEAR"},
    {id:"US-30Y",label:"US 30Y",field:"BC_30YEAR"},
  ];
  const quotes = maturities.flatMap(({id,label,field}) => {
    const value = number(latest.properties[field]);
    if (value === null) return [];
    const prior = previous ? number(previous.properties[field]) : null;
    const change = prior === null ? null : (value-prior)*100;
    return [{
      id,label,value,display:`${value.toFixed(2)}%`,change,
      changeDisplay:signed(change," bp"),
      asOf:new Date(latest.date).toISOString(),
      source:"U.S. Treasury",
      sourceUrl:SOURCE_URLS.treasury,
      cadence:"Daily close, about 3:30 PM ET",
    } satisfies Quote];
  });
  const two = number(latest.properties.BC_2YEAR);
  const ten = number(latest.properties.BC_10YEAR);
  const threeMonth = number(latest.properties.BC_3MONTH);
  return {quotes,asOf:new Date(latest.date).toISOString(),curve:{twoTen:two===null||ten===null?null:(ten-two)*100,threeMonthTen:threeMonth===null||ten===null?null:(ten-threeMonth)*100}};
}

async function cftcPositioning() {
  const rows = csvRows(await fetchText("https://www.cftc.gov/dea/newcot/FinFutWk.txt"));
  const row = rows.find((candidate)=>candidate[0]?.startsWith("S&P 500 Consolidated"));
  if (!row) throw new Error("S&P 500 CFTC row unavailable");
  const leveragedLong = number(row[14]);
  const leveragedShort = number(row[15]);
  const assetManagerLong = number(row[11]);
  const assetManagerShort = number(row[12]);
  const openInterest = number(row[7]);
  if ([leveragedLong,leveragedShort,assetManagerLong,assetManagerShort,openInterest].some((value)=>value===null)) throw new Error("Incomplete CFTC row");
  return {
    label:"S&P 500 consolidated futures",
    leveragedNet:leveragedLong!-leveragedShort!,
    assetManagerNet:assetManagerLong!-assetManagerShort!,
    openInterest:openInterest!,
    asOf:`${row[2]}T20:00:00Z`,
    source:"CFTC Traders in Financial Futures",
    sourceUrl:SOURCE_URLS.cftc,
    cadence:"Weekly; Tuesday positions released Friday",
  };
}

export async function GET() {
  const fetchedAt = new Date().toISOString();
  const settled = await Promise.allSettled([coinbaseQuotes(),ecbQuotes(),treasuryQuotes(),cftcPositioning()]);
  const [coinbase,ecb,treasury,cftc] = settled.map((result)=>result.status==="fulfilled"?result.value:null);
  const configs:Array<Omit<SourceState,"status"|"asOf">> = [
    {id:"coinbase",label:"Coinbase Exchange",cadence:"Real time",sourceUrl:SOURCE_URLS.coinbase},
    {id:"ecb",label:"European Central Bank",cadence:"Daily",sourceUrl:SOURCE_URLS.ecb},
    {id:"treasury",label:"U.S. Treasury",cadence:"Daily close",sourceUrl:SOURCE_URLS.treasury},
    {id:"cftc",label:"CFTC positioning",cadence:"Weekly",sourceUrl:SOURCE_URLS.cftc},
  ];
  const values = [coinbase,ecb,treasury,cftc] as Array<{asOf:string}|null>;
  const sources = configs.map((config,index):SourceState=>({...config,status:values[index]?(config.id==="coinbase"?"live":"available"):"unavailable",asOf:values[index]?.asOf??null}));
  const availableCount = values.filter(Boolean).length;
  return Response.json({
    fetchedAt,
    status:availableCount===4?"live":availableCount?"partial":"unavailable",
    crypto:coinbase && "quotes" in coinbase ? coinbase.quotes : [],
    fx:ecb && "quotes" in ecb ? ecb.quotes : [],
    treasury:treasury && "quotes" in treasury ? treasury.quotes : [],
    curve:treasury && "curve" in treasury ? treasury.curve : {twoTen:null,threeMonthTen:null},
    positioning:cftc && "leveragedNet" in cftc ? cftc : null,
    sources,
  },{headers:{"Cache-Control":"public, s-maxage=15, stale-while-revalidate=120"}});
}
