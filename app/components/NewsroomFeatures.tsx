"use client";

import { useMemo } from "react";

export type FeatureStory={
  id:number;
  desk:"world"|"entertainment"|"sports";
  category:string;
  region:string;
  publishedAt:string;
  title:string;
  summary:string;
  source:string;
  articleUrl:string;
  tags:string[];
  location?:{name:string;lat:number;lng:number;precision:"country"|"hotspot"};
};

const relativeTime=(value:string)=>{
  const minutes=Math.max(0,Math.floor((Date.now()-Date.parse(value))/60000));
  if(minutes<1)return "just now";
  if(minutes<60)return `${minutes}m ago`;
  const hours=Math.floor(minutes/60);
  if(hours<24)return `${hours}h ago`;
  const days=Math.floor(hours/24);
  return days<7?`${days}d ago`:new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric"}).format(new Date(value));
};

export function StoryThreads({stories}:{stories:FeatureStory[]}){
  const threads=useMemo(()=>{
    const world=stories.filter((story)=>story.desk==="world");
    const groups=new Map<string,FeatureStory[]>();
    world.forEach((story)=>{
      const key=story.location?.name??story.category;
      groups.set(key,[...(groups.get(key)??[]),story]);
    });
    return [...groups.entries()].map(([label,items])=>({
      label,
      stories:[...items].sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)),
      sources:new Set(items.map((story)=>story.source)).size,
    })).filter((thread)=>thread.stories.length>=2).sort((a,b)=>(b.sources*3+b.stories.length)-(a.sources*3+a.stories.length)).slice(0,4);
  },[stories]);

  if(!threads.length)return null;
  return <section className="story-threads panel" aria-labelledby="story-threads-title">
    <div className="panel-heading feature-heading"><div><p>DEVELOPING STORY THREADS</p><h3 id="story-threads-title">Follow events, not duplicates</h3><span>Related publisher reports grouped by place or topic.</span></div><em>{threads.length} active threads</em></div>
    <div className="thread-grid">{threads.map((thread)=><article key={thread.label}>
      <header><span>{thread.label}</span><strong>{thread.stories.length} updates · {thread.sources} sources</strong></header>
      <a className="thread-lead" href={thread.stories[0].articleUrl} target="_blank" rel="noreferrer"><small>{thread.stories[0].source} · {relativeTime(thread.stories[0].publishedAt)}</small><h4>{thread.stories[0].title}</h4></a>
      <div>{thread.stories.slice(1,4).map((story)=><a key={story.id} href={story.articleUrl} target="_blank" rel="noreferrer"><time dateTime={story.publishedAt}>{relativeTime(story.publishedAt)}</time><span>{story.title}</span><small>{story.source}</small></a>)}</div>
    </article>)}</div>
  </section>;
}

const releaseGroups=[
  {label:"SCREEN",categories:new Set(["Film","Television","Streaming"])},
  {label:"SOUND",categories:new Set(["Music"])},
  {label:"PLAY & READ",categories:new Set(["Gaming","Books & Publishing"])},
  {label:"LIVE & AWARDS",categories:new Set(["Theatre","Awards","Arts & Design"])},
];

export function ReleaseRadar({stories}:{stories:FeatureStory[]}){
  const entries=useMemo(()=>releaseGroups.flatMap((group)=>{
    const candidates=stories.filter((story)=>story.desk==="entertainment"&&group.categories.has(story.category)).sort((a,b)=>{
      const release=(story:FeatureStory)=>/release|premiere|trailer|album|season|launch|festival|tour|award/i.test(`${story.title} ${story.summary}`)?1:0;
      return release(b)-release(a)||Date.parse(b.publishedAt)-Date.parse(a.publishedAt);
    });
    return candidates[0]?[{...group,story:candidates[0]}]:[];
  }),[stories]);
  if(!entries.length)return null;
  return <section className="desk-live-module release-radar" aria-labelledby="release-radar-title">
    <div className="desk-section-heading"><div><p>LIVE RELEASE COVERAGE</p><h2 id="release-radar-title">Release radar</h2></div><span>Publisher-reported launches, premieres and events</span></div>
    <div className="release-radar-grid">{entries.map(({label,story})=><article key={label}><span>{label}</span><small>{story.category} · {relativeTime(story.publishedAt)}</small><h3>{story.title}</h3><p>{story.summary}</p><a href={story.articleUrl} target="_blank" rel="noreferrer">{story.source} ↗</a></article>)}</div>
  </section>;
}

const tournamentRules=[
  ["World football",/world cup|champions league|premier league|la liga|bundesliga|serie a|football/i],
  ["Basketball",/\bnba\b|\bwnba\b|basketball|euroleague/i],
  ["American football",/\bnfl\b|super bowl|quarterback|touchdown/i],
  ["Baseball & hockey",/\bmlb\b|world series|baseball|\bnhl\b|stanley cup|hockey/i],
  ["Racing",/formula 1|\bf1\b|grand prix|motorsport|nascar|motogp/i],
  ["Tennis & golf",/wimbledon|grand slam|tennis|\bpga\b|golf|masters/i],
  ["Cricket & rugby",/cricket|\bt20\b|ashes|rugby|six nations/i],
] as const;

const matchState=(story:FeatureStory)=>/\blive\b|in progress/i.test(story.title)?"LIVE":/wins?|defeats?|beats?|final|champion|score/i.test(story.title)?"RESULT":/vs\.?|versus|fixture|schedule|face|meet/i.test(story.title)?"FIXTURE":"UPDATE";

export function SportsMatchHub({stories}:{stories:FeatureStory[]}){
  const sports=useMemo(()=>stories.filter((story)=>story.desk==="sports"&&!/\bbet(?:ting)?\b|\bodds\b|wager|sportsbook/i.test(`${story.title} ${story.summary}`)),[stories]);
  const matches=useMemo(()=>sports.filter((story)=>/\blive\b|wins?|defeats?|beats?|final|champion|score|match|game|fixture|vs\.?|versus|tournament/i.test(story.title)).slice(0,6),[sports]);
  const tournaments=useMemo(()=>tournamentRules.flatMap(([label,rule])=>{
    const related=sports.filter((story)=>rule.test(`${story.title} ${story.summary}`));
    return related.length?[{label,stories:related.slice(0,3)}]:[];
  }).sort((a,b)=>b.stories.length-a.stories.length).slice(0,6),[sports]);
  if(!matches.length&&!tournaments.length)return null;
  return <section className="desk-live-module sports-match-hub" aria-labelledby="match-centre-title">
    <div className="desk-section-heading"><div><p>FIXTURES / RESULTS / COMPETITIONS</p><h2 id="match-centre-title">Match Centre</h2></div><span>Source-first updates · no betting content</span></div>
    <div className="match-hub-grid"><div className="match-centre-list"><header><strong>Latest match coverage</strong><small>{matches.length} reports</small></header>{matches.map((story)=><a key={story.id} href={story.articleUrl} target="_blank" rel="noreferrer"><em className={matchState(story).toLowerCase()}>{matchState(story)}</em><span><small>{story.category} · {relativeTime(story.publishedAt)}</small><strong>{story.title}</strong><i>{story.source} ↗</i></span></a>)}</div>
      <aside className="tournament-hub"><header><strong>Tournament hub</strong><small>Active coverage clusters</small></header>{tournaments.map((tournament)=><article key={tournament.label}><div><strong>{tournament.label}</strong><span>{tournament.stories.length} current reports</span></div><a href={tournament.stories[0].articleUrl} target="_blank" rel="noreferrer">{tournament.stories[0].title} ↗</a></article>)}</aside>
    </div>
  </section>;
}
