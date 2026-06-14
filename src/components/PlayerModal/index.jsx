import { useEffect, useCallback, useState, useRef, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, FilmSlate, ArrowClockwise, CaretRight, CaretLeft,
  SmileySad, WifiLow, Subtitles, Info, Star,
  SkipForward, SkipBack, ArrowSquareOut, Warning,
} from '@phosphor-icons/react'
import { closePlayer, setEpisode } from '../../store/slices/playerSlice'
import { getOrderedSources, buildUrl, rememberSource, DEFAULT_ALLOW } from '../../lib/playerSources'
import { getNetworkInfo } from '../../lib/network'
import { getServerHistory } from '../../lib/serverHealth'
import WatchProviders from '../WatchProviders'

// ─── Timeouts (balance entre velocidad y NO interrumpir reproducción) ──
// Lección: timeouts agresivos cortaban videos que tardaban en arrancar.
// Balance velocidad ↔ no-cerrarse-solo:
//   - Si el iframe carga rápido (onLoad < 2s), asumimos que ya arrancó y
//     dejamos que el usuario se quede ahí (sin auto-next).
//   - Si tarda > 7s, mostramos botón "Saltar" prominente.
//   - Si tarda > NEXT_MS_*, saltamos automático al próximo servidor.
const NEXT_MS_GOOD     = 7000
const NEXT_MS_MODERATE = 10000
const NEXT_MS_SLOW     = 15000

// Tras cuánto tiempo asumimos que el iframe está reproduciendo
// (sin esperar señal del player).
const ASSUME_PLAYING_MS = 5000

// Skip rápido: si el servidor tuvo <30% uptime histórico, lo saltamos sin
// esperar el timeout (solo aplica si hay >=5 mediciones previas).
const UPTIME_SKIP_THRESHOLD = 30
const UPTIME_MIN_SAMPLES = 5

// ─── Guards ──────────────────────────────────────────────────────────────
const useWindowFocusGuard = (active) => {
  useEffect(() => {
    if (!active) return
    const regain = () => { if (!document.hidden) window.focus() }
    window.addEventListener('blur', regain)
    return () => window.removeEventListener('blur', regain)
  }, [active])
}

const useNetworkQuality = () => {
  const [info, setInfo] = useState(getNetworkInfo)
  useEffect(() => {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    if (!conn) return
    const check = () => setInfo(getNetworkInfo())
    conn.addEventListener('change', check)
    return () => conn.removeEventListener('change', check)
  }, [])
  return info
}

const TOP_DOMAINS = [
  'https://embedmaster.link',
  'https://vidsrc.to',
  'https://vidsrc.icu',
  'https://vidlink.pro',
  'https://embed.su',
]

const usePreconnect = (active) => {
  useEffect(() => {
    if (!active) return
    const links = TOP_DOMAINS.map((href) => {
      const el = Object.assign(document.createElement('link'), { rel: 'preconnect', href, crossOrigin: '' })
      document.head.appendChild(el)
      return el
    })
    return () => links.forEach((l) => l.parentNode?.removeChild(l))
  }, [active])
}

