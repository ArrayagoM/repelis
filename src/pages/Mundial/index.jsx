import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, SoccerBall, Calendar, Trophy, WifiLow,
  PlayCircle, ArrowSquareOut, CheckCircle, Warning, ArrowClockwise,
  TextAa,
} from '@phosphor-icons/react'
import { getWorldCupFixture, getLiveEvents } from '../../api/sports'
import { LEGAL_BROADCASTERS_AR, getLiveMatches as getStreamedLive, getMatchSources, buildStreamUrl } from '../../api/sportsStreams'
import { getNetworkInfo } from '../../lib/network'
import { track } from '../../lib/errorMonitor'
import { useSEO } from '../../lib/useSEO'

// Auto-refresh para live scores (en bandwidth bajo, refrescamos menos)
const REFRESH_LIVE_GOOD = 30_000   // 30s en red buena
const REFRESH_LIVE_SLOW = 90_000   // 90s en red lenta

const formatDate = (iso) => {
  try {
    return new Date(iso).toLocaleString('es-AR', {
      weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

const formatJustTime = (iso) => {
  try { return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) }
  catch { return '' }
}

export default function Mundial() {
  const navigate = useNavigate()
  const [fixture,  setFixture]  = useState([])
  const [live,     setLive]     = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [tab,      setTab]      = useState('fixture')
  const [scoreOnlyMode, setScoreOnlyMode] = useState(false)
  const [autoDetectedSlow, setAutoDetectedSlow] = useState(false)

  useSEO({
    title: 'Mundial 2026 en vivo · fixture y marcadores',
    description: 'Mundial FIFA 2026 (México, USA, Canadá): fixture completo, marcadores en vivo, streams legales y comunitarios. Optimizado para baja conexión.',
    keywords: 'mundial 2026 en vivo, mundial fifa 2026, ver mundial gratis, fixture mundial, marcadores en vivo mundial',
  })

  // Auto-activar modo "solo marcador" si la red es lenta o saveData
  useEffect(() => {
    const { quality, saveData } = getNetworkInfo()
    if (saveData || quality === 'slow' || quality === 'moderate') {
      setScoreOnlyMode(true)
      setAutoDetectedSlow(true)
    }
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [fixRes, liveRes] = await Promise.allSettled([
        getWorldCupFixture('2026'),
        getLiveEvents(),
      ])

      if (fixRes.status === 'fulfilled') {
        const events = fixRes.value.data?.events || []
        setFixture(events.sort((a, b) =>
          new Date(a.strTimestamp || a.dateEvent) - new Date(b.strTimestamp || b.dateEvent)
        ))
      } else {
        track('mundial-fixture', fixRes.reason)
      }

      if (liveRes.status === 'fulfilled') {
        const events = liveRes.value.data?.events || []
        // Filtrar solo Mundial si TheSportsDB lo identifica
        const wc = events.filter((e) =>
          (e.strLeague || '').toLowerCase().includes('world cup') ||
          (e.strLeague || '').toLowerCase().includes('mundial')
        )
        setLive(wc.length ? wc : events.slice(0, 5))
      }
    } catch (e) {
      setError(e.message || 'No se pudo cargar el fixture')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-refresh live scores
  useEffect(() => {
    if (tab !== 'live') return
    const interval = autoDetectedSlow ? REFRESH_LIVE_SLOW : REFRESH_LIVE_GOOD
    const t = setInterval(fetchData, interval)
    return () => clearInterval(t)
  }, [tab, fetchData, autoDetectedSlow])

  const inProgress = live.length > 0

  return (
    <motion.main
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="min-h-screen bg-void pt-24 pb-24"
    >
      <div className="max-w-5xl mx-auto px-6 md:px-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full glass border border-white/10 flex items-center justify-center text-muted hover:text-gold">
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-3 flex-1">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-[0_4px_24px_rgba(16,185,129,0.4)]">
              <Trophy size={22} weight="fill" className="text-amber-200" />
            </div>
            <div>
              <h1 className="font-display font-extrabold text-3xl text-chalk leading-none">
                Mundial 2026
              </h1>
              <p className="text-muted text-sm mt-1">México · USA · Canadá · FIFA</p>
            </div>
          </div>
          {inProgress && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-300 text-[10px] font-bold uppercase tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              EN VIVO
            </span>
          )}
        </div>

        {/* Banner de modo bajo ancho de banda */}
        <AnimatePresence>
          {autoDetectedSlow && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden"
            >
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
                <WifiLow size={18} weight="fill" className="text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-amber-200 text-sm font-semibold">Modo Solo Marcador activado</p>
                  <p className="text-amber-100/70 text-xs mt-0.5">
                    Detectamos red lenta. Refrescamos cada 90s sin video — minutos y goles en vivo, sin gastar tus datos.
                  </p>
                </div>
                <button onClick={() => { setScoreOnlyMode(false); setAutoDetectedSlow(false) }}
                  className="text-amber-300/70 hover:text-amber-200 text-xs whitespace-nowrap">
                  Cargar video igual
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toggle Solo Marcador manual */}
        {!autoDetectedSlow && (
          <div className="mb-4 flex items-center gap-3 text-xs">
            <button onClick={() => setScoreOnlyMode((v) => !v)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
                scoreOnlyMode
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-white/5 border-white/10 text-muted'
              }`}>
              <TextAa size={12} weight="bold" />
              Modo Solo Marcador {scoreOnlyMode ? 'ON' : 'OFF'}
            </button>
            <span className="text-muted/50">Ahorra datos · ideal para 3G/4G débil</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-white/5">
          {[
            { id: 'fixture', label: 'Fixture', count: fixture.length },
            { id: 'live',    label: 'En vivo', count: live.length, dot: live.length > 0 },
            { id: 'where',   label: '¿Dónde verlo?', count: null },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all -mb-[1px] ${
                tab === t.id
                  ? 'text-gold border-b-2 border-gold'
                  : 'text-muted hover:text-chalk border-b-2 border-transparent'
              }`}>
              {t.label}
              {t.count !== null && t.count > 0 && (
                <span className="text-[10px] font-mono text-muted/60 px-1.5 py-0.5 rounded-full bg-white/5">
                  {t.count}
                </span>
              )}
              {t.dot && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />}
            </button>
          ))}
        </div>

        {/* Refresh manual */}
        <div className="flex items-center justify-between mb-4 text-xs">
          <span className="text-muted/50 font-mono">
            Datos: TheSportsDB + streamed.su · Auto-refresh: {autoDetectedSlow ? '90s' : '30s'}
          </span>
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-1.5 text-muted hover:text-gold disabled:opacity-50 transition-colors">
            <ArrowClockwise size={12} weight="bold" className={loading ? 'animate-spin' : ''} />
            Refrescar
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-center gap-2">
            <Warning size={16} weight="fill" /> {error}
          </div>
        )}

        {tab === 'fixture' && <FixtureTab fixture={fixture} loading={loading} scoreOnlyMode={scoreOnlyMode} />}
        {tab === 'live'    && <LiveTab live={live} loading={loading} scoreOnlyMode={scoreOnlyMode} />}
        {tab === 'where'   && <WhereTab />}
      </div>
    </motion.main>
  )
}

