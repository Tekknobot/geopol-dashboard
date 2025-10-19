
import React, { Suspense, useEffect, useState } from 'react'
import type { EonetEvent } from '../services/eonet'
const MapCore = React.lazy(() => import('./MapCore'))

export default function LazyEventMap({ events }: { events: EonetEvent[] }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Defer map mount to the next tick to ensure first paint occurs quickly
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  if (!mounted) return <div className="h-[560px] bg-slate-100 animate-pulse rounded-xl" />

  return (
    <Suspense fallback={<div className="h-[560px] bg-slate-100 animate-pulse rounded-xl" />}>
      <MapCore events={events} />
    </Suspense>
  )
}
