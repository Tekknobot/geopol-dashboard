import assert from "node:assert/strict";
import test from "node:test";
import {parseAirQuality,parseEonet,parseReliefWeb,parseWhoOutbreaks} from "../app/api/intelligence/route.ts";

test("air quality parser creates a mapped AQI signal",()=>{
  const events=parseAirQuality({current:{time:"2026-08-22T12:00",us_aqi:118,pm2_5:36.4,pm10:48.2}},[{name:"Toronto",country:"Canada",lat:43.65,lng:-79.38}]);
  assert.equal(events.length,1);
  assert.equal(events[0].layer,"Air quality");
  assert.equal(events[0].severity,"watch");
  assert.match(events[0].summary,/PM2\.5/);
});

test("EONET hazards receive distinct drought and landslide layers",()=>{
  const payload={events:[
    {id:"dry-1",title:"Regional drought",categories:[{title:"Drought"}],geometry:[{date:"2026-08-21",coordinates:[10,20]}]},
    {id:"slide-1",title:"Slope failure",categories:[{title:"Landslides"}],geometry:[{date:"2026-08-21",coordinates:[11,21]}]},
  ]};
  assert.deepEqual(parseEonet(payload).map((event)=>event.layer),["Droughts","Landslides"]);
});

test("ReliefWeb disasters map ISO3 countries to humanitarian signals",()=>{
  const events=parseReliefWeb({data:[{id:42,href:"https://api.reliefweb.int/v1/disasters/42",fields:{name:"Flood response",status:"ongoing",country:[{iso3:"CAN",name:"Canada"}],type:[{name:"Flood"}],date:{changed:"2026-08-21"}}}]});
  assert.equal(events.length,1);
  assert.equal(events[0].layer,"Humanitarian");
  assert.equal(events[0].location,"Canada");
});

test("WHO notices resolve named countries",()=>{
  const events=parseWhoOutbreaks({value:[{Title:"Disease update - Canada",Summary:"Public health monitoring update.",PublicationDateAndTime:new Date().toISOString(),ItemDefaultUrl:"/emergencies/disease-outbreak-news/item/example"}]});
  assert.equal(events.length,1);
  assert.equal(events[0].layer,"Outbreaks");
  assert.equal(events[0].location,"Canada");
});
