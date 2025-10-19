
import { ReactNode } from 'react'

export default function Card({ title, children, right }: { title: string, children: ReactNode, right?: ReactNode }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        {right}
      </div>
      <div className="p-4">
        {children}
      </div>
    </section>
  )
}
