import countries from "world-countries";

export type NewsRegion = "Canada" | "United States" | "Latin America & Caribbean" | "Middle East" | "Europe" | "Africa" | "South Asia" | "East Asia" | "Southeast Asia" | "Oceania & Pacific" | "Global";

export type LocationMatch = {
  name: string;
  lat: number;
  lng: number;
  precision: "country" | "hotspot";
  aliases: string[];
  region?: NewsRegion;
};

const hotspotLocations: LocationMatch[] = [
  {name:"Ottawa",lat:45.42,lng:-75.7,precision:"hotspot",aliases:["Ottawa"],region:"Canada"},
  {name:"Vancouver",lat:49.28,lng:-123.12,precision:"hotspot",aliases:["Vancouver"],region:"Canada"},
  {name:"Montreal",lat:45.5,lng:-73.57,precision:"hotspot",aliases:["Montreal","Montréal"],region:"Canada"},
  {name:"Calgary",lat:51.05,lng:-114.07,precision:"hotspot",aliases:["Calgary"],region:"Canada"},
  {name:"Edmonton",lat:53.55,lng:-113.49,precision:"hotspot",aliases:["Edmonton"],region:"Canada"},
  {name:"Winnipeg",lat:49.9,lng:-97.14,precision:"hotspot",aliases:["Winnipeg"],region:"Canada"},
  {name:"Halifax",lat:44.65,lng:-63.57,precision:"hotspot",aliases:["Halifax"],region:"Canada"},
  {name:"Regina",lat:50.45,lng:-104.62,precision:"hotspot",aliases:["Regina"],region:"Canada"},
  {name:"Saskatoon",lat:52.13,lng:-106.67,precision:"hotspot",aliases:["Saskatoon"],region:"Canada"},
  {name:"St. John's",lat:47.56,lng:-52.71,precision:"hotspot",aliases:["St. John's","St John’s","St Johns"],region:"Canada"},
  {name:"Yellowknife",lat:62.45,lng:-114.38,precision:"hotspot",aliases:["Yellowknife"],region:"Canada"},
  {name:"Whitehorse",lat:60.72,lng:-135.06,precision:"hotspot",aliases:["Whitehorse"],region:"Canada"},
  {name:"Iqaluit",lat:63.75,lng:-68.52,precision:"hotspot",aliases:["Iqaluit"],region:"Canada"},
  {name:"British Columbia",lat:53.73,lng:-127.65,precision:"hotspot",aliases:["British Columbia","B.C.","B.C"],region:"Canada"},
  {name:"Alberta",lat:54.5,lng:-115,precision:"hotspot",aliases:["Alberta"],region:"Canada"},
  {name:"Saskatchewan",lat:52.94,lng:-106.45,precision:"hotspot",aliases:["Saskatchewan"],region:"Canada"},
  {name:"Manitoba",lat:54,lng:-98,precision:"hotspot",aliases:["Manitoba"],region:"Canada"},
  {name:"Ontario",lat:50,lng:-85,precision:"hotspot",aliases:["Ontario"],region:"Canada"},
  {name:"Quebec",lat:52,lng:-71.5,precision:"hotspot",aliases:["Quebec","Québec"],region:"Canada"},
  {name:"New Brunswick",lat:46.5,lng:-66.5,precision:"hotspot",aliases:["New Brunswick"],region:"Canada"},
  {name:"Nova Scotia",lat:45,lng:-63,precision:"hotspot",aliases:["Nova Scotia"],region:"Canada"},
  {name:"Prince Edward Island",lat:46.5,lng:-63.4,precision:"hotspot",aliases:["Prince Edward Island","P.E.I.","PEI"],region:"Canada"},
  {name:"Newfoundland and Labrador",lat:53.14,lng:-57.66,precision:"hotspot",aliases:["Newfoundland and Labrador","Newfoundland","Labrador"],region:"Canada"},
  {name:"Northwest Territories",lat:64.83,lng:-124.85,precision:"hotspot",aliases:["Northwest Territories","N.W.T.","NWT"],region:"Canada"},
  {name:"Yukon",lat:64.28,lng:-135,precision:"hotspot",aliases:["Yukon"],region:"Canada"},
  {name:"Nunavut",lat:70.3,lng:-83.1,precision:"hotspot",aliases:["Nunavut"],region:"Canada"},
  {name:"Los Angeles",lat:34.05,lng:-118.24,precision:"hotspot",aliases:["Los Angeles","Hollywood"],region:"United States"},
  {name:"New York City",lat:40.71,lng:-74.01,precision:"hotspot",aliases:["New York City","New York"],region:"United States"},
  {name:"London",lat:51.51,lng:-0.13,precision:"hotspot",aliases:["London","Wembley"],region:"Europe"},
  {name:"Paris",lat:48.86,lng:2.35,precision:"hotspot",aliases:["Paris","Roland Garros"],region:"Europe"},
  {name:"Cannes",lat:43.55,lng:7.02,precision:"hotspot",aliases:["Cannes"],region:"Europe"},
  {name:"Toronto",lat:43.65,lng:-79.38,precision:"hotspot",aliases:["Toronto"]},
  {name:"Mumbai",lat:19.08,lng:72.88,precision:"hotspot",aliases:["Mumbai","Bollywood"],region:"South Asia"},
  {name:"Seoul",lat:37.57,lng:126.98,precision:"hotspot",aliases:["Seoul"],region:"East Asia"},
  {name:"Tokyo",lat:35.68,lng:139.69,precision:"hotspot",aliases:["Tokyo"],region:"East Asia"},
  {name:"Melbourne",lat:-37.81,lng:144.96,precision:"hotspot",aliases:["Melbourne"],region:"Oceania & Pacific"},
  {name:"Nashville",lat:36.16,lng:-86.78,precision:"hotspot",aliases:["Nashville"],region:"United States"},
  {name:"Honolulu",lat:21.31,lng:-157.86,precision:"hotspot",aliases:["Honolulu"],region:"United States"},
  {name:"Hawaii",lat:20.8,lng:-156.33,precision:"hotspot",aliases:["Hawaiian Islands","Hawaiian","Hawaii","Hawaiʻi"],region:"United States"},
  {name:"Maui",lat:20.8,lng:-156.33,precision:"hotspot",aliases:["Maui"],region:"United States"},
  {name:"Oahu",lat:21.44,lng:-158,precision:"hotspot",aliases:["Oahu","Oʻahu"],region:"United States"},
  {name:"Kauai",lat:22.1,lng:-159.53,precision:"hotspot",aliases:["Kauai","Kauaʻi"],region:"United States"},
  {name:"Gaza Strip",lat:31.45,lng:34.4,precision:"hotspot",aliases:["Gaza Strip","Gaza"],region:"Middle East"},
  {name:"West Bank",lat:31.95,lng:35.2,precision:"hotspot",aliases:["West Bank"],region:"Middle East"},
  {name:"Strait of Hormuz",lat:26.56,lng:56.25,precision:"hotspot",aliases:["Strait of Hormuz","Hormuz"],region:"Middle East"},
  {name:"Red Sea",lat:20,lng:38,precision:"hotspot",aliases:["Red Sea"],region:"Middle East"},
  {name:"Black Sea",lat:43,lng:34,precision:"hotspot",aliases:["Black Sea"],region:"Europe"},
  {name:"South China Sea",lat:13,lng:114,precision:"hotspot",aliases:["South China Sea"],region:"Southeast Asia"},
  {name:"Taiwan Strait",lat:24,lng:119.5,precision:"hotspot",aliases:["Taiwan Strait"],region:"East Asia"},
  {name:"Panama Canal",lat:9.08,lng:-79.68,precision:"hotspot",aliases:["Panama Canal"],region:"Latin America & Caribbean"},
  {name:"Suez Canal",lat:30.45,lng:32.35,precision:"hotspot",aliases:["Suez Canal"]},
  {name:"Strait of Malacca",lat:3.2,lng:101.3,precision:"hotspot",aliases:["Strait of Malacca","Malacca Strait"],region:"Southeast Asia"},
  {name:"Persian Gulf",lat:26.5,lng:52.5,precision:"hotspot",aliases:["Persian Gulf","Arabian Gulf"],region:"Middle East"},
  {name:"Gulf of Aden",lat:12.5,lng:47,precision:"hotspot",aliases:["Gulf of Aden"],region:"Middle East"},
  {name:"Horn of Africa",lat:8.7,lng:46.2,precision:"hotspot",aliases:["Horn of Africa"],region:"Africa"},
  {name:"Sahel",lat:15,lng:2,precision:"hotspot",aliases:["the Sahel","Sahel"],region:"Africa"},
  {name:"South Caucasus",lat:41.8,lng:44.5,precision:"hotspot",aliases:["South Caucasus"],region:"Europe"},
  {name:"Korean Peninsula",lat:38,lng:127.5,precision:"hotspot",aliases:["Korean Peninsula"],region:"East Asia"},
  {name:"Arctic",lat:75,lng:0,precision:"hotspot",aliases:["Arctic Circle","the Arctic","Arctic"]},
  {name:"Baltic Sea",lat:58,lng:20,precision:"hotspot",aliases:["Baltic Sea"]},
  {name:"Mediterranean Sea",lat:35,lng:18,precision:"hotspot",aliases:["Mediterranean Sea","Mediterranean"]},
  {name:"Caribbean",lat:18,lng:-75,precision:"hotspot",aliases:["Caribbean Sea","the Caribbean","Caribbean"],region:"Latin America & Caribbean"},
  {name:"Amazon Basin",lat:-4,lng:-62,precision:"hotspot",aliases:["Amazon Basin","Amazon rainforest","Amazon river","the Amazon"],region:"Latin America & Caribbean"},
  {name:"Pacific Islands",lat:-10,lng:-165,precision:"hotspot",aliases:["Pacific Islands","Pacific states"],region:"Oceania & Pacific"},
];

