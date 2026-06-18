import { Suspense, lazy, useEffect, useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { getDeviceCaps } from './lib/deviceCaps'
import Navbar       from './components/Navbar'
import Footer       from './components/Footer'
import PlayerModal  from './components/PlayerModal'
import DonateModal  from './components/DonateModal'
import FloatingCafecito from './components/FloatingCafecito'
import UpdateAvailable from './components/UpdateAvailable'
import ErrorBoundary from './components/ErrorBoundary'
import ErrorBar     from './components/ErrorBar'
import Home         from './pages/Home'

// Code splitting — Home eager, resto bajo demanda
const MovieDetail = lazy(() => import('./pages/MovieDetail'))
const TVDetail    = lazy(() => import('./pages/TVDetail'))
const Search      = lazy(() => import('./pages/Search'))
const Catalog     = lazy(() => import('./pages/Catalog'))
const About       = lazy(() => import('./pages/About'))
const Terms       = lazy(() => import('./pages/Terms'))
const Privacy     = lazy(() => import('./pages/Privacy'))
const DMCA        = lazy(() => import('./pages/DMCA'))
const Admin       = lazy(() => import('./pages/Admin'))
const Mundial     = lazy(() => import('./pages/Mundial'))
const CinesCerca  = lazy(() => import('./pages/CinesCerca'))
const Download    = lazy(() => import('./pages/Download'))

function RouteFallback() {
  return (
    <div className="min-h-screen bg-void flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-gold/15 border-t-gold animate-spin" />
    </div>
  )
}

// AnimatePresence solo cuando enabled. En low-end servimos children pelado.
function RouteWrapper({ enabled, children }) {
  if (!enabled) return children
  return <AnimatePresence mode="wait">{children}</AnimatePresence>
}

export default function App() {
  const location = useLocation()
  const [donateOpen, setDonateOpen] = useState(false)
  const [lowEnd, setLowEnd] = useState(false)

  // Setea low-end mode → CSS apaga noise-overlay y otros lujos visuales
  useEffect(() => {
    const caps = getDeviceCaps()
    if (caps.lowEnd && typeof document !== 'undefined') {
      document.documentElement.classList.add('low-end')
      setLowEnd(true)
    }
  }, [])

  return (
    <ErrorBoundary>
      <ErrorBar />
      {!lowEnd && <div className="noise-overlay" aria-hidden="true" />}
      <Navbar onDonateClick={() => setDonateOpen(true)} />
      <PlayerModal />
      <DonateModal open={donateOpen} onClose={() => setDonateOpen(false)} />
      {/* En low-end omitimos el botón flotante (un componente menos, una
          suscripción Redux menos, un timer menos). El botón sigue presente
          en el Footer y en cada detalle de peli. */}
      {!lowEnd && <FloatingCafecito />}
      <UpdateAvailable />

      {/* Vercel Analytics — visitas, países, ciudades, dispositivos, top pages.
          Sin cookies. Cumple GDPR/LGPD/Ley 25.326. Dashboard en vercel.com.
          beforeSend filtra rutas que no aportan métricas útiles. */}
      <Analytics
        beforeSend={(event) => {
          // No trackear admin (contamina datos) ni queries con tokens
          if (event.url.includes('/admin')) return null
          // Limpiar query strings sensibles
          const url = new URL(event.url)
          if (url.searchParams.has('pin')) url.searchParams.delete('pin')
          return { ...event, url: url.toString() }
        }}
      />
      {/* Speed Insights — Core Web Vitals reales (LCP, FID, CLS, TTFB, INP).
          Excluye admin para no ensuciar el promedio con visitas internas. */}
      <SpeedInsights
        beforeSend={(event) => {
          if (event.url.includes('/admin')) return null
          return event
        }}
        sampleRate={1}
      />

      <Suspense fallback={<RouteFallback />}>
        <RouteWrapper enabled={!lowEnd}>
          <Routes location={location} key={location.pathname}>
            {/* Main */}
            <Route path="/"              element={<Home />} />
            <Route path="/movie/:id"     element={<MovieDetail />} />
            <Route path="/tv/:id"        element={<TVDetail />} />
            <Route path="/search"        element={<Search />} />

            {/* Legal / Info */}
            <Route path="/about"   element={<About />} />
            <Route path="/terms"   element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/dmca"    element={<DMCA />} />

            {/* Admin (gateado con PIN) */}
            <Route path="/admin"   element={<Admin />} />

            {/* Deportes */}
            <Route path="/mundial" element={<Mundial />} />

            {/* Servicios al usuario */}
            <Route path="/cines-cerca" element={<CinesCerca />} />

            {/* APK Android */}
            <Route path="/descargar" element={<Download />} />
            <Route path="/apk"       element={<Download />} />

            {/* Movies clásicos */}
            <Route path="/populares"      element={<Catalog type="populares" />} />
            <Route path="/top-valoradas"  element={<Catalog type="top-valoradas" />} />
            <Route path="/estrenos"       element={<Catalog type="estrenos" />} />
            <Route path="/proximos"       element={<Catalog type="proximos" />} />
            <Route path="/tendencias"     element={<Catalog type="tendencias" />} />
            <Route path="/tendencias-hoy" element={<Catalog type="tendencias-hoy" />} />
            <Route path="/clasicos"       element={<Catalog type="clasicos" />} />

            {/* Series clásicas */}
            <Route path="/series"           element={<Catalog type="series" />} />
            <Route path="/series-trending"  element={<Catalog type="series-trending" />} />
            <Route path="/series-top"       element={<Catalog type="series-top" />} />
            <Route path="/en-emision"       element={<Catalog type="en-emision" />} />
            <Route path="/en-antena"        element={<Catalog type="en-antena" />} />

            {/* Anime / K-Drama */}
            <Route path="/anime"           element={<Catalog type="anime" />} />
            <Route path="/anime-peliculas" element={<Catalog type="anime-peliculas" />} />
            <Route path="/kdrama"          element={<Catalog type="kdrama" />} />

            {/* Géneros - Películas */}
            <Route path="/genero-accion"     element={<Catalog type="genero-accion" />} />
            <Route path="/genero-aventura"   element={<Catalog type="genero-aventura" />} />
            <Route path="/genero-animacion"  element={<Catalog type="genero-animacion" />} />
            <Route path="/genero-comedia"    element={<Catalog type="genero-comedia" />} />
            <Route path="/genero-crimen"     element={<Catalog type="genero-crimen" />} />
            <Route path="/genero-documental" element={<Catalog type="genero-documental" />} />
            <Route path="/genero-drama"      element={<Catalog type="genero-drama" />} />
            <Route path="/genero-familia"    element={<Catalog type="genero-familia" />} />
            <Route path="/genero-fantasia"   element={<Catalog type="genero-fantasia" />} />
            <Route path="/genero-historia"   element={<Catalog type="genero-historia" />} />
            <Route path="/genero-terror"     element={<Catalog type="genero-terror" />} />
            <Route path="/genero-musica"     element={<Catalog type="genero-musica" />} />
            <Route path="/genero-misterio"   element={<Catalog type="genero-misterio" />} />
            <Route path="/genero-romance"    element={<Catalog type="genero-romance" />} />
            <Route path="/genero-sci-fi"     element={<Catalog type="genero-sci-fi" />} />
            <Route path="/genero-thriller"   element={<Catalog type="genero-thriller" />} />
            <Route path="/genero-belica"     element={<Catalog type="genero-belica" />} />
            <Route path="/genero-western"    element={<Catalog type="genero-western" />} />

            {/* Géneros - Series */}
            <Route path="/series-accion"     element={<Catalog type="series-accion" />} />
            <Route path="/series-comedia"    element={<Catalog type="series-comedia" />} />
            <Route path="/series-crimen"     element={<Catalog type="series-crimen" />} />
            <Route path="/series-documental" element={<Catalog type="series-documental" />} />
            <Route path="/series-drama"      element={<Catalog type="series-drama" />} />
            <Route path="/series-familia"    element={<Catalog type="series-familia" />} />
            <Route path="/series-kids"       element={<Catalog type="series-kids" />} />
            <Route path="/series-misterio"   element={<Catalog type="series-misterio" />} />
            <Route path="/series-reality"    element={<Catalog type="series-reality" />} />
            <Route path="/series-sci-fi"     element={<Catalog type="series-sci-fi" />} />
            <Route path="/series-telenovela" element={<Catalog type="series-telenovela" />} />

            {/* Décadas */}
            <Route path="/decada-2020" element={<Catalog type="decada-2020" />} />
            <Route path="/decada-2010" element={<Catalog type="decada-2010" />} />
            <Route path="/decada-2000" element={<Catalog type="decada-2000" />} />
            <Route path="/decada-1990" element={<Catalog type="decada-1990" />} />
            <Route path="/decada-1980" element={<Catalog type="decada-1980" />} />
            <Route path="/decada-1970" element={<Catalog type="decada-1970" />} />

            {/* Países */}
            <Route path="/pais-latam"   element={<Catalog type="pais-latam" />} />
            <Route path="/pais-espana"  element={<Catalog type="pais-espana" />} />
            <Route path="/pais-usa"     element={<Catalog type="pais-usa" />} />
            <Route path="/pais-francia" element={<Catalog type="pais-francia" />} />
            <Route path="/pais-italia"  element={<Catalog type="pais-italia" />} />
            <Route path="/pais-uk"      element={<Catalog type="pais-uk" />} />
            <Route path="/pais-india"   element={<Catalog type="pais-india" />} />
            <Route path="/pais-japon"   element={<Catalog type="pais-japon" />} />
            <Route path="/pais-corea"   element={<Catalog type="pais-corea" />} />
            <Route path="/pais-china"   element={<Catalog type="pais-china" />} />

            {/* Plataformas */}
            <Route path="/netflix"          element={<Catalog type="netflix" />} />
            <Route path="/prime"            element={<Catalog type="prime" />} />
            <Route path="/disney"           element={<Catalog type="disney" />} />
            <Route path="/hbo"              element={<Catalog type="hbo" />} />
            <Route path="/apple-tv"         element={<Catalog type="apple-tv" />} />
            <Route path="/paramount"        element={<Catalog type="paramount" />} />
            <Route path="/netflix-series"   element={<Catalog type="netflix-series" />} />
            <Route path="/prime-series"     element={<Catalog type="prime-series" />} />
            <Route path="/disney-series"    element={<Catalog type="disney-series" />} />
            <Route path="/hbo-series"       element={<Catalog type="hbo-series" />} />
            <Route path="/apple-tv-series"  element={<Catalog type="apple-tv-series" />} />
            <Route path="/paramount-series" element={<Catalog type="paramount-series" />} />
            <Route path="/crunchyroll"      element={<Catalog type="crunchyroll" />} />

            {/* Franquicias */}
            <Route path="/marvel"           element={<Catalog type="marvel" />} />
            <Route path="/dc"               element={<Catalog type="dc" />} />
            <Route path="/pixar"            element={<Catalog type="pixar" />} />
            <Route path="/ghibli"           element={<Catalog type="ghibli" />} />
            <Route path="/disney-clasicas"  element={<Catalog type="disney-clasicas" />} />
            <Route path="/lucasfilm"        element={<Catalog type="lucasfilm" />} />

            {/* Especiales */}
            <Route path="/infantil"         element={<Catalog type="infantil" />} />

            {/* Keywords */}
            <Route path="/mcu"             element={<Catalog type="mcu" />} />
            <Route path="/distopia"        element={<Catalog type="distopia" />} />
            <Route path="/superhero"       element={<Catalog type="superhero" />} />
            <Route path="/espacio"         element={<Catalog type="espacio" />} />
            <Route path="/aliens"          element={<Catalog type="aliens" />} />
            <Route path="/viajes-tiempo"   element={<Catalog type="viajes-tiempo" />} />
            <Route path="/zombies"         element={<Catalog type="zombies" />} />
            <Route path="/vampiros"        element={<Catalog type="vampiros" />} />
            <Route path="/artes-marciales" element={<Catalog type="artes-marciales" />} />
            <Route path="/espias"          element={<Catalog type="espias" />} />
            <Route path="/heists"          element={<Catalog type="heists" />} />
            <Route path="/apocalipsis"     element={<Catalog type="apocalipsis" />} />

            {/* Networks */}
            <Route path="/hbo-originals"   element={<Catalog type="hbo-originals" />} />
            <Route path="/bbc"             element={<Catalog type="bbc" />} />
            <Route path="/fx"              element={<Catalog type="fx" />} />
            <Route path="/amc"             element={<Catalog type="amc" />} />
            <Route path="/cartoon-network" element={<Catalog type="cartoon-network" />} />
            <Route path="/disney-channel"  element={<Catalog type="disney-channel" />} />
            <Route path="/nickelodeon"     element={<Catalog type="nickelodeon" />} />
            <Route path="/discovery"       element={<Catalog type="discovery" />} />
            <Route path="/showtime"        element={<Catalog type="showtime" />} />
            <Route path="/hulu"            element={<Catalog type="hulu" />} />

            {/* Fallback */}
            <Route path="*" element={<Home />} />
          </Routes>
        </RouteWrapper>
      </Suspense>

      <Footer onDonateClick={() => setDonateOpen(true)} />
    </ErrorBoundary>
  )
}
