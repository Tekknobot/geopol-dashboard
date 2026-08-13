"use client";

import { useState } from "react";

type VideoSource = {
  id: string;
  name: string;
  channelUrl: string;
  uploadsPlaylistId: string;
  focus: string;
  region: string;
};

const VIDEO_SOURCES: VideoSource[] = [
  {
    id: "reuters",
    name: "Reuters",
    channelUrl: "https://www.youtube.com/@Reuters",
    uploadsPlaylistId: "UUhqUTb7kYRX8-EiaN3XFrSQ",
    focus: "Breaking news, diplomacy and global markets",
    region: "Global wire",
  },
  {
    id: "associated-press",
    name: "Associated Press",
    channelUrl: "https://www.youtube.com/@AssociatedPress",
    uploadsPlaylistId: "UU52X5wxOL_s5yw0dQk7NtgA",
    focus: "On-the-ground reporting and major world events",
    region: "Global wire",
  },
  {
    id: "dw-news",
    name: "DW News",
    channelUrl: "https://www.youtube.com/@dwnews",
    uploadsPlaylistId: "UUknLrEdhRCp1aegoMqRaCZg",
    focus: "European affairs, security and international analysis",
    region: "Europe / Global",
  },
  {
    id: "france-24",
    name: "France 24 English",
    channelUrl: "https://www.youtube.com/@France24_en",
    uploadsPlaylistId: "UUQfwfsi5VrQ8yKZ-UWmAEFg",
    focus: "International breaking news and regional coverage",
    region: "Europe / Global",
  },
];

export default function VideoNewsDesk() {
  const [activeId, setActiveId] = useState(VIDEO_SOURCES[0].id);
  const [playerLoaded, setPlayerLoaded] = useState(false);
  const activeSource =
    VIDEO_SOURCES.find((source) => source.id === activeId) ?? VIDEO_SOURCES[0];

  const selectSource = (id: string) => {
    setActiveId(id);
    setPlayerLoaded(false);
  };

  return (
    <section className="video-news-panel panel" id="video-intelligence-section">
      <div className="panel-heading video-news-heading">
        <div>
          <p>OFFICIAL PUBLISHER VIDEO</p>
          <h3>Video intelligence</h3>
          <span>Latest reporting from selected international newsrooms</span>
        </div>
        <div className="video-news-status">
          <i /> CLICK TO LOAD
        </div>
      </div>

      <div className="video-news-layout">
        <div className="video-player-shell">
          {playerLoaded ? (
            <iframe
              key={activeSource.id}
              src={`https://www.youtube.com/embed/videoseries?list=${activeSource.uploadsPlaylistId}&rel=0`}
              title={`${activeSource.name} latest video reports`}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <button
              className="video-consent"
              type="button"
              onClick={() => setPlayerLoaded(true)}
              aria-label={`Load the latest ${activeSource.name} video reports`}
            >
              <span className="video-play" aria-hidden>
                ▶
              </span>
              <span className="video-consent-copy">
                <small>{activeSource.region}</small>
                <strong>Load {activeSource.name} video desk</strong>
                <em>{activeSource.focus}</em>
              </span>
            </button>
          )}
        </div>

        <aside className="video-source-list" aria-label="Video publishers">
          <div className="video-source-label">
            <span>SELECT SOURCE</span>
            <small>{VIDEO_SOURCES.length} official channels</small>
          </div>
          {VIDEO_SOURCES.map((source) => (
            <button
              key={source.id}
              type="button"
              className={activeSource.id === source.id ? "active" : ""}
              onClick={() => selectSource(source.id)}
              aria-pressed={activeSource.id === source.id}
            >
              <i />
              <span>
                <strong>{source.name}</strong>
                <small>{source.focus}</small>
              </span>
              <em>→</em>
            </button>
          ))}
          <a href={activeSource.channelUrl} target="_blank" rel="noreferrer">
            Open {activeSource.name} on YouTube ↗
          </a>
        </aside>
      </div>

      <div className="video-news-note">
        <span>EMBED POLICY</span>
        <p>
          Playback stays inside the publisher&apos;s official YouTube player. Atlas
          does not copy, edit or rehost the footage; availability and advertising
          remain controlled by YouTube and the publisher.
        </p>
      </div>
    </section>
  );
}