const countryRegion=(region:string,subregion:string,cca3:string):NewsRegion=>{
  if(cca3==="CAN")return "Canada";
  if(cca3==="USA")return "United States";
  if(subregion==="Western Asia")return "Middle East";
  if(region==="Europe")return "Europe";
  if(region==="Africa")return "Africa";
  if(region==="Oceania")return "Oceania & Pacific";
  if(region==="Americas")return "Latin America & Caribbean";
  if(subregion==="Southern Asia")return "South Asia";
  if(subregion==="Eastern Asia")return "East Asia";
  if(subregion==="South-eastern Asia")return "Southeast Asia";
  return "Global";
};

const countryLocations: LocationMatch[] = countries.flatMap((country) => {
  if (country.latlng.length < 2) return [];

  // Dataset altSpellings are not safe for prose matching. For example, Iceland
  // includes "Island", which falsely geolocates any ordinary island headline.
  const ambiguousCountryNames = new Set(["Chad","Georgia","Jordan"]);
  const aliases = [country.name.common,country.name.official]
    .filter((alias) => !ambiguousCountryNames.has(alias))
    .filter((alias) => alias.length >= 4 && !/^[A-Z]{2,3}$/.test(alias));
  if (country.cca3 === "TCD") aliases.push("Republic of Chad","Chadian","N'Djamena","N’Djamena");
  if (country.cca3 === "GEO") aliases.push("Georgian government","Georgian parliament","Tbilisi");
  if (country.cca3 === "JOR") aliases.push("Hashemite Kingdom of Jordan","Jordanian","Amman");
  if (country.cca3 === "COD") aliases.push("DR Congo","DRC");
  if (country.cca3 === "COG") aliases.push("Republic of Congo");
  if (country.cca3 === "USA") aliases.push("United States","U.S.","USA");
  if (country.cca3 === "GBR") aliases.push("United Kingdom","Britain","UK");
  if (country.cca3 === "KOR") aliases.push("South Korea");
  if (country.cca3 === "PRK") aliases.push("North Korea");
  if (country.cca3 === "TUR") aliases.push("Turkey");
  if (country.cca3 === "CIV") aliases.push("Ivory Coast");
  return [{name:country.name.common,lat:country.latlng[0],lng:country.latlng[1],precision:"country" as const,aliases,region:countryRegion(country.region,country.subregion,country.cca3)}];
});

const locationMatches = [...hotspotLocations,...countryLocations]
  .flatMap((location) => location.aliases.map((alias) => ({location,alias})))
  .sort((left,right) => right.alias.length-left.alias.length);

const escapePattern = (value:string) => value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");

export const locationMatchFor = (value:string):LocationMatch|undefined => {
  const match = locationMatches.find(({alias}) => {
    if (alias === "Paris" && /\bParis\s+Hilton\b/iu.test(value)) return false;
    if (alias === "Regina" && /\bRegina\s+King\b/iu.test(value)) return false;
    return new RegExp(`(^|[^\\p{L}])${escapePattern(alias)}(?=$|[^\\p{L}])`,"iu").test(value);
  });
  return match?.location;
};
