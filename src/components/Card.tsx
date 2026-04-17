import { ReactNode } from 'react'

export default function Card({ title, children, right }: { title: string, children: ReactNode, right?: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-white/70 bg-white/85 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur-sm">
      <div className="flex flex-col gap-2 border-b border-slate-200/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <h2 className="font-semibold tracking-tight text-slate-900">{title}</h2>
        {right ? <div className="min-w-0 text-sm text-slate-500">{right}</div> : null}
      </div>
      <div className="p-4 sm:p-5">
        {children}
      </div>
    </section>
  )
}
