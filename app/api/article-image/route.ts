export const runtime = "edge"; //

const SUCCESS_CACHE = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000";
const MISS_CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";
const FAILURE_CACHE = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";
const cachedText = (body:string,status:number,cacheControl:string) => new Response(body,{status,headers:{"Cache-Control":cacheControl}});

const publisherDomains = [
  "bbc.co.uk",
  "bbc.com",
  "theguardian.com",
  "aljazeera.com",
  "un.org",
  "npr.org",
  "politico.eu",
  "dw.com",
  "france24.com",
  "espn.com",
];

const isPublisherHost = (hostname:string) => publisherDomains.some((domain)=>hostname===domain||hostname.endsWith(`.${domain}`));
const decodeHtml = (value:string) => value
  .replace(/&#(x[\da-f]+|\d+);?/gi,(entity,code:string)=>{
    const point=code[0].toLowerCase()==="x"?Number.parseInt(code.slice(1),16):Number.parseInt(code,10);
    return Number.isInteger(point)&&point>0&&point<=0x10ffff?String.fromCodePoint(point):entity;
  })
  .replaceAll("&amp;","&").replaceAll("&quot;","\"").replaceAll("&apos;","'");

const attributes = (tag:string) => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g)].map((match)=>[match[1].toLowerCase(),decodeHtml(match[3].trim())]));

export function publisherImageFromHtml(html:string,articleUrl:string){
  const priorities=["og:image:secure_url","og:image","twitter:image","twitter:image:src"];
  const found=new Map<string,string>();
  for(const match of html.matchAll(/<meta\b[^>]*>/gi)){
    const attrs=attributes(match[0]);
    const name=(attrs.property??attrs.name??"").toLowerCase();
    if(priorities.includes(name)&&attrs.content)found.set(name,attrs.content);
  }
  for(const name of priorities){
    const candidate=found.get(name);
    if(candidate){
      try{return new URL(candidate,articleUrl).toString();}catch{/* try the next publisher candidate */}
    }
  }
  for(const match of html.matchAll(/<link\b[^>]*>/gi)){
    const attrs=attributes(match[0]);
    if(attrs.rel?.toLowerCase()==="image_src"&&attrs.href){
      try{return new URL(attrs.href,articleUrl).toString();}catch{/* no usable publisher image */}
    }
  }
  return null;
}

export async function GET(request:Request){
  const rawUrl=new URL(request.url).searchParams.get("url");
  if(!rawUrl)return cachedText("Missing article URL",400,MISS_CACHE);
  let articleUrl:URL;
  try{articleUrl=new URL(rawUrl);}catch{return cachedText("Invalid article URL",400,MISS_CACHE);}
  if(articleUrl.protocol!=="https:"||!isPublisherHost(articleUrl.hostname))return cachedText("Unsupported publisher",403,MISS_CACHE);

  try{
    const response=await fetch(articleUrl,{headers:{"User-Agent":"AtlasWorldNews/1.0 (+publisher image preview)",Accept:"text/html,application/xhtml+xml"},redirect:"follow",signal:AbortSignal.timeout(6500)});
    if(!response.ok)return cachedText("Publisher page unavailable",404,FAILURE_CACHE);
    const contentType=response.headers.get("content-type")??"";
    if(!contentType.includes("text/html")&&!contentType.includes("application/xhtml+xml"))return cachedText("Publisher page is not HTML",404,MISS_CACHE);
    const imageUrl=publisherImageFromHtml((await response.text()).slice(0,500_000),response.url);
    if(!imageUrl)return cachedText("Publisher image unavailable",404,MISS_CACHE);
    const parsedImage=new URL(imageUrl);
    if(parsedImage.protocol!=="https:"&&parsedImage.protocol!=="http:")return cachedText("Invalid publisher image",404,MISS_CACHE);
    return new Response(null,{status:302,headers:{Location:parsedImage.toString(),"Cache-Control":SUCCESS_CACHE}});
  }catch{
    return cachedText("Publisher image unavailable",404,FAILURE_CACHE);
  }
}
