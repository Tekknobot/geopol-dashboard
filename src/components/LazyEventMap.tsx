import React, { Suspense } from 'react'
import type { EonetEvent } from '../services/eonet'
import type { ReliefWebItem } from '../services/reliefweb'
import type { MapNewsItem } from './MapCore'
import type { WorldNewsItem } from '../services/worldNews'
const MapCore = React.lazy(() => import('./MapCore'))

// Warm the chunk so it’s ready when we hit the section
if (typeof window !== 'undefined') {
  const preload = () => import('./MapCore');
  (window as any).requestIdleCallback
    ? (window as any).requestIdleCallback(preload)
    : setTimeout(preload, 0);
}

export default function LazyEventMap({
  events,
  onNews,
  reports = [],
  worldNews = [],
}: {
  events: EonetEvent[]
  reports?: ReliefWebItem[]
  worldNews?: WorldNewsItem[]
  onNews?: (items: MapNewsItem[]) => void
}) {
  return (
    <Suspense fallback={<div className="h-64 flex items-center justify-center text-slate-500">Loading map…</div>}>
      <MapCore events={events} reports={reports} worldNews={worldNews} onNews={onNews} />
    </Suspense>
  )
}