// ─── Tab: Fixture ─────────────────────────────────────────────────────────
function FixtureTab({ fixture, loading, scoreOnlyMode }) {
  if (loading && fixture.length === 0) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-surface animate-pulse" />
        ))}
      </div>
    )
  }
  if (fixture.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
        <SoccerBall size={32} className="text-muted/40" />
        <p className="text-chalk font-semibold">Fixture aún no disponible</p>
        <p className="text-muted text-sm max-w-md">
          El Mundial 2026 arranca el 11 de junio. TheSportsDB cargará el fixture completo apenas FIFA lo publique.
        </p>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {fixture.map((ev) => <MatchRow key={ev.idEvent} ev={ev} scoreOnlyMode={scoreOnlyMode} />)}
    </div>
  )
}

// ─── Tab: Live ────────────────────────────────────────────────────────────
function LiveTab({ live, loading, scoreOnlyMode }) {
  if (loading && live.length === 0) return <p className="text-muted text-center py-12">Buscando partidos en vivo…</p>
  if (live.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
        <SoccerBall size={32} className="text-muted/40" />
        <p className="text-chalk font-semibold">No hay partidos en vivo ahora</p>
        <p className="text-muted text-sm">Volvé cuando arranque un partido del Mundial.</p>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {live.map((ev) => <MatchRow key={ev.idEvent || ev.id} ev={ev} live scoreOnlyMode={scoreOnlyMode} />)}
    </div>
  )
}

// ─── Tab: Dónde verlo ─────────────────────────────────────────────────────
function WhereTab() {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
        <p className="text-emerald-300 font-semibold text-sm mb-1 flex items-center gap-2">
          <CheckCircle size={14} weight="fill" /> Transmisiones legales gratuitas en Argentina
        </p>
        <p className="text-muted/70 text-xs leading-relaxed">
          Los siguientes canales tienen los derechos oficiales para emitir el Mundial 2026 gratis.
          Te llevan directo a su streaming oficial.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {LEGAL_BROADCASTERS_AR.map((b) => (
          <a key={b.name} href={b.url} target="_blank" rel="noopener noreferrer"
            className="group p-4 rounded-xl bg-surface border border-white/10 hover:border-gold/30 transition-all">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-xl">{b.logo}</div>
              <div className="flex-1 min-w-0">
                <p className="text-chalk font-semibold text-sm flex items-center gap-1.5">
                  {b.name}
                  <ArrowSquareOut size={11} className="text-muted/40 group-hover:text-gold transition-colors" />
                </p>
                <p className="text-muted text-xs mt-0.5">{b.description}</p>
              </div>
            </div>
          </a>
        ))}
      </div>

      <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 mt-4">
        <p className="text-amber-300 font-semibold text-sm mb-2 flex items-center gap-2">
          <Warning size={14} weight="fill" /> Streams comunitarios
        </p>
        <p className="text-muted/70 text-xs leading-relaxed mb-2">
          Cuando se publique un partido en vivo, te aparecerá un botón "Ver stream comunitario" en la tarjeta del partido.
          Son agregadores no oficiales (mismo modelo que las películas) — pueden tener publicidad invasiva y no garantizamos audio en español.
        </p>
        <p className="text-muted/50 text-[10px]">
          Para una experiencia limpia, usá los canales legales de arriba.
        </p>
      </div>
    </div>
  )
}

