import React, { Suspense } from 'react'
import type { EonetEvent } from '../services/eonet'
import type { MapNewsItem } from './MapCore'
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
}: {
  events: EonetEvent[]
  onNews?: (items: MapNewsItem[]) => void
}) {
  return (
    <Suspense fallback={<div className="h-64 flex items-center justify-center text-slate-500">Loading map…</div>}>
      <MapCore events={events} onNews={onNews} />
    </Suspense>
  )
}
