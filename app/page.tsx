"use client";

import { useMemo, useState } from "react";

const briefings = [
  { region: "Middle East", time: "8m", level: "critical", title: "Hormuz uncertainty keeps energy markets on edge", source: "Reuters" },
  { region: "Europe", time: "24m", level: "elevated", title: "Grid investment moves to the center of EU security", source: "Reuters" },
  { region: "Asia Pacific", time: "41m", level: "watch", title: "Taiwan reviews resilience after major cyber incident", source: "FT" },
  { region: "Africa", time: "1h", level: "elevated", title: "Regional partners expand drought response capacity", source: "ReliefWeb" },
  { region: "Americas", time: "2h", level: "watch", title: "Inflation data resets the interest-rate outlook", source: "World Bank" },
];

const risks = [
  { label: "Energy security", value: 86, delta: "+12", tone: "red" },
  { label: "Maritime trade", value: 78, delta: "+08", tone: "orange" },
  { label: "Cyber activity", value: 64, delta: "+05", tone: "amber" },
  { label: "Food systems", value: 41, delta: "−03", tone: "blue" },
];

const events = [
  { name: "Strait of Hormuz", x: 59, y: 48, tone: "red" },
  { name: "Black Sea", x: 50, y: 34, tone: "orange" },
  { name: "Taiwan Strait", x: 83, y: 43, tone: "amber" },
  { name: "Sahel", x: 45, y: 56, tone: "orange" },
];

const imageUrl = "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Aerial_photograph_of_the_Port_of_Miami_Container_Port.jpg/1280px-Aerial_photograph_of_the_Port_of_Miami_Container_Port.jpg";

