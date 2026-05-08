import { Suspense, lazy } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Navbar       from './components/Navbar'
import PlayerModal  from './components/PlayerModal'
import ErrorBoundary from './components/ErrorBoundary'
import Home         from './pages/Home'

// Code splitting — el Home se sirve eager para que el primer paint sea rápido;
// el resto se carga bajo demanda, reduciendo el JS del primer load.
const MovieDetail = lazy(() => import('./pages/MovieDetail'))
const TVDetail    = lazy(() => import('./pages/TVDetail'))
const Search      = lazy(() => import('./pages/Search'))
const Catalog     = lazy(() => import('./pages/Catalog'))

function RouteFallback() {
  return (
    <div className="min-h-screen bg-void flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-gold/15 border-t-gold animate-spin" />
    </div>
  )
}

export default function App() {
  const location = useLocation()
  return (
    <ErrorBoundary>
      <div className="noise-overlay" aria-hidden="true" />
      <Navbar />
      <PlayerModal />
      <Suspense fallback={<RouteFallback />}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            {/* Main */}
            <Route path="/"              element={<Home />} />
            <Route path="/movie/:id"     element={<MovieDetail />} />
            <Route path="/tv/:id"        element={<TVDetail />} />
            <Route path="/search"        element={<Search />} />

            {/* Movies */}
            <Route path="/populares"     element={<Catalog type="populares" />} />
            <Route path="/top-valoradas" element={<Catalog type="top-valoradas" />} />
            <Route path="/estrenos"      element={<Catalog type="estrenos" />} />
            <Route path="/proximos"      element={<Catalog type="proximos" />} />
            <Route path="/tendencias"    element={<Catalog type="tendencias" />} />
            <Route path="/clasicos"      element={<Catalog type="clasicos" />} />

            {/* Series / TV */}
            <Route path="/series"        element={<Catalog type="series" />} />
            <Route path="/series-top"    element={<Catalog type="series-top" />} />
            <Route path="/en-emision"    element={<Catalog type="en-emision" />} />
            <Route path="/en-antena"     element={<Catalog type="en-antena" />} />

            {/* Anime */}
            <Route path="/anime"           element={<Catalog type="anime" />} />
            <Route path="/anime-peliculas" element={<Catalog type="anime-peliculas" />} />

            {/* K-Drama */}
            <Route path="/kdrama"        element={<Catalog type="kdrama" />} />

            {/* Fallback */}
            <Route path="*"              element={<Home />} />
          </Routes>
        </AnimatePresence>
      </Suspense>
    </ErrorBoundary>
  )
}
