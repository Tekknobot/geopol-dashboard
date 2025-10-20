import React, { Suspense } from 'react'
import type { EonetEvent } from '../services/eonet'
import type { MapNewsItem } from './MapCore'
const MapCore = React.lazy(() => import('./MapCore'))

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
