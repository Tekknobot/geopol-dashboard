import countries from "world-countries";

export type NewsRegion = "Middle East" | "Europe" | "Africa" | "Americas" | "Asia Pacific" | "Global";

export type LocationMatch = {
  name: string;
  lat: number;
  lng: number;
  precision: "country" | "hotspot";
  aliases: string[];
  region?: NewsRegion;
};

const hotspotLocations: LocationMatch[] = [
  {name:"Los Angeles",lat:34.05,lng:-118.24,precision:"hotspot",aliases:["Los Angeles","Hollywood"]},
  {name:"New York City",lat:40.71,lng:-74.01,precision:"hotspot",aliases:["New York City","New York"]},
  {name:"London",lat:51.51,lng:-0.13,precision:"hotspot",aliases:["London","Wembley"]},
  {name:"Paris",lat:48.86,lng:2.35,precision:"hotspot",aliases:["Paris","Roland Garros"]},
  {name:"Cannes",lat:43.55,lng:7.02,precision:"hotspot",aliases:["Cannes"]},
  {name:"Toronto",lat:43.65,lng:-79.38,precision:"hotspot",aliases:["Toronto"]},
  {name:"Mumbai",lat:19.08,lng:72.88,precision:"hotspot",aliases:["Mumbai","Bollywood"]},
  {name:"Seoul",lat:37.57,lng:126.98,precision:"hotspot",aliases:["Seoul"]},
  {name:"Tokyo",lat:35.68,lng:139.69,precision:"hotspot",aliases:["Tokyo"]},
  {name:"Melbourne",lat:-37.81,lng:144.96,precision:"hotspot",aliases:["Melbourne"]},
  {name:"Nashville",lat:36.16,lng:-86.78,precision:"hotspot",aliases:["Nashville"]},
  {name:"Honolulu",lat:21.31,lng:-157.86,precision:"hotspot",aliases:["Honolulu"]},
  {name:"Hawaii",lat:20.8,lng:-156.33,precision:"hotspot",aliases:["Hawaiian Islands","Hawaiian","Hawaii","Hawaiʻi"]},
  {name:"Maui",lat:20.8,lng:-156.33,precision:"hotspot",aliases:["Maui"]},
  {name:"Oahu",lat:21.44,lng:-158,precision:"hotspot",aliases:["Oahu","Oʻahu"]},
  {name:"Kauai",lat:22.1,lng:-159.53,precision:"hotspot",aliases:["Kauai","Kauaʻi"]},
  {name:"Gaza Strip",lat:31.45,lng:34.4,precision:"hotspot",aliases:["Gaza Strip","Gaza"]},
  {name:"West Bank",lat:31.95,lng:35.2,precision:"hotspot",aliases:["West Bank"]},
  {name:"Strait of Hormuz",lat:26.56,lng:56.25,precision:"hotspot",aliases:["Strait of Hormuz","Hormuz"]},
  {name:"Red Sea",lat:20,lng:38,precision:"hotspot",aliases:["Red Sea"]},
  {name:"Black Sea",lat:43,lng:34,precision:"hotspot",aliases:["Black Sea"]},
  {name:"South China Sea",lat:13,lng:114,precision:"hotspot",aliases:["South China Sea"]},
  {name:"Taiwan Strait",lat:24,lng:119.5,precision:"hotspot",aliases:["Taiwan Strait"]},
  {name:"Panama Canal",lat:9.08,lng:-79.68,precision:"hotspot",aliases:["Panama Canal"]},
  {name:"Suez Canal",lat:30.45,lng:32.35,precision:"hotspot",aliases:["Suez Canal"]},
  {name:"Strait of Malacca",lat:3.2,lng:101.3,precision:"hotspot",aliases:["Strait of Malacca","Malacca Strait"]},
  {name:"Persian Gulf",lat:26.5,lng:52.5,precision:"hotspot",aliases:["Persian Gulf","Arabian Gulf"]},
  {name:"Gulf of Aden",lat:12.5,lng:47,precision:"hotspot",aliases:["Gulf of Aden"]},
  {name:"Horn of Africa",lat:8.7,lng:46.2,precision:"hotspot",aliases:["Horn of Africa"]},
  {name:"Sahel",lat:15,lng:2,precision:"hotspot",aliases:["the Sahel","Sahel"]},
  {name:"South Caucasus",lat:41.8,lng:44.5,precision:"hotspot",aliases:["South Caucasus"]},
  {name:"Korean Peninsula",lat:38,lng:127.5,precision:"hotspot",aliases:["Korean Peninsula"]},
  {name:"Arctic",lat:75,lng:0,precision:"hotspot",aliases:["Arctic Circle","the Arctic","Arctic"]},
  {name:"Baltic Sea",lat:58,lng:20,precision:"hotspot",aliases:["Baltic Sea"]},
  {name:"Mediterranean Sea",lat:35,lng:18,precision:"hotspot",aliases:["Mediterranean Sea","Mediterranean"]},
  {name:"Caribbean",lat:18,lng:-75,precision:"hotspot",aliases:["Caribbean Sea","the Caribbean","Caribbean"]},
  {name:"Amazon Basin",lat:-4,lng:-62,precision:"hotspot",aliases:["Amazon Basin","Amazon rainforest","Amazon river","the Amazon"]},
  {name:"Pacific Islands",lat:-10,lng:-165,precision:"hotspot",aliases:["Pacific Islands","Pacific states"]},
];

const countryRegion=(region:string,subregion:string):NewsRegion=>{
  if(subregion==="Western Asia")return "Middle East";
  if(region==="Europe")return "Europe";
  if(region==="Africa")return "Africa";
  if(region==="Americas")return "Americas";
  if(region==="Asia"||region==="Oceania")return "Asia Pacific";
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
  return [{name:country.name.common,lat:country.latlng[0],lng:country.latlng[1],precision:"country" as const,aliases,region:countryRegion(country.region,country.subregion)}];
});

const locationMatches = [...hotspotLocations,...countryLocations]
  .flatMap((location) => location.aliases.map((alias) => ({location,alias})))
  .sort((left,right) => right.alias.length-left.alias.length);

const escapePattern = (value:string) => value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");

export const locationMatchFor = (value:string):LocationMatch|undefined => {
  const match = locationMatches.find(({alias}) => {
    if (alias === "Paris" && /\bParis\s+Hilton\b/iu.test(value)) return false;
    return new RegExp(`(^|[^\\p{L}])${escapePattern(alias)}(?=$|[^\\p{L}])`,"iu").test(value);
  });
  return match?.location;
};
