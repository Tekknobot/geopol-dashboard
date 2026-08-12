"use client";

import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
} from "react-leaflet";

export type MapMode = "Events" | "Risk" | "Trade";

type MapPoint = {
  name: string;
  position: [number, number];
  tone: "critical" | "elevated" | "watch";
  detail: string;
};

const layers: Record<MapMode, MapPoint[]> = {
  Events: [
    { name: "Strait of Hormuz", position: [26.5, 56.3], tone: "critical", detail: "Shipping access and regional security" },
    { name: "Black Sea", position: [43.3, 34.0], tone: "elevated", detail: "Energy and maritime corridor activity" },
    { name: "Taiwan Strait", position: [24.2, 120.2], tone: "watch", detail: "Cross-strait military and cyber activity" },
    { name: "Sahel", position: [15.2, 2.4], tone: "elevated", detail: "Security and humanitarian pressure" },
  ],
  Risk: [
    { name: "Ukraine", position: [49.0, 32.0], tone: "critical", detail: "High-intensity security risk" },
    { name: "Sudan", position: [15.5, 30.2], tone: "critical", detail: "Conflict and displacement risk" },
    { name: "Haiti", position: [19.0, -72.4], tone: "elevated", detail: "Governance and humanitarian risk" },
    { name: "South China Sea", position: [13.0, 114.0], tone: "watch", detail: "Maritime competition risk" },
  ],
  Trade: [
    { name: "Suez Canal", position: [30.5, 32.3], tone: "critical", detail: "Europe–Asia shipping corridor" },
    { name: "Panama Canal", position: [9.1, -79.7], tone: "elevated", detail: "Atlantic–Pacific transit corridor" },
    { name: "Strait of Malacca", position: [3.2, 101.2], tone: "watch", detail: "Indian–Pacific Ocean chokepoint" },
    { name: "Bosporus", position: [41.1, 29.0], tone: "watch", detail: "Black Sea access corridor" },
  ],
};

const colors = {
  critical: "#d92b36",
  elevated: "#e66b35",
  watch: "#dfa927",
};

export default function WorldEventMap({ mode }: { mode: MapMode }) {
  return (
    <div className="leaflet-map-shell">
      <MapContainer
        center={[22, 12]}
        zoom={2}
        minZoom={2}
        maxZoom={7}
        scrollWheelZoom
        worldCopyJump
        className="leaflet-world-map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {layers[mode].map((point) => (
          <CircleMarker
            key={point.name}
            center={point.position}
            radius={9}
            pathOptions={{
              color: "#ffffff",
              weight: 3,
              fillColor: colors[point.tone],
              fillOpacity: 0.95,
            }}
          >
            <Popup>
              <strong>{point.name}</strong>
              <span>{point.detail}</span>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      <div className="map-legend" aria-label="Map risk legend">
        <span><i className="red" /> Critical</span>
        <span><i className="orange" /> Elevated</span>
        <span><i className="amber" /> Watch</span>
      </div>
    </div>
  );
}

