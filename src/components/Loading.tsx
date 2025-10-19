
export default function Loading({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="animate-pulse text-slate-500 text-sm">{label}</div>
  )
}