// ─────────────────────────────────────────────────────────────────────────
export default function PlayerModal() {
  const dispatch = useDispatch()
  const { isOpen, movieId, title, mediaType, season: initSeason, episode: initEpisode, totalSeasons } =
    useSelector((s) => s.player)

  // El orden de SOURCES se calcula UNA vez por apertura. Después aplicamos
  // un "smart skip": los servidores con <30% uptime histórico van AL FINAL
  // de la cola (no perdemos tiempo probándolos primero).
  const sources = useMemo(() => {
    const ordered = getOrderedSources()
    const history = getServerHistory()
    const isHealthy = (s) => {
      const h = history[s.id]
      if (!h || h.samples < UPTIME_MIN_SAMPLES) return true   // sin datos = pasa
      return h.okPct >= UPTIME_SKIP_THRESHOLD
    }
    const healthy = ordered.filter(isHealthy)
    const sick    = ordered.filter((s) => !isHealthy(s))
    return [...healthy, ...sick]
  }, [isOpen, movieId, initSeason, initEpisode])

  const [srcIdx,    setSrcIdx]    = useState(0)
  const [key,       setKey]       = useState(0)
  const [phase,     setPhase]     = useState('loading')
  const [progress,  setProgress]  = useState(0)
  const [showLang,  setShowLang]  = useState(false)
  const [showExtConfirm, setShowExtConfirm] = useState(false)
  // TV local state
  const [localSeason,  setLocalSeason]  = useState(initSeason  || 1)
  const [localEpisode, setLocalEpisode] = useState(initEpisode || 1)

  const timerRef    = useRef(null)
  const progressRef = useRef(null)
  const assumeRef   = useRef(null)
  const successRef  = useRef(false)

  const net = useNetworkQuality()
  const isSlowNet = net.quality === 'slow' || net.quality === 'moderate'
  const autoNextMs =
    net.quality === 'slow' ? NEXT_MS_SLOW
    : net.quality === 'moderate' ? NEXT_MS_MODERATE
    : NEXT_MS_GOOD

  usePreconnect(isOpen)
  useWindowFocusGuard(isOpen && sources[srcIdx]?.sandbox === null)

  const stopTimers = useCallback(() => {
    clearTimeout(timerRef.current)
    clearTimeout(assumeRef.current)
    clearInterval(progressRef.current)
    setProgress(0)
  }, [])

  const lockSuccess = useCallback((sourceId) => {
    if (successRef.current) return
    successRef.current = true
    rememberSource(sourceId)
    stopTimers()
    setPhase('playing')
  }, [stopTimers])

  const goTo = useCallback((idx) => {
    stopTimers()
    successRef.current = false
    setSrcIdx(idx)
    setKey((k) => k + 1)
    setPhase('loading')
    setShowLang(false)
  }, [stopTimers])

  const handleClose = useCallback(() => {
    stopTimers()
    dispatch(closePlayer())
    setSrcIdx(0)
    setPhase('loading')
    setShowLang(false)
    successRef.current = false
  }, [dispatch, stopTimers])

  // Sync TV episode + reset al abrir
  useEffect(() => {
    if (isOpen) {
      setLocalSeason(initSeason || 1)
      setLocalEpisode(initEpisode || 1)
      successRef.current = false
      setSrcIdx(0)
      setKey((k) => k + 1)
      setPhase('loading')
      // Mostramos el tip de audio español por 15s al abrir.
      // El usuario lo puede cerrar con la X. El texto es lo suficientemente
      // largo como para que necesite ese tiempo para leerlo.
      setShowLang(true)
      const t = setTimeout(() => setShowLang(false), 15_000)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, movieId])

  const changeEpisode = useCallback((newSeason, newEpisode) => {
    setLocalSeason(newSeason)
    setLocalEpisode(newEpisode)
    dispatch(setEpisode({ season: newSeason, episode: newEpisode }))
    stopTimers()
    successRef.current = false
    setSrcIdx(0)
    setKey((k) => k + 1)
    setPhase('loading')
  }, [dispatch, stopTimers])

  const nextEpisode = useCallback(() => {
    changeEpisode(localSeason, localEpisode + 1)
  }, [localSeason, localEpisode, changeEpisode])

  const prevEpisode = useCallback(() => {
    if (localEpisode > 1) changeEpisode(localSeason, localEpisode - 1)
    else if (localSeason > 1) changeEpisode(localSeason - 1, 1)
  }, [localSeason, localEpisode, changeEpisode])

  useEffect(() => {
    if (!isOpen) return
    const h = (e) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', h)
    document.body.style.overflow = 'hidden'
    // Marca al body para que el CSS apague overlays/blur que comen GPU
    // mientras el video se reproduce (noise-overlay, glass, etc.)
    document.body.classList.add('player-active')
    return () => {
      window.removeEventListener('keydown', h)
      document.body.style.overflow = ''
      document.body.classList.remove('player-active')
    }
  }, [isOpen, handleClose])

  // PostMessage de cualquier player que reporte 'play' / 'playing'
  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => {
      const d = e.data
      if (!d) return
      const evt = d.event || d.type
      const isPlay = evt === 'play' || evt === 'playing' || evt === 'started' || evt === 'PLAYER_EVENT'
      if (isPlay) lockSuccess(sources[srcIdx]?.id)
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [isOpen, srcIdx, sources, lockSuccess])

  const onIframeLoad = useCallback(() => {
    if (successRef.current) return
    setPhase('ready')
    stopTimers()

    // Asumimos éxito si el iframe aguanta ASSUME_PLAYING_MS sin que tengamos
    // razón para descartarlo. Mientras tanto seguimos midiendo y permitiendo
    // que el usuario o el postMessage del player confirmen.
    assumeRef.current = setTimeout(() => {
      lockSuccess(sources[srcIdx]?.id)
    }, ASSUME_PLAYING_MS)

    // Barra de progreso visual + auto-next si nada llega.
    const start = Date.now()
    progressRef.current = setInterval(() => {
      setProgress(Math.min(100, ((Date.now() - start) / autoNextMs) * 100))
    }, 80)

    timerRef.current = setTimeout(() => {
      if (successRef.current) return
      clearInterval(progressRef.current)
      setSrcIdx((cur) => {
        const next = cur + 1
        if (next >= sources.length) { setPhase('failed'); return cur }
        clearTimeout(assumeRef.current)
        successRef.current = false
        setKey((k) => k + 1)
        setPhase('loading')
        setShowLang(false)
        return next
      })
    }, autoNextMs)
  }, [autoNextMs, sources, srcIdx, lockSuccess, stopTimers])

  // El onError de iframe es muy poco confiable (dispara falsos positivos
  // incluso en servidores que cargan bien). Lo dejamos como no-op a propósito.
  const onIframeError = useCallback(() => {}, [])

  const onUserInteract = useCallback(() => {
    // Cualquier mouse/click del usuario sobre el player es un voto fuerte
    // de que está viendo algo. Bloqueamos cambios automáticos.
    lockSuccess(sources[srcIdx]?.id)
  }, [lockSuccess, sources, srcIdx])

  const src = sources[srcIdx]
  const isTV = mediaType === 'tv'
  const url = movieId ? buildUrl(src, { mediaType, id: movieId, season: localSeason, episode: localEpisode }) : ''

  // Abre el URL actual del servidor en una pestaña nueva.
  // Esto sirve para: (1) usar extensiones de descarga del browser (Video
  // DownloadHelper, etc.), (2) pasar el iframe a fullscreen del servidor,
  // (3) debug rápido cuando el embed se rompe.
  const handleOpenExternal = useCallback(() => {
    if (!url) return
    try { localStorage.setItem('repelis:extConfirm:v1', '1') } catch {}
    window.open(url, '_blank', 'noopener,noreferrer')
    setShowExtConfirm(false)
  }, [url])

  const handleExternalClick = useCallback(() => {
    let confirmed = false
    try { confirmed = localStorage.getItem('repelis:extConfirm:v1') === '1' } catch {}
    if (confirmed) handleOpenExternal()
    else setShowExtConfirm(true)
  }, [handleOpenExternal])

  return (
    <AnimatePresence>
      {isOpen && movieId && (
        <motion.div
          key="bg"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-3 sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-[1300px] flex flex-col rounded-2xl overflow-hidden border border-white/[0.06] shadow-[0_48px_120px_rgba(0,0,0,1)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── BARRA SUPERIOR ─────────────────────────────────────── */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-[#0E0E18] border-b border-white/[0.05]">
              <FilmSlate size={14} className="text-gold flex-shrink-0" />
              <span className="text-chalk/85 font-display font-medium text-sm truncate flex-1 min-w-0">
                {title || 'Reproduciendo…'}
                {isTV && (
                  <span className="text-muted/60 font-mono text-xs ml-2">
                    T{localSeason} E{localEpisode}
                  </span>
                )}
              </span>

              {/* Controles TV */}
              {isTV && (
                <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
                  <button onClick={prevEpisode} disabled={localSeason === 1 && localEpisode === 1}
                    className="w-6 h-6 flex items-center justify-center rounded text-muted/50 hover:text-chalk disabled:opacity-20 transition-colors">
                    <SkipBack size={11} weight="fill" />
                  </button>
                  <span className="text-[10px] font-mono text-muted/50 px-1">
                    S{localSeason}E{localEpisode}
                  </span>
                  <button onClick={nextEpisode}
                    className="w-6 h-6 flex items-center justify-center rounded text-muted/50 hover:text-chalk transition-colors">
                    <SkipForward size={11} weight="fill" />
                  </button>
                </div>
              )}

              {/* Selector temporada (TV) */}
              {isTV && totalSeasons > 1 && (
                <select
                  value={localSeason}
                  onChange={(e) => changeEpisode(Number(e.target.value), 1)}
                  className="hidden sm:block bg-surface border border-white/10 text-chalk text-[10px] font-mono rounded px-2 py-1 focus:outline-none focus:border-gold/30 flex-shrink-0"
                >
                  {Array.from({ length: totalSeasons }, (_, i) => i + 1).map((s) => (
                    <option key={s} value={s}>Temporada {s}</option>
                  ))}
                </select>
              )}

              {/* Badge idioma */}
              <AnimatePresence>
                {(phase === 'playing' || phase === 'ready') && (
                  <motion.button
                    key="langbtn"
                    initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                    onClick={() => setShowLang((v) => !v)}
                    className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono transition-all flex-shrink-0
                      ${showLang ? 'bg-gold/15 border-gold/30 text-gold' : 'bg-white/5 border-white/10 text-muted/60 hover:text-chalk hover:border-white/20'}`}
                  >
                    <Subtitles size={11} weight="fill" />
                    <span>ES</span>
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Badge red lenta */}
              <AnimatePresence>
                {isSlowNet && phase !== 'failed' && (
                  <motion.div
                    key="slownet"
                    initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                    className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 flex-shrink-0"
                  >
                    <WifiLow size={11} weight="fill" className="text-amber-400" />
                    <span className="text-amber-400/80 text-[10px] font-mono">
                      {net.quality === 'slow' ? 'Red lenta' : 'Señal media'}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Badge: servidor con buen catálogo LATAM (NO garantía por título) */}
              {src?.esLat && (
                <span
                  className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-[10px] font-bold uppercase tracking-wide flex-shrink-0 cursor-help"
                  title="Servidor con buen catálogo de doblaje LATAM. El audio del título específico depende de qué pistas tenga el server. Si arranca en otro idioma, cambialo desde el ícono Audio/CC del player."
                >
                  <span className="text-sm leading-none">🇲🇽</span>
                  LATAM probable
                </span>
              )}

              {/* Nav servidores */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button onClick={() => goTo((srcIdx - 1 + sources.length) % sources.length)}
                  className="w-6 h-6 flex items-center justify-center rounded text-muted/50 hover:text-chalk transition-colors">
                  <CaretLeft size={10} weight="bold" />
                </button>
                {sources.map((s, i) => (
                  <button key={s.id} onClick={() => goTo(i)} title={`${s.label}${s.premium ? ' ★' : ''}${s.esLat ? ' 🇲🇽 LATAM' : ''}`}
                    className={`w-6 h-6 flex items-center justify-center rounded text-[11px] font-semibold transition-all duration-150 relative ${
                      i === srcIdx
                        ? s.premium ? 'bg-purple-500/20 text-purple-300' : s.esLat ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gold/20 text-gold'
                        : 'text-muted/40 hover:text-chalk hover:bg-white/5'
                    }`}>
                    {i + 1}
                    {s.premium && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-purple-400 border border-void" />
                    )}
                    {!s.premium && s.esLat && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-void" />
                    )}
                  </button>
                ))}
                <button onClick={() => goTo((srcIdx + 1) % sources.length)}
                  className="w-6 h-6 flex items-center justify-center rounded text-muted/50 hover:text-chalk transition-colors">
                  <CaretRight size={10} weight="bold" />
                </button>
                <span className="text-muted/30 text-[10px] font-mono ml-1.5 hidden sm:block w-20 truncate">
                  {src?.label}
                </span>
              </div>

              <button onClick={handleExternalClick} title="Abrir en pestaña externa"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-muted/50 hover:text-gold hover:bg-gold/8 transition-all flex-shrink-0">
                <ArrowSquareOut size={13} weight="bold" />
              </button>
              <button onClick={() => goTo(srcIdx)} title="Recargar"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-muted/50 hover:text-chalk hover:bg-white/5 transition-all flex-shrink-0">
                <ArrowClockwise size={13} />
              </button>
              <button onClick={handleClose} title="Cerrar"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-muted/50 hover:text-red-400 hover:bg-red-400/8 transition-all flex-shrink-0">
                <X size={13} weight="bold" />
              </button>
            </div>

            {/* ── PANEL INFO ESPAÑOL ── */}
            <AnimatePresence>
              {showLang && (
                <motion.div
                  key="langtip"
                  initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden bg-[#0d0d1a] border-b border-white/[0.04]"
                >
                  <div className="flex items-start gap-3 px-4 py-3 bg-amber-500/[0.07] border-l-2 border-amber-400/40">
                    <Info size={16} weight="fill" className="text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-2">
                      <p className="text-amber-200 text-sm font-bold">⚠️ ¿Arrancó en inglés? Es normal — leé esto</p>
                      <p className="text-chalk/85 text-[12px] leading-relaxed">
                        El badge <strong>"LATAM probable"</strong> significa que el servidor tiene buen catálogo de doblajes, pero <strong className="text-amber-200">cada peli es distinta</strong>. Si arrancó en otro idioma:
                      </p>
                      <ol className="text-muted/85 text-[11px] leading-relaxed list-decimal list-inside space-y-0.5 marker:text-amber-400/70">
                        <li>Mové el mouse sobre el video → aparecen los controles del player</li>
                        <li>Buscá el ícono <strong className="text-amber-200">🔊 Audio</strong> o <strong className="text-amber-200">CC</strong> (a veces dice "ES" o un engranaje ⚙️)</li>
                        <li>Elegí <strong className="text-emerald-300">"Español"</strong>, <strong className="text-emerald-300">"Latino"</strong> o <strong className="text-emerald-300">"Spanish"</strong></li>
                        <li>Si NO aparece la opción → este servidor no tiene doblaje. Tocá los números <strong>1, 2, 3…</strong> arriba para probar otro.</li>
                      </ol>
                      <p className="text-muted/60 text-[10px] leading-relaxed pt-1 border-t border-amber-400/20">
                        💡 <strong>EmbedMaster</strong>, <strong>VidLink</strong> y <strong>111Movies</strong> son los que con más frecuencia traen pista latina.
                      </p>
                    </div>
                    <button onClick={() => setShowLang(false)} className="text-muted/40 hover:text-chalk transition-colors flex-shrink-0">
                      <X size={12} weight="bold" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── PLAYER ── */}
            <div
              className="relative w-full bg-black"
              style={{ paddingBottom: '56.25%' }}
              onMouseMove={onUserInteract}
              onMouseDown={onUserInteract}
              onTouchStart={onUserInteract}
            >
              {/* Spinner — ahora con botón "Saltar al siguiente" prominente */}
              <AnimatePresence>
                {phase === 'loading' && (
                  <motion.div key="spin"
                    initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
                    className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-void">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                      className="w-10 h-10 rounded-full border-2 border-gold/15 border-t-gold pointer-events-none" />
                    <p className="text-chalk/70 text-sm font-mono">
                      {src?.label}
                      <span className="text-muted/40 ml-2">· {srcIdx + 1}/{sources.length}</span>
                    </p>

                    {/* Botón SALTAR — aparece después de 3s sin importar nada */}
                    <motion.button
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 3, duration: 0.3 }}
                      onClick={() => goTo((srcIdx + 1) % sources.length)}
                      className="px-5 py-2 rounded-full bg-gold text-void font-bold text-sm hover:bg-gold-hi shadow-[0_4px_24px_rgba(232,160,32,0.4)] transition-all"
                    >
                      Saltar al siguiente →
                    </motion.button>

                    {isSlowNet && (
                      <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.5 }}
                        className="text-muted/35 text-[10px] font-mono text-center max-w-[28ch]">
                        Conexión lenta · puede tardar en arrancar
                      </motion.p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Barra de auto-next */}
              <AnimatePresence>
                {phase === 'ready' && (
                  <motion.div key="bar"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none">
                    <div className="h-[2px] w-full bg-white/5">
                      <div className="h-full bg-gold/50 transition-none" style={{ width: `${progress}%` }} />
                    </div>
                    {progress > 35 && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                        className="absolute bottom-3 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-void/80 border border-white/8 backdrop-blur-sm">
                        <span className="text-muted/70 text-[10px] font-mono">
                          Probando {srcIdx + 2}/{sources.length}
                        </span>
                        <button onClick={(e) => { e.stopPropagation(); goTo(srcIdx + 1) }}
                          className="text-gold text-[10px] font-semibold hover:underline pointer-events-auto">
                          Ahora
                        </button>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Fallo total — pantalla honesta + WatchProviders */}
              <AnimatePresence>
                {phase === 'failed' && (
                  <motion.div key="fail"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-void text-center px-6 overflow-y-auto pointer-events-auto">
                    <SmileySad size={36} className="text-dim" />
                    <div className="space-y-2 max-w-md">
                      <p className="text-chalk font-display font-semibold text-lg">
                        Esta peli no la tenemos
                      </p>
                      <p className="text-muted text-sm">
                        Probamos los <strong className="text-chalk/85">{sources.length} servidores</strong> y ninguno la indexó todavía.
                        Suele pasar con estrenos recientes o cine de nicho.
                      </p>
                      <p className="text-muted/60 text-xs">
                        Te mostramos abajo las opciones legales donde sí está disponible.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 justify-center">
                      <button onClick={() => goTo(0)}
                        className="px-5 py-2 rounded-full bg-gold text-void text-sm font-semibold hover:bg-gold-hi transition-colors">
                        Reintentar
                      </button>
                      <button onClick={() => {
                        try {
                          const reported = JSON.parse(localStorage.getItem('repelis:reported:v1') || '[]')
                          if (!reported.includes(movieId)) {
                            reported.push(movieId)
                            localStorage.setItem('repelis:reported:v1', JSON.stringify(reported))
                          }
                        } catch {}
                        alert('Gracias. Reportamos esta peli como no disponible para revisar.')
                      }}
                        className="px-5 py-2 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm font-semibold hover:bg-amber-500/20 transition-colors">
                        Reportar
                      </button>
                      <button onClick={handleClose}
                        className="px-5 py-2 rounded-full glass border border-white/10 text-muted text-sm hover:text-chalk transition-colors">
                        Cerrar
                      </button>
                    </div>

                    {/* WatchProviders embebido — soluciona honestamente el problema */}
                    {movieId && (
                      <div className="w-full max-w-2xl mt-2 text-left">
                        <WatchProviders id={movieId} mediaType={mediaType} title={title} />
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <iframe
                key={`${movieId}-${mediaType}-${localSeason}-${localEpisode}-${srcIdx}-${key}`}
                src={url}
                title={title || 'Reproductor'}
                className="absolute inset-0 w-full h-full"
                frameBorder="0"
                allowFullScreen
                allow={src?.allowAttr || DEFAULT_ALLOW}
                referrerPolicy="no-referrer"
                loading="eager"
                importance="high"
                onLoad={onIframeLoad}
                onError={onIframeError}
                style={{
                  // Fuerza al iframe a su propia capa de GPU para que el
                  // browser no recomponga el video con cada repaint del DOM.
                  transform: 'translateZ(0)',
                  willChange: 'transform',
                  contain: 'layout paint',
                  backfaceVisibility: 'hidden',
                }}
                {...(src?.sandbox ? { sandbox: src.sandbox } : {})}
              />
            </div>

            {/* ── DIÁLOGO ABRIR EN PESTAÑA EXTERNA ── */}
            <AnimatePresence>
              {showExtConfirm && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 z-30 flex items-center justify-center bg-black/85 backdrop-blur-sm"
                  onClick={() => setShowExtConfirm(false)}
                >
                  <motion.div
                    initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
                    className="max-w-md mx-4 p-5 rounded-2xl bg-[#0E0E18] border border-white/10 shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-start gap-3 mb-4">
                      <Warning size={20} weight="fill" className="text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-chalk font-display font-semibold text-sm mb-1">Abrir en pestaña externa</p>
                        <p className="text-muted text-xs leading-relaxed mb-2">
                          Vamos a abrir el reproductor de <strong className="text-chalk/80">{src?.label}</strong> en una pestaña nueva.
                          Es un servidor de terceros — puede mostrar publicidad o pop-ups. <strong className="text-chalk/80">No instales nada que te ofrezca.</strong>
                        </p>
                        <p className="text-muted/70 text-xs leading-relaxed">
                          <strong className="text-gold/80">¿Querés descargar?</strong> Instalá la extensión <em>"Video DownloadHelper"</em> en tu navegador y, en la pestaña externa, va a aparecer el ícono para bajar el video.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setShowExtConfirm(false)}
                        className="px-4 py-2 rounded-full text-muted text-xs font-semibold hover:text-chalk transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleOpenExternal}
                        className="px-4 py-2 rounded-full bg-gold text-void text-xs font-bold hover:bg-gold-hi transition-colors"
                      >
                        Abrir
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── BARRA INFERIOR ── */}
            <div className="flex items-center justify-between px-4 py-1.5 bg-[#0A0A14] border-t border-white/[0.03]">
              <div className="flex items-center gap-2">
                <span className="text-muted/25 text-[10px] font-mono hidden sm:block">ESC · cerrar</span>
                {isTV && (
                  <div className="flex items-center gap-1.5 sm:hidden">
                    <button onClick={prevEpisode} disabled={localSeason === 1 && localEpisode === 1}
                      className="text-muted/50 hover:text-chalk disabled:opacity-20 transition-colors p-1">
                      <SkipBack size={12} weight="fill" />
                    </button>
                    <span className="text-[10px] font-mono text-muted/50">S{localSeason}E{localEpisode}</span>
                    <button onClick={nextEpisode} className="text-muted/50 hover:text-chalk transition-colors p-1">
                      <SkipForward size={12} weight="fill" />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 mx-auto sm:mx-0 flex-wrap justify-center">
                {sources.map((s, i) => (
                  <button key={s.id} onClick={() => goTo(i)} title={`${s.label}${s.esLat ? ' 🇲🇽 audio latino' : ''}`}
                    className={`px-2 py-0.5 rounded text-[10px] transition-all duration-150 flex items-center gap-1 ${
                      i === srcIdx
                        ? s.premium ? 'bg-purple-500/12 text-purple-300 border border-purple-500/20'
                          : s.esLat ? 'bg-emerald-500/12 text-emerald-300 border border-emerald-500/20'
                          : 'bg-gold/12 text-gold border border-gold/18'
                        : 'text-muted/30 hover:text-muted border border-transparent'
                    }`}>
                    {s.premium && <Star size={8} weight="fill" className={i === srcIdx ? 'text-purple-400' : 'text-muted/20'} />}
                    {!s.premium && s.esLat && <span className="text-[10px] leading-none">🇲🇽</span>}
                    {s.label}
                  </button>
                ))}
              </div>
              {isSlowNet && (
                <div className="flex items-center gap-1 sm:hidden">
                  <WifiLow size={10} weight="fill" className="text-amber-400/50" />
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
