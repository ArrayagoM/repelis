import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, MapPin, FilmSlate, Phone, Globe, ArrowSquareOut,
  WheelchairMotion, Clock, Warning, MagnifyingGlass, Shield,
} from '@phosphor-icons/react'
import { useSEO } from '../../lib/useSEO'
import {
  getUserCoords, fetchNearbyCinemas, mapsDirectionsUrl,
} from '../../lib/nearbyCinemas'

const formatDistance = (km) =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`

export default function CinesCerca() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState('idle')       // idle | locating | searching | results | denied | error
  const [cinemas, setCinemas] = useState([])
  const [coords, setCoords]   = useState(null)
  const [errMsg, setErrMsg]   = useState('')
  const [radius, setRadius]   = useState(30)

  useSEO({
    title: 'Cines cerca tuyo',
    description: 'Encontrá los cines más cercanos a tu ubicación. Datos en vivo de OpenStreetMap.',
    keywords: 'cines cerca, cine en argentina, ver en cartelera, cines cercanos',
  })

  const start = async () => {
    setPhase('locating'); setErrMsg('')
    try {
      const c = await getUserCoords()
      setCoords(c)
      setPhase('searching')
      const list = await fetchNearbyCinemas(c.lat, c.lng, radius)
      setCinemas(list)
      setPhase('results')

      // Tracking server-side con coords precisas (opt-in real del usuario)
      try {
        await fetch('/api/track', {
          method: 'POST',
          keepalive: true,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ lat: c.lat, lng: c.lng, source: 'geolocation' }),
        }).catch(() => {})
      } catch {}
    } catch (e) {
      if (e.message === 'permission_denied') setPhase('denied')
      else { setErrMsg(e.message); setPhase('error') }
    }
  }

  return (
    <motion.main
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="min-h-screen bg-void pt-24 pb-24"
    >
      <div className="max-w-3xl mx-auto px-6 md:px-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full glass border border-white/10 flex items-center justify-center text-muted hover:text-gold">
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-3 flex-1">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gold/30 to-amber-600/20 flex items-center justify-center shadow-[0_4px_24px_rgba(232,160,32,0.3)]">
              <FilmSlate size={22} weight="fill" className="text-gold" />
            </div>
            <div>
              <h1 className="font-display font-extrabold text-2xl text-chalk leading-none">
                Cines cerca tuyo
              </h1>
              <p className="text-muted text-xs mt-1">Powered by OpenStreetMap</p>
            </div>
          </div>
        </div>

        {/* Idle: pre-permission CTA con explainer claro */}
        {phase === 'idle' && (
          <div className="space-y-4">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-gold/10 to-amber-500/5 border border-gold/20">
              <div className="flex items-start gap-3">
                <Shield size={22} weight="fill" className="text-gold flex-shrink-0 mt-1" />
                <div className="flex-1 space-y-3">
                  <p className="text-chalk font-display font-bold text-lg">¿Qué te vamos a pedir?</p>
                  <p className="text-muted text-sm leading-relaxed">
                    El próximo paso te va a abrir una ventana del navegador pidiendo permiso a
                    <strong className="text-chalk/90"> tu ubicación</strong>. La usamos para
                    una sola cosa:
                  </p>
                  <ol className="text-muted text-sm leading-relaxed list-decimal list-inside space-y-1 marker:text-gold/70">
                    <li><strong className="text-chalk/90">Buscar cines a {radius} km</strong> a la redonda y mostrarte distancia + cómo llegar.</li>
                  </ol>
                  <p className="text-muted/70 text-xs leading-relaxed">
                    ⚠️ Honestidad: también guardamos tu ciudad/país aproximados en nuestros analytics
                    para entender desde dónde nos usan. Ver <Link to="/privacy" className="text-gold underline">política de privacidad</Link>.
                    Si negás el permiso, esta página no funciona pero el resto del sitio sí.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-muted text-xs flex items-center gap-2">
                Radio:
                <select value={radius} onChange={(e) => setRadius(Number(e.target.value))}
                  className="bg-surface border border-white/10 rounded-lg px-3 py-1.5 text-sm text-chalk">
                  <option value={5}>5 km</option>
                  <option value={10}>10 km</option>
                  <option value={20}>20 km</option>
                  <option value={30}>30 km</option>
                  <option value={50}>50 km</option>
                  <option value={100}>100 km</option>
                </select>
              </label>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={start}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-gold text-void font-bold shadow-[0_4px_24px_rgba(232,160,32,0.35)] hover:bg-gold-hi transition-colors"
              >
                <MapPin size={16} weight="fill" />
                Buscar cines cerca mío
              </motion.button>
            </div>
          </div>
        )}

        {/* Locating: pidiendo permiso */}
        {phase === 'locating' && (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <div className="w-12 h-12 rounded-full border-2 border-gold/15 border-t-gold animate-spin" />
            <p className="text-chalk font-display font-semibold">Detectando ubicación…</p>
            <p className="text-muted text-sm">Mirá el popup del navegador y aceptá el permiso.</p>
          </div>
        )}

        {/* Searching: buscando cines */}
        {phase === 'searching' && (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <MagnifyingGlass size={32} className="text-gold animate-pulse" />
            <p className="text-chalk font-display font-semibold">Buscando cines a {radius} km…</p>
            <p className="text-muted text-sm">Consultando OpenStreetMap.</p>
          </div>
        )}

        {/* Denied: usuario rechazó */}
        {phase === 'denied' && (
          <div className="p-6 rounded-2xl bg-red-500/8 border border-red-500/20 text-center">
            <Warning size={36} weight="fill" className="text-red-400 mx-auto mb-3" />
            <p className="text-chalk font-display font-bold text-lg mb-1">Permiso rechazado</p>
            <p className="text-muted text-sm mb-4">
              Sin tu ubicación no podemos calcular cines cercanos. Si cambiaste de opinión,
              dale permiso al sitio en <strong className="text-chalk/90">candado de la barra</strong> y volvé a tocar el botón.
            </p>
            <button onClick={start}
              className="px-5 py-2 rounded-full bg-gold text-void font-bold text-sm hover:bg-gold-hi transition-colors">
              Volver a intentar
            </button>
          </div>
        )}

        {/* Error genérico */}
        {phase === 'error' && (
          <div className="p-6 rounded-2xl bg-amber-500/8 border border-amber-500/20 text-center">
            <Warning size={36} weight="fill" className="text-amber-400 mx-auto mb-3" />
            <p className="text-chalk font-display font-bold text-lg mb-1">Algo no anduvo</p>
            <p className="text-muted text-sm font-mono mb-4">{errMsg}</p>
            <button onClick={start}
              className="px-5 py-2 rounded-full bg-gold text-void font-bold text-sm hover:bg-gold-hi transition-colors">
              Reintentar
            </button>
          </div>
        )}

        {/* Resultados */}
        {phase === 'results' && (
          <>
            <div className="flex items-center justify-between mb-4 text-sm">
              <p className="text-muted">
                Encontramos <strong className="text-chalk">{cinemas.length} cine{cinemas.length !== 1 ? 's' : ''}</strong>
                {' '}a {radius} km.
              </p>
              <button onClick={() => setPhase('idle')}
                className="text-gold text-xs hover:underline">Cambiar radio</button>
            </div>

            {cinemas.length === 0 ? (
              <div className="p-6 rounded-2xl bg-surface border border-white/5 text-center">
                <FilmSlate size={36} className="text-muted/50 mx-auto mb-3" />
                <p className="text-chalk font-semibold mb-1">No hay cines registrados a {radius} km</p>
                <p className="text-muted text-sm">
                  Probá ampliar el radio. Los datos vienen de OpenStreetMap y puede que en tu zona
                  no estén mapeados todos.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {cinemas.map((c) => <CinemaCard key={c.id} cinema={c} />)}
              </div>
            )}
          </>
        )}
      </div>
    </motion.main>
  )
}

function CinemaCard({ cinema: c }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-4 rounded-2xl bg-surface border border-white/5 hover:border-gold/20 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-gold/15 flex items-center justify-center flex-shrink-0">
          <FilmSlate size={18} weight="fill" className="text-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-1">
            <p className="text-chalk font-display font-bold text-base leading-tight truncate">{c.name}</p>
            <span className="text-gold text-sm font-mono font-bold flex-shrink-0">{formatDistance(c.distanceKm)}</span>
          </div>
          {c.brand && <p className="text-muted/70 text-xs font-mono uppercase tracking-wide mb-1">{c.brand}</p>}
          {c.address && <p className="text-muted text-xs truncate">{c.address}</p>}

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <a href={mapsDirectionsUrl(c.lat, c.lng, c.name)} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gold text-void text-[11px] font-bold hover:bg-gold-hi transition-colors">
              <MapPin size={11} weight="fill" /> Cómo llegar
            </a>
            {c.website && (
              <a href={c.website} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 text-chalk text-[11px] font-semibold hover:bg-white/10 transition-colors">
                <Globe size={11} /> Web <ArrowSquareOut size={9} />
              </a>
            )}
            {c.phone && (
              <a href={`tel:${c.phone}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 text-chalk text-[11px] font-semibold hover:bg-white/10 transition-colors">
                <Phone size={11} weight="fill" /> {c.phone}
              </a>
            )}
            {c.openingHours && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px] font-mono">
                <Clock size={10} weight="fill" /> {c.openingHours.slice(0, 20)}{c.openingHours.length > 20 ? '…' : ''}
              </span>
            )}
            {c.wheelchair === 'yes' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-300 text-[10px] font-mono">
                <WheelchairMotion size={10} weight="fill" /> Accesible
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
