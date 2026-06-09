import { useEffect, useCallback, useState, useRef, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, FilmSlate, ArrowClockwise, CaretRight, CaretLeft,
  SmileySad, WifiLow, Subtitles, Info, Star,
  SkipForward, SkipBack, DownloadSimple, Warning,
} from '@phosphor-icons/react'
import { closePlayer, setEpisode } from '../../store/slices/playerSlice'
import { getOrderedSources, buildUrl, rememberSource, DEFAULT_ALLOW } from '../../lib/playerSources'
import { getNetworkInfo } from '../../lib/network'
import { buildDownloadUrl, wasDisclaimerShown, markDisclaimerShown } from '../../lib/downloadLinks'

// ─── Timeouts (clave para velocidad) ────────────────────────────────────
// Antes: 8s en buena red, 16s en lenta. El usuario esperaba demasiado para
// que se descartara un servidor caído. Ahora: 3.5s (good) / 5s (moderate)
// / 7s (slow). En 1 Mbps un buen embed ya devolvió onLoad en <2s.
const NEXT_MS_GOOD = 3500
const NEXT_MS_MODERATE = 5000
const NEXT_MS_SLOW = 7000

// Tras cuánto tiempo de iframe abierto sin error consideramos "ya está reproduciendo"
// y lo dejamos quieto sin importar interacción.
const ASSUME_PLAYING_MS = 6000

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

  // El orden de SOURCES se calcula UNA vez por apertura (último éxito al frente).
  const sources = useMemo(() => getOrderedSources(), [isOpen, movieId, initSeason, initEpisode])

  const [srcIdx,    setSrcIdx]    = useState(0)
  const [key,       setKey]       = useState(0)
  const [phase,     setPhase]     = useState('loading')
  const [progress,  setProgress]  = useState(0)
  const [showLang,  setShowLang]  = useState(false)
  const [showDlConfirm, setShowDlConfirm] = useState(false)
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
      setShowLang(false)
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

  const onIframeError = useCallback(() => {
    // El servidor murió de forma explícita → saltar inmediato.
    if (successRef.current) return
    stopTimers()
    setSrcIdx((cur) => {
      const next = cur + 1
      if (next >= sources.length) { setPhase('failed'); return cur }
      successRef.current = false
      setKey((k) => k + 1)
      setPhase('loading')
      setShowLang(false)
      return next
    })
  }, [sources.length, stopTimers])

  const onUserInteract = useCallback(() => {
    // Cualquier mouse/click del usuario sobre el player es un voto fuerte
    // de que está viendo algo. Bloqueamos cambios automáticos.
    lockSuccess(sources[srcIdx]?.id)
  }, [lockSuccess, sources, srcIdx])

  const src = sources[srcIdx]
  const isTV = mediaType === 'tv'
  const url = movieId ? buildUrl(src, { mediaType, id: movieId, season: localSeason, episode: localEpisode }) : ''

  const handleDownload = useCallback((providerIdx = 0) => {
    if (!movieId) return
    const dlUrl = buildDownloadUrl(
      { mediaType, id: movieId, season: localSeason, episode: localEpisode },
      providerIdx,
    )
    window.open(dlUrl, '_blank', 'noopener,noreferrer')
    markDisclaimerShown()
    setShowDlConfirm(false)
  }, [movieId, mediaType, localSeason, localEpisode])

  const handleDownloadClick = useCallback(() => {
    if (wasDisclaimerShown()) handleDownload(0)
    else setShowDlConfirm(true)
  }, [handleDownload])

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

              {/* Nav servidores */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button onClick={() => goTo((srcIdx - 1 + sources.length) % sources.length)}
                  className="w-6 h-6 flex items-center justify-center rounded text-muted/50 hover:text-chalk transition-colors">
                  <CaretLeft size={10} weight="bold" />
                </button>
                {sources.map((s, i) => (
                  <button key={s.id} onClick={() => goTo(i)} title={`${s.label}${s.premium ? ' ★' : ''}`}
                    className={`w-6 h-6 flex items-center justify-center rounded text-[11px] font-semibold transition-all duration-150 relative ${
                      i === srcIdx
                        ? s.premium ? 'bg-purple-500/20 text-purple-300' : 'bg-gold/20 text-gold'
                        : 'text-muted/40 hover:text-chalk hover:bg-white/5'
                    }`}>
                    {i + 1}
                    {s.premium && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-purple-400 border border-void" />
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

              <button onClick={handleDownloadClick} title="Descargar (externo)"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-muted/50 hover:text-gold hover:bg-gold/8 transition-all flex-shrink-0">
                <DownloadSimple size={13} weight="bold" />
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
                  <div className="flex items-start gap-3 px-4 py-3">
                    <Info size={14} className="text-gold flex-shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <p className="text-chalk/80 text-xs font-semibold">Audio en español</p>
                      <p className="text-muted/65 text-[11px] leading-relaxed">
                        EmbedMaster (fuente 1) tiene los mejores servidores Premium con multi-idioma. Si la pista de doblaje existe, la vas a encontrar ahí primero.
                        <span className="text-gold/70 ml-1">Buscá el ícono de audio 🔊 en el player para cambiar idioma.</span>
                      </p>
                    </div>
                    <button onClick={() => setShowLang(false)} className="text-muted/30 hover:text-chalk transition-colors">
                      <X size={11} weight="bold" />
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
              {/* Spinner */}
              <AnimatePresence>
                {phase === 'loading' && (
                  <motion.div key="spin"
                    initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
                    className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-void pointer-events-none">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                      className="w-10 h-10 rounded-full border-2 border-gold/15 border-t-gold" />
                    <p className="text-muted/60 text-xs font-mono">{src?.label}</p>
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

              {/* Fallo total */}
              <AnimatePresence>
                {phase === 'failed' && (
                  <motion.div key="fail"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-void text-center px-8 pointer-events-auto">
                    <SmileySad size={36} className="text-dim" />
                    <div className="space-y-1.5">
                      <p className="text-chalk font-display font-semibold">Contenido no disponible</p>
                      <p className="text-muted text-sm max-w-[38ch]">
                        Probamos {sources.length} servidores y ninguno tiene este contenido. Puede ser un estreno muy reciente.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => goTo(0)}
                        className="px-5 py-2 rounded-full bg-gold text-void text-sm font-semibold hover:bg-gold-hi transition-colors">
                        Reintentar
                      </button>
                      <button onClick={handleClose}
                        className="px-5 py-2 rounded-full glass border border-white/10 text-muted text-sm hover:text-chalk transition-colors">
                        Cerrar
                      </button>
                    </div>
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

            {/* ── DIÁLOGO CONFIRMACIÓN DESCARGA ── */}
            <AnimatePresence>
              {showDlConfirm && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 z-30 flex items-center justify-center bg-black/85 backdrop-blur-sm"
                  onClick={() => setShowDlConfirm(false)}
                >
                  <motion.div
                    initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
                    className="max-w-md mx-4 p-5 rounded-2xl bg-[#0E0E18] border border-white/10 shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-start gap-3 mb-4">
                      <Warning size={20} weight="fill" className="text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-chalk font-display font-semibold text-sm mb-1">Descarga externa</p>
                        <p className="text-muted text-xs leading-relaxed">
                          Te vamos a abrir un servidor de terceros (no controlamos su contenido ni su seguridad).
                          Puede mostrar publicidad agresiva o pop-ups. <strong className="text-chalk/80">No instales nada que te ofrezca.</strong>
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setShowDlConfirm(false)}
                        className="px-4 py-2 rounded-full text-muted text-xs font-semibold hover:text-chalk transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => handleDownload(1)}
                        className="px-4 py-2 rounded-full border border-white/10 text-muted text-xs font-semibold hover:text-chalk hover:border-white/20 transition-colors"
                      >
                        Servidor alternativo
                      </button>
                      <button
                        onClick={() => handleDownload(0)}
                        className="px-4 py-2 rounded-full bg-gold text-void text-xs font-bold hover:bg-gold-hi transition-colors"
                      >
                        Continuar
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
                  <button key={s.id} onClick={() => goTo(i)} title={s.label}
                    className={`px-2 py-0.5 rounded text-[10px] transition-all duration-150 flex items-center gap-1 ${
                      i === srcIdx
                        ? s.premium ? 'bg-purple-500/12 text-purple-300 border border-purple-500/20' : 'bg-gold/12 text-gold border border-gold/18'
                        : 'text-muted/30 hover:text-muted border border-transparent'
                    }`}>
                    {s.premium && <Star size={8} weight="fill" className={i === srcIdx ? 'text-purple-400' : 'text-muted/20'} />}
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