// ─── Match Row ────────────────────────────────────────────────────────────
function MatchRow({ ev, live = false, scoreOnlyMode = false }) {
  const [showStream, setShowStream] = useState(false)
  const [streamSources, setStreamSources] = useState(null)
  const [activeStreamIdx, setActiveStreamIdx] = useState(0)
  const [loadingStream, setLoadingStream] = useState(false)

  const home  = ev.strHomeTeam || ev.homeTeam || '—'
  const away  = ev.strAwayTeam || ev.awayTeam || '—'
  const score = (ev.intHomeScore != null && ev.intAwayScore != null)
    ? `${ev.intHomeScore} - ${ev.intAwayScore}`
    : null
  const date  = ev.strTimestamp || ev.dateEvent
  const venue = ev.strVenue || ev.strCity

  const openStream = async () => {
    if (scoreOnlyMode) {
      // En modo solo marcador, no cargamos video
      return
    }
    if (showStream && streamSources) {
      setShowStream(false); return
    }
    setLoadingStream(true)
    setShowStream(true)
    try {
      // Buscamos el partido en streamed.su por nombres de equipos
      const search = `${home} ${away}`.toLowerCase()
      const res = await getMatchSources(encodeURIComponent(search))
      setStreamSources(res.data || [])
    } catch (e) {
      track('mundial-stream', e, { home, away })
      setStreamSources([])
    } finally {
      setLoadingStream(false)
    }
  }

  return (
    <div className={`p-4 rounded-xl bg-surface border transition-all ${
      live ? 'border-red-500/30 bg-red-500/[0.03]' : 'border-white/5'
    }`}>
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-muted text-[10px] font-mono uppercase tracking-widest mb-2">
            <Calendar size={10} /> {formatDate(date)}
            {venue && <span className="text-muted/40 truncate">· {venue}</span>}
            {live && <span className="ml-auto px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 font-bold">LIVE</span>}
          </div>
          <div className="flex items-center gap-3">
            <p className="text-chalk font-semibold text-base flex-1 truncate">{home}</p>
            {score ? (
              <p className="text-gold font-display font-extrabold text-xl font-mono px-3">{score}</p>
            ) : (
              <p className="text-muted/40 font-mono text-xs px-3">vs</p>
            )}
            <p className="text-chalk font-semibold text-base flex-1 truncate text-right">{away}</p>
          </div>
        </div>

        {live && !scoreOnlyMode && (
          <button onClick={openStream}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full bg-gold text-void text-xs font-bold hover:bg-gold-hi transition-colors">
            <PlayCircle size={14} weight="fill" />
            Ver stream
          </button>
        )}
      </div>

      <AnimatePresence>
        {showStream && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t border-white/5">
              {loadingStream && (
                <div className="flex items-center gap-2 text-muted text-xs">
                  <div className="w-3 h-3 rounded-full border-2 border-gold/20 border-t-gold animate-spin" />
                  Buscando stream comunitario…
                </div>
              )}
              {!loadingStream && (!streamSources || streamSources.length === 0) && (
                <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/20">
                  <p className="text-red-300 text-sm font-semibold mb-1">No encontramos stream comunitario</p>
                  <p className="text-muted text-xs">
                    Probá los canales legales: <strong>TV Pública</strong>, <strong>Telefe</strong>, <strong>DSports</strong>.
                  </p>
                </div>
              )}
              {!loadingStream && streamSources && streamSources.length > 0 && (
                <div>
                  <div className="aspect-video rounded-lg overflow-hidden bg-black mb-2">
                    <iframe
                      src={buildStreamUrl(streamSources[activeStreamIdx].source, streamSources[activeStreamIdx].id)}
                      className="w-full h-full"
                      allow="autoplay; fullscreen; picture-in-picture"
                      referrerPolicy="no-referrer"
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {streamSources.map((s, i) => (
                      <button key={i} onClick={() => setActiveStreamIdx(i)}
                        className={`px-2 py-1 rounded text-[10px] font-mono transition-all ${
                          activeStreamIdx === i
                            ? 'bg-gold/15 text-gold border border-gold/30'
                            : 'bg-white/5 text-muted hover:text-chalk'
                        }`}>
                        {s.source || `Fuente ${i + 1}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
