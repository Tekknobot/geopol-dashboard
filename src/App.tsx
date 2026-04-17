import { Routes, Route, NavLink } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import CountryExplorer from './pages/CountryExplorer'
import EventsPage from './pages/Events'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'rounded-full px-3 py-2 text-sm transition-colors',
    isActive ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-slate-900',
  ].join(' ')

export default function App() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.10),_transparent_38%),linear-gradient(to_bottom,_#f8fafc,_#eef2f7)] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-white/60 bg-slate-50/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between lg:px-6 xl:px-8">
          <div className="flex items-center justify-between gap-3">
            <NavLink
              to="/"
              end
              className="inline-flex items-center rounded-2xl px-2 py-1.5 text-xl font-semibold tracking-tight hover:bg-white sm:text-2xl"
              aria-label="Go to Overview"
            >
              Geoboard
            </NavLink>
            <div className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-500 shadow-sm">
              ReliefWeb-first
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/70 bg-white/70 p-1 shadow-sm">
            <NavLink to="/" className={navLinkClass} end>
              Overview
            </NavLink>
            <NavLink to="/countries" className={navLinkClass}>
              Explorer
            </NavLink>
            <NavLink to="/events" className={navLinkClass}>
              Events
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-4 sm:py-6 lg:px-6 lg:py-8 xl:px-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/countries" element={<CountryExplorer />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </main>

      <footer className="border-t border-white/70 bg-white/50 py-6 text-center text-sm text-slate-500 backdrop-blur">
        Built with free public APIs — ReliefWeb primary, with no-login World Bank and REST Countries backfill
      </footer>
    </div>
  )
}
