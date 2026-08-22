"use client";

const official={baseYear:2025,base:41.7,low2075:44.0,medium2075:57.4,high2075:75.8};
const interpolate=(target:number,end:number)=>official.base+(end-official.base)*Math.max(0,Math.min(1,(target-official.baseYear)/(2075-official.baseYear)));

export default function ProjectionsPanel({horizon,resilience,scenarioIntensity}:{horizon:number;resilience:number;scenarioIntensity:number}){
 const low=interpolate(horizon,official.low2075),mid=interpolate(horizon,official.medium2075),high=interpolate(horizon,official.high2075);
 const capacityPressure=Math.max(0,Math.round(((mid-official.base)/official.base)*100*1.65-scenarioIntensity*.18));
 const infrastructureLoad=Math.max(0,Math.round(((high-official.base)/official.base)*100*1.15-scenarioIntensity*.12));
 const resilienceGap=Math.max(0,Math.round(78-resilience));
 const points=[{label:"Low growth",value:low,tone:"low"},{label:"Medium M1",value:mid,tone:"mid"},{label:"High growth",value:high,tone:"high"}];
 const max=80,min=40;
 return <section className="projection-panel">
   <div className="sim-section-head"><div><span>07 / PROJECT</span><h3>Canada outlook to {horizon}</h3><p>Official Statistics Canada 2026 demographic scenario anchors combined with transparent Atlas capacity stress indicators.</p></div><a href="https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1710005701" target="_blank" rel="noreferrer">TABLE 17-10-0057-01 ↗</a></div>
   <div className="projection-layout">
     <div className="projection-chart" role="img" aria-label={`Population projection envelope to ${horizon}`}>
       <div className="projection-axis"><span>40M</span><span>50M</span><span>60M</span><span>70M</span><span>80M</span></div>
       {points.map(p=><div className="projection-row" key={p.label}><span>{p.label}</span><div><i className={p.tone} style={{width:`${Math.max(2,Math.min(100,((p.value-min)/(max-min))*100))}%`}}/><b>{p.value.toFixed(1)}M</b></div></div>)}
       <p><b>41.7M</b> 2025 base population. Statistics Canada publishes multiple scenarios and explicitly cautions that projections are not predictions.</p>
     </div>
     <div className="projection-risks">
       <article><span>CAPACITY PRESSURE</span><strong>{capacityPressure}</strong><meter min="0" max="100" value={capacityPressure}/><small>Population-growth load less current scenario intervention intensity.</small></article>
       <article><span>INFRASTRUCTURE LOAD</span><strong>{infrastructureLoad}</strong><meter min="0" max="100" value={infrastructureLoad}/><small>High-growth envelope translated into a directional national load signal.</small></article>
       <article><span>RESILIENCE GAP</span><strong>{resilienceGap}</strong><meter min="0" max="100" value={resilienceGap}/><small>Distance from Atlas reference resilience threshold of 78.</small></article>
     </div>
   </div>
 </section>;
}
