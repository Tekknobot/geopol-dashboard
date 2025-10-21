import { Routes, Route, NavLink } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import CountryExplorer from './pages/CountryExplorer'
import EventsPage from './pages/Events' // ⬅️ NEW

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-white/70 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-semibold">Geopol</h1>
          <nav className="flex gap-4 text-sm md:text-base">
            <NavLink
              to="/"
              className={({ isActive }) => (isActive ? 'font-semibold' : 'text-slate-600')}
              end
            >
              Overview
            </NavLink>
            <NavLink
              to="/countries"
              className={({ isActive }) => (isActive ? 'font-semibold' : 'text-slate-600')}
            >
              Explorer
            </NavLink>
            <NavLink
              to="/events"
              className={({ isActive }) => (isActive ? 'font-semibold' : 'text-slate-600')}
            >
              Events
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/countries" element={<CountryExplorer />} />
          <Route path="/events" element={<EventsPage />} /> {/* ⬅️ NEW */}
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </main>

      <footer className="border-t py-6 text-center text-sm text-slate-500">
        Built with free public APIs (World Bank, REST Countries, ReliefWeb, NASA EONET)
      </footer>
    </div>
  )
}