export default function Home() {
  const [region, setRegion] = useState("All regions");
  const [activeView, setActiveView] = useState("Overview");
  const [saved, setSaved] = useState(false);

  const visibleBriefings = useMemo(
    () => region === "All regions" ? briefings : briefings.filter((item) => item.region === region),
    [region],
  );

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#top" aria-label="Atlas home">
          <span className="brand-mark"><i /><i /><i /></span>
          <span>ATLAS<span className="brand-dot">.</span></span>
        </a>

        <nav className="primary-nav" aria-label="Primary navigation">
          <p className="nav-label">Intelligence</p>
          {["Overview", "Live events", "Countries", "Watchlist"].map((item, index) => (
            <button key={item} className={activeView === item ? "active" : ""} onClick={() => setActiveView(item)}>
              <span className="nav-glyph" aria-hidden>{["⌂", "⌁", "◎", "◇"][index]}</span>{item}
              {item === "Live events" && <span className="nav-count">12</span>}
            </button>
          ))}
          <p className="nav-label secondary">Analysis</p>
          {["Risk monitor", "Indicators", "Briefings"].map((item, index) => (
            <button key={item} className={activeView === item ? "active" : ""} onClick={() => setActiveView(item)}>
              <span className="nav-glyph" aria-hidden>{["△", "⌇", "▤"][index]}</span>{item}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sync-status"><span /> Data feeds operational</div>
          <div className="analyst-card">
            <div className="avatar">AR</div>
            <div><strong>Analyst workspace</strong><small>Global desk</small></div>
            <button aria-label="Workspace menu">•••</button>
          </div>
        </div>
      </aside>

      <section className="workspace" id="top">
        <header className="topbar">
          <div>
            <p className="eyebrow">GLOBAL INTELLIGENCE / <span>{activeView.toUpperCase()}</span></p>
            <h1>World overview</h1>
          </div>
          <div className="top-actions">
            <label className="search"><span>⌕</span><input aria-label="Search dashboard" placeholder="Search countries, events, topics" /><kbd>⌘ K</kbd></label>
            <button className="icon-button" aria-label="Notifications">◦<span className="notification-dot" /></button>
            <button className="refresh-button"><span>↻</span> Updated 2 min ago</button>
          </div>
        </header>

        <div className="dashboard-grid">
          <section className="hero-card">
            <div className="hero-image-wrap">
              <img src={imageUrl} alt="Aerial view of a container port and cargo ship" />
              <div className="hero-image-overlay" />
              <div className="hero-label"><span /> DEVELOPING</div>
              <div className="hero-caption">
                <p>ENERGY · MIDDLE EAST</p>
                <h2>Oil extends gains as uncertainty persists around a Hormuz agreement</h2>
                <div className="story-meta"><span>Reuters</span><span>12 min ago</span><span>5 min read</span></div>
              </div>
              <a className="image-credit" href="https://commons.wikimedia.org/wiki/File:Aerial_photograph_of_the_Port_of_Miami_Container_Port.jpg" target="_blank" rel="noreferrer">Image: James R. Tourtellotte / CBP · Public domain ↗</a>
            </div>
            <div className="hero-summary">
              <p>Investor focus remains on shipping access and energy supply as regional diplomacy continues. The effects are moving through freight, inflation and Gulf markets.</p>
              <div className="hero-summary-actions">
                <a href="https://www.reuters.com/world/middle-east/major-gulf-bourse-see-cautious-gains-tensions-weigh-sentiment-2026-08-12/" target="_blank" rel="noreferrer">Read source <span>↗</span></a>
                <button onClick={() => setSaved((value) => !value)} className={saved ? "saved" : ""}>{saved ? "◆ Saved" : "◇ Save briefing"}</button>
              </div>
            </div>
          </section>

          <aside className="risk-panel panel">
            <div className="panel-heading"><div><p>RISK PULSE</p><h3>Global pressure index</h3></div><button aria-label="Risk details">•••</button></div>
            <div className="risk-score"><strong>72</strong><div><span className="trend-up">↗ 8 pts</span><small>Elevated</small></div></div>
            <div className="sparkline" aria-label="Risk index trend over 12 hours">
              {[24,30,27,38,42,39,58,54,68,63,77,72].map((height, i) => <i key={i} style={{height: `${height}%`}} />)}
            </div>
            <p className="axis-label"><span>12H AGO</span><span>NOW</span></p>
            <div className="risk-list">
              {risks.map((risk) => <div key={risk.label}><div className="risk-row"><span><i className={risk.tone} />{risk.label}</span><strong>{risk.value}<em>{risk.delta}</em></strong></div><div className="risk-track"><i className={risk.tone} style={{width: `${risk.value}%`}} /></div></div>)}
            </div>
          </aside>

          <section className="map-panel panel">
            <div className="panel-heading map-heading"><div><p>LIVE SITUATION MAP</p><h3>Active geopolitical events</h3></div><div className="map-controls"><button className="active">Events</button><button>Risk</button><button>Trade</button></div></div>
            <div className="map-stage" role="img" aria-label="Abstract world map showing four active events">
              <div className="map-grid" />
              <div className="continent america" /><div className="continent europe" /><div className="continent africa" /><div className="continent asia" /><div className="continent oceania" />
              {events.map((event) => <button key={event.name} className={`map-pin ${event.tone}`} style={{left: `${event.x}%`, top: `${event.y}%`}}><span /><b>{event.name}</b></button>)}
              <div className="map-legend"><span><i className="red" /> Critical</span><span><i className="orange" /> Elevated</span><span><i className="amber" /> Watch</span></div>
              <div className="map-zoom"><button aria-label="Zoom in">+</button><button aria-label="Zoom out">−</button></div>
            </div>
          </section>

          <section className="briefing-panel panel">
            <div className="panel-heading"><div><p>NEWSROOM BRIEF</p><h3>Latest developments</h3></div><select value={region} onChange={(event) => setRegion(event.target.value)} aria-label="Filter briefings by region"><option>All regions</option>{briefings.map((item) => <option key={item.region}>{item.region}</option>)}</select></div>
            <div className="briefing-list">
              {visibleBriefings.map((item) => <article key={item.title}><div className="brief-time"><span className={item.level} />{item.time}</div><div><p>{item.region} · {item.source}</p><h4>{item.title}</h4></div><button aria-label={`Open ${item.title}`}>↗</button></article>)}
              {!visibleBriefings.length && <p className="empty-state">No developments in this region.</p>}
            </div>
            <button className="all-briefings">View all briefings <span>→</span></button>
          </section>

          <section className="signals-panel panel">
            <div className="panel-heading"><div><p>GLOBAL SIGNALS</p><h3>Markets & movement</h3></div><span className="live-indicator"><i /> LIVE</span></div>
            <div className="signal-grid">
              {[{k:"BRENT",v:"$89.49",d:"+0.6%",up:true},{k:"GOLD",v:"$2,482",d:"+1.2%",up:true},{k:"USD IDX",v:"103.8",d:"−0.3%",up:false},{k:"FREIGHT",v:"1,947",d:"+4.8%",up:true}].map((item) => <div key={item.k}><p>{item.k}</p><strong>{item.v}</strong><span className={item.up ? "up" : "down"}>{item.d}</span></div>)}
            </div>
            <div className="ticker"><span>WATCH</span><p>Strait transit volume remains well below the pre-crisis average</p></div>
          </section>
        </div>

        <footer><span>ATLAS Intelligence</span><span>Sources: Reuters · ReliefWeb · World Bank · Wikimedia Commons</span><span>12 Aug 2026 · 14:32 UTC</span></footer>
      </section>
    </main>
  );
}

