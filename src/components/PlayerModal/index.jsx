import { useEffect, useCallback, useState, useRef, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, FilmSlate, ArrowClockwise, CaretRight, CaretLeft,
  SmileySad, WifiLow, Subtitles, Info, Star,
  SkipForward, SkipBack, ArrowSquareOut, Warning,
  CornersOut, CornersIn,
} from '@phosphor-icons/react'
import { closePlayer, setEpisode } from '../../store/slices/playerSlice'
import { reportPlayerEvent, clearPlayback } from '../../lib/playback'
import { getOrderedSources, buildUrl, rememberSource, DEFAULT_ALLOW } from '../../lib/playerSources'
import { getNetworkInfo } from '../../lib/network'
import { getServerHistory, reportServerFailure } from '../../lib/serverHealth'
import { getTVSeason } from '../../api/tmdb'
import { useLibrary } from '../../lib/library'
import { useAuth } from '../../lib/auth'
import { canUsePersonal } from '../../lib/access'
import AccessGate from '../AccessGate'
import { nextTarget, shouldOfferNext } from '../../lib/nextEpisode'
import NextEpisodeCard from '../NextEpisodeCard'
import { showToast } from '../../lib/toast'
import WatchProviders from '../WatchProviders'
import { useWatchTracker } from '../../lib/useWatchTracker'
import { tt, isEnglish } from '../../lib/i18n'
import {
  escShouldClose, nextUntried, emitsEvents, isPlayerSignal, loadTimeoutMs, silentTimeoutMs,
} from '../../lib/playerGuard'

// ─── Cómo se decide si un servidor anda ───────────────────────────────────
// Un iframe de otro sitio no deja ver qué muestra por dentro: "cargó" no quiere decir "se ve".
//  · Si nunca carga (servidor caído)            → pasamos solos al siguiente.
//  · Si avisa por postMessage (VidLink/VidFast) → con el primer aviso queda confirmado;
//    si calla mucho tiempo y nadie tocó el video → pasamos solos al siguiente.
//  · Si no avisa (el resto)                     → no lo tocamos (podría estar viéndose bien) y ofrecemos,
//    bien a la vista, "¿No se ve? Probar otro servidor".
// Nunca se cierra el reproductor solo: ESC en pantalla completa, toques en el fondo y el botón "atrás" no lo cierran por accidente.

// Tras cuánto tiempo asumimos que está reproduciendo (para Continuar viendo), si el servidor no avisa.
const ASSUME_PLAYING_MS = 5000
// A los cuántos segundos de cargado ofrecemos "¿No se ve?" si nada confirmó que arrancó.
const HELP_AFTER_MS = 9000

// Skip rápido: si el servidor tuvo <30% uptime histórico, lo mandamos al final de la cola
// (solo aplica si hay >=5 mediciones previas).
const UPTIME_SKIP_THRESHOLD = 30
const UPTIME_MIN_SAMPLES = 5

// ─── Guards ──────────────────────────────────────────────────────────────
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
  'https://vidlink.pro',
  'https://embedmaster.link',
  'https://111movies.com',
  'https://vidfast.pro',
  'https://vidsrc.cc',
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

/** Mantiene la pantalla encendida mientras se mira (el celular no se apaga en plena película). */
const useWakeLock = (active) => {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !navigator.wakeLock) return undefined
    let lock = null
    let cancelled = false
    const acquire = async () => {
      try {
        const l = await navigator.wakeLock.request('screen')
        if (cancelled) { l.release?.().catch(() => {}); return }
        lock = l
      } catch { /* sin permiso o sin batería: no pasa nada */ }
    }
    const onVisible = () => { if (document.visibilityState === 'visible') acquire() }
    acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release?.().catch(() => {})
    }
  }, [active])
}

const isCompactScreen = () => typeof window !== 'undefined' && window.matchMedia?.('(max-width: 639px)').matches

// ─────────────────────────────────────────────────────────────────────────
export default function PlayerModal() {
  const dispatch = useDispatch()
  const { isOpen, movieId, title, mediaType, season: initSeason, episode: initEpisode, totalSeasons, item: playerItem, runtimeMin, locked } =
    useSelector((s) => s.player)
  const auth = useAuth()
  // Títulos muy calificados/populares: para darles play hace falta cuenta gratis (si el servicio de cuentas falla, se deja ver).
  // La puerta se evalúa al abrir: si la sesión vence a mitad de la película, el video NO se reemplaza ni se corta.
  const [passedGate, setPassedGate] = useState(false)
  const needsGate = isOpen && locked && (auth.status === 'out' || auth.status === 'loading')
  const gated = needsGate && !passedGate
  useEffect(() => {
    if (!isOpen) { setPassedGate(false); return }
    if (!needsGate) setPassedGate(true)
  }, [isOpen, needsGate])

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
  const [phase,     setPhase]     = useState('loading')   // loading → ready (cargó) → playing (confirmado/asumido) | failed
  const [showHelp,  setShowHelp]  = useState(false)       // "¿No se ve? Probar otro servidor" sobre el video
  const [showLang,  setShowLang]  = useState(false)
  const [showExtConfirm, setShowExtConfirm] = useState(false)
  const [immersive, setImmersive] = useState(false)       // video a pantalla completa (nativa o simulada)
  // TV local state
  const [localSeason,  setLocalSeason]  = useState(initSeason  || 1)
  const [localEpisode, setLocalEpisode] = useState(initEpisode || 1)
  // Siguiente episodio: cuántos episodios tiene la temporada y si descartó el cartel
  const [episodeCount, setEpisodeCount] = useState(0)
  const [nextDismissed, setNextDismissed] = useState('')
  const library = useLibrary()

  const shellRef    = useRef(null)
  const iframeRef   = useRef(null)
  const timers      = useRef({ load: null, silent: null, assume: null, help: null })
  const successRef  = useRef(false)     // ya se da por reproduciendo (frena cualquier salto automático)
  const verifiedRef = useRef(false)     // el propio reproductor avisó que arrancó
  const interactedRef = useRef(false)   // la persona tocó el video
  const loadedRef   = useRef(false)
  const triedRef    = useRef(new Set([0]))
  const lastFsRef   = useRef(0)
  const closingRef  = useRef(false)
  const latest      = useRef({})

  const net = useNetworkQuality()
  const isSlowNet = net.quality === 'slow' || net.quality === 'moderate'

  usePreconnect(isOpen)
  useWakeLock(isOpen && !gated)

  // Continuar viendo / rachas / logros: cuenta el tiempo realmente reproducido
  const trackedItem = useMemo(
    () => {
      const base = playerItem || (movieId ? { id: movieId, type: mediaType === 'tv' ? 'tv' : 'movie', title, poster: null, backdrop: null, date: null, genres: [] } : null)
      return base ? { ...base, totalSeasons } : null
    },
    [playerItem, movieId, mediaType, title, totalSeasons],
  )
  useWatchTracker({
    active: isOpen,
    playing: phase === 'playing',
    item: trackedItem,
    season: localSeason,
    episode: localEpisode,
    runtimeMin,
    persist: canUsePersonal(auth.status),
  })

  const stopTimers = useCallback(() => {
    const t = timers.current
    clearTimeout(t.load); clearTimeout(t.silent); clearTimeout(t.assume); clearTimeout(t.help)
    t.load = t.silent = t.assume = t.help = null
  }, [])

  const lockSuccess = useCallback((sourceId) => {
    if (successRef.current) return
    successRef.current = true
    rememberSource(sourceId)
    stopTimers()
    setShowHelp(false)
    setPhase('playing')
  }, [stopTimers])

  /** Cambio MANUAL de servidor: se vuelve a poder probar cualquiera. */
  const goTo = useCallback((idx) => {
    stopTimers()
    successRef.current = false
    verifiedRef.current = false
    interactedRef.current = false
    loadedRef.current = false
    triedRef.current = new Set([idx])
    setSrcIdx(idx)
    setKey((k) => k + 1)
    setPhase('loading')
    setShowLang(false)
    setShowHelp(false)
  }, [stopTimers])

  /** Salto AUTOMÁTICO (servidor caído o mudo): nunca repite uno ya probado; al agotarlos todos muestra el fallo. */
  const advance = useCallback((reason) => {
    const { sources: list, srcIdx: cur } = latest.current
    if (!list?.length || successRef.current) return
    stopTimers()
    const failing = list[cur]
    reportServerFailure(failing?.id)
    triedRef.current.add(cur)
    const nxt = nextUntried(triedRef.current, cur, list.length)
    if (nxt < 0) { setPhase('failed'); setShowHelp(false); return }
    triedRef.current.add(nxt)
    loadedRef.current = false
    verifiedRef.current = false
    interactedRef.current = false
    setSrcIdx(nxt)
    setKey((k) => k + 1)
    setPhase('loading')
    setShowHelp(false)
    showToast({
      icon: '🔄',
      title: tt("Probando otro servidor ({v1} de {length})", { v1: nxt + 1, length: list.length }),
      text: reason === 'timeout' ? tt("{name} no respondió.", { name: failing?.label || '' }) : tt("{name} no arrancó el video.", { name: failing?.label || '' }),
      ttl: 3000, tone: 'blue',
    })
  }, [stopTimers])

  const handleClose = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    stopTimers()
    // Si abrimos una entrada de historial al abrir, la sacamos (así "atrás" no deja la página)
    try { if (window.history.state?.lhPlayer) window.history.back() } catch { /* nada */ }
    try { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}) } catch { /* nada */ }
    setImmersive(false)
    dispatch(closePlayer())
    setSrcIdx(0)
    setPhase('loading')
    setShowLang(false)
    setShowHelp(false)
    successRef.current = false
    setTimeout(() => { closingRef.current = false }, 300)
  }, [dispatch, stopTimers])

  // Sync TV episode + reset al abrir
  useEffect(() => {
    if (isOpen) {
      setLocalSeason(initSeason || 1)
      setLocalEpisode(initEpisode || 1)
      successRef.current = false
      verifiedRef.current = false
      interactedRef.current = false
      loadedRef.current = false
      triedRef.current = new Set([0])
      setSrcIdx(0)
      setKey((k) => k + 1)
      setPhase('loading')
      setShowHelp(false)
      // Tip del audio en español: solo en español y en pantallas grandes (en el celular no tapa el video; hay botón).
      let t
      if (!isEnglish() && !isCompactScreen()) {
        setShowLang(true)
        t = setTimeout(() => setShowLang(false), 15_000)
      } else setShowLang(false)
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
    verifiedRef.current = false
    interactedRef.current = false
    loadedRef.current = false
    triedRef.current = new Set([0])
    setSrcIdx(0)
    setKey((k) => k + 1)
    setPhase('loading')
    setShowHelp(false)
  }, [dispatch, stopTimers])

  const target = useMemo(
    () => nextTarget({ season: localSeason, episode: localEpisode, episodeCount, totalSeasons }),
    [localSeason, localEpisode, episodeCount, totalSeasons],
  )

  const nextEpisode = useCallback(() => {
    if (target) changeEpisode(target.season, target.episode)
  }, [target, changeEpisode])

  // Cantidad de episodios de la temporada en curso (para saber si hay "siguiente")
  useEffect(() => {
    if (!isOpen || mediaType !== 'tv' || !movieId) return undefined
    let cancelled = false
    setEpisodeCount(0)
    getTVSeason(movieId, localSeason)
      .then(({ data }) => { if (!cancelled) setEpisodeCount(data?.episodes?.length || 0) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [isOpen, mediaType, movieId, localSeason])

  const histEntry = library.history.find((h) => h.type === 'tv' && h.id === movieId)
  const offerNext = isOpen && phase === 'playing' && mediaType === 'tv' && !!target &&
    nextDismissed !== `${localSeason}:${localEpisode}` &&
    histEntry?.season === localSeason && histEntry?.episode === localEpisode &&
    shouldOfferNext({ watchedSec: histEntry?.watchedSec || 0, runtimeMin: histEntry?.runtimeMin || runtimeMin, isTV: true, hasNext: !!target })

  const prevEpisode = useCallback(() => {
    if (localEpisode > 1) changeEpisode(localSeason, localEpisode - 1)
    else if (localSeason > 1) changeEpisode(localSeason - 1, 1)
  }, [localSeason, localEpisode, changeEpisode])

  // ─── Pantalla completa (nativa si el navegador deja; si no, "inmersiva" simulada) ───
  const toggleImmersive = useCallback(() => {
    const el = shellRef.current
    if (document.fullscreenElement) { document.exitFullscreen?.().catch(() => {}); return }
    if (immersive) { setImmersive(false); return }
    if (el?.requestFullscreen) {
      el.requestFullscreen({ navigationUI: 'hide' })
        .then(() => { try { window.screen?.orientation?.lock?.('landscape')?.catch(() => {}) } catch { /* nada */ } })
        .catch(() => setImmersive(true))
    } else setImmersive(true)
  }, [immersive])

  useEffect(() => {
    if (!isOpen) return undefined
    const onFs = () => {
      lastFsRef.current = Date.now()
      setImmersive(!!document.fullscreenElement)
      if (!document.fullscreenElement) { try { window.screen?.orientation?.unlock?.() } catch { /* nada */ } }
    }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [isOpen])

  // Teclado + bloqueo del scroll de fondo
  useEffect(() => {
    if (!isOpen) return undefined
    const h = (e) => {
      if (e.key !== 'Escape') return
      if (immersive && !document.fullscreenElement) { setImmersive(false); return }   // sale de la pantalla simulada
      if (!escShouldClose({ fullscreenActive: !!document.fullscreenElement, lastFullscreenChangeAt: lastFsRef.current })) return
      handleClose()
    }
    window.addEventListener('keydown', h)
    document.body.style.overflow = 'hidden'
    // Marca al body para que el CSS apague overlays/blur que comen GPU mientras el video se reproduce
    document.body.classList.add('player-active')
    return () => {
      window.removeEventListener('keydown', h)
      document.body.style.overflow = ''
      document.body.classList.remove('player-active')
    }
  }, [isOpen, handleClose, immersive])

  // Botón "atrás" (Android/gesto del iPhone): cierra el reproductor en vez de sacar de la página
  useEffect(() => {
    if (!isOpen) return undefined
    try { window.history.pushState({ ...(window.history.state || {}), lhPlayer: 1 }, '') } catch { /* nada */ }
    const onPop = () => {
      if (closingRef.current) return
      closingRef.current = true
      stopTimers()
      try { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}) } catch { /* nada */ }
      setImmersive(false)
      dispatch(closePlayer())
      setSrcIdx(0); setPhase('loading'); setShowLang(false); setShowHelp(false)
      successRef.current = false
      setTimeout(() => { closingRef.current = false }, 300)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Si un servidor intenta mandarte a otra página (anuncio), el navegador pregunta antes de irse
  useEffect(() => {
    if (!isOpen || gated) return undefined
    const guard = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [isOpen, gated])

  // Avisos del propio reproductor (VidLink/VidFast/…): confirman que arrancó y alimentan las salas
  useEffect(() => {
    if (!isOpen) return undefined
    const handler = (e) => {
      const d = e.data
      if (!d) return
      reportPlayerEvent(d)          // minuto de reproducción (para sincronizar las salas)
      if (isPlayerSignal(d)) {
        verifiedRef.current = true
        lockSuccess(latest.current.sources?.[latest.current.srcIdx]?.id)
      }
    }
    window.addEventListener('message', handler)
    return () => { window.removeEventListener('message', handler); clearPlayback() }
  }, [isOpen, lockSuccess])

  // Un toque dentro del video (cross-origin): el foco pasa al iframe. Es la señal de que la persona lo está usando.
  useEffect(() => {
    if (!isOpen) return undefined
    const onBlur = () => {
      setTimeout(() => {
        if (document.activeElement && document.activeElement === iframeRef.current) {
          interactedRef.current = true
          clearTimeout(timers.current.silent)
          setShowHelp(false)
          if (!emitsEvents(latest.current.sources?.[latest.current.srcIdx])) lockSuccess(latest.current.sources?.[latest.current.srcIdx]?.id)
        }
      }, 0)
    }
    window.addEventListener('blur', onBlur)
    return () => window.removeEventListener('blur', onBlur)
  }, [isOpen, lockSuccess])

  const src = sources[srcIdx]
  latest.current = { sources, srcIdx }
  const isTV = mediaType === 'tv'
  const url = movieId ? buildUrl(src, { mediaType, id: movieId, season: localSeason, episode: localEpisode }) : ''
  const iframeKey = `${movieId}-${mediaType}-${localSeason}-${localEpisode}-${srcIdx}-${key}`

  // Servidor caído: si el iframe no termina de cargar, pasamos solos al siguiente
  useEffect(() => {
    if (!isOpen || gated || !movieId || !url) return undefined
    timers.current.load = setTimeout(() => { if (!loadedRef.current) advance('timeout') }, loadTimeoutMs(net.quality))
    return () => stopTimers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iframeKey, isOpen, gated])

  const onIframeLoad = useCallback(() => {
    if (loadedRef.current) return                 // algunos embeds recargan por dentro: lo ignoramos
    loadedRef.current = true
    clearTimeout(timers.current.load)
    if (successRef.current) return
    setPhase('ready')
    const current = latest.current.sources?.[latest.current.srcIdx]
    const talks = emitsEvents(current)
    if (talks) {
      // Este servidor avisa lo que pasa: si calla y nadie lo tocó, no arrancó
      timers.current.silent = setTimeout(() => {
        if (!verifiedRef.current && !interactedRef.current) advance('silent')
      }, silentTimeoutMs(net.quality))
    } else {
      // No avisa: asumimos que anda (para Continuar viendo) y ofrecemos ayuda por si no se ve
      timers.current.assume = setTimeout(() => lockSuccess(current?.id), ASSUME_PLAYING_MS)
    }
    timers.current.help = setTimeout(() => { if (!verifiedRef.current && !interactedRef.current) setShowHelp(true) }, HELP_AFTER_MS)
  }, [advance, lockSuccess, net.quality])

  // Abre el URL actual del servidor en una pestaña nueva.
  // Sirve para: (1) usar extensiones de descarga del browser, (2) fullscreen del servidor, (3) debug.
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

  /** "¿No anda?": sigue la cola de servidores y deja constancia para ordenarlos mejor. */
  const tryAnother = useCallback(() => {
    reportServerFailure(src?.id)
    const next = (srcIdx + 1) % sources.length
    goTo(next)
    showToast({ icon: '🔄', title: tt("Probando otro servidor ({v1} de {length})", { v1: next + 1, length: sources.length }), text: tt("Gracias por avisar: lo tenemos en cuenta para ordenar los servidores."), ttl: 3500, tone: 'blue' })
  }, [src, srcIdx, sources.length, goTo])

  const serverChip = (s, i, size) => (
    <button key={s.id} onClick={() => goTo(i)} title={`${s.label}${s.esLat ? ' 🇲🇽 audio latino' : ''}`}
      className={`${size} rounded-lg text-xs transition-all duration-150 flex items-center gap-1.5 flex-shrink-0 border ${
        i === srcIdx
          ? s.premium ? 'bg-purple-500/15 text-purple-200 border-purple-500/30'
            : s.esLat ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30'
            : 'bg-gold/15 text-gold border-gold/30'
          : 'text-muted/70 hover:text-chalk border-white/10 hover:border-white/20 bg-white/[0.03]'
      }`}>
      {s.premium && <Star size={9} weight="fill" className={i === srcIdx ? 'text-purple-300' : 'text-muted/30'} />}
      {!s.premium && s.esLat && <span className="text-[11px] leading-none">🇲🇽</span>}
      {s.label}
    </button>
  )

  return (
    <AnimatePresence>
      {isOpen && movieId && gated && <AccessGate key="gate" title={title} onClose={handleClose} />}
      {isOpen && movieId && !gated && (
        <motion.div
          key="bg"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="player-backdrop"
        >
          <motion.div
            ref={shellRef}
            initial={{ scale: 0.97, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.97, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className={`player-shell ${immersive ? 'player-immersive' : ''}`}
          >
            {/* ── BARRA SUPERIOR ─────────────────────────────────────── */}
            <div className="player-topbar flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-[#0E0E18] border-b border-white/[0.05]">
              <FilmSlate size={14} className="text-gold flex-shrink-0" />
              <span className="text-chalk/85 font-display font-medium text-sm truncate flex-1 min-w-0">
                {title || tt("Reproduciendo…")}
                {isTV && (
                  <span className="text-muted/60 font-mono text-xs ml-2">
                    {tt("T")}{localSeason} {tt("E")}{localEpisode}
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
                    {tt("S")}{localSeason}{tt("E")}{localEpisode}
                  </span>
                  <button onClick={nextEpisode} disabled={!target}
                    className="w-6 h-6 flex items-center justify-center rounded text-muted/50 hover:text-chalk disabled:opacity-20 transition-colors">
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
                    <option key={s} value={s}>{tt("Temporada")} {s}</option>
                  ))}
                </select>
              )}

              {/* Badge idioma (solo escritorio; en el celular está en el panel de abajo) */}
              <AnimatePresence>
                {!isEnglish() && (phase === 'playing' || phase === 'ready') && (
                  <motion.button
                    key="langbtn"
                    initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                    onClick={() => setShowLang((v) => !v)}
                    className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono transition-all flex-shrink-0
                      ${showLang ? 'bg-gold/15 border-gold/30 text-gold' : 'bg-white/5 border-white/10 text-muted/60 hover:text-chalk hover:border-white/20'}`}
                  >
                    <Subtitles size={11} weight="fill" />
                    <span>{tt("ES")}</span>
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
                      {net.quality === 'slow' ? tt("Red lenta") : tt("Señal media")}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Badge: servidor con buen catálogo LATAM (NO garantía por título) */}
              {src?.esLat && !isEnglish() && (
                <span
                  className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-[10px] font-bold uppercase tracking-wide flex-shrink-0 cursor-help"
                  title={tt("Servidor con buen catálogo de doblaje LATAM. El audio del título específico depende de qué pistas tenga el server. Si arranca en otro idioma, cambialo desde el ícono Audio/CC del player.")}
                >
                  <span className="text-sm leading-none">🇲🇽</span>
                  {tt("LATAM probable")}
                </span>
              )}

              {/* Nav servidores (escritorio) */}
              <div className="hidden sm:flex items-center gap-0.5 flex-shrink-0">
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
                <span className="text-muted/30 text-[10px] font-mono ml-1.5 hidden lg:block w-20 truncate">
                  {src?.label}
                </span>
              </div>

              <button onClick={toggleImmersive} title={immersive ? tt("Salir de pantalla completa") : tt("Pantalla completa")}
                aria-label={immersive ? tt("Salir de pantalla completa") : tt("Pantalla completa")}
                className="w-10 h-10 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg text-muted/60 hover:text-gold hover:bg-gold/8 transition-all flex-shrink-0">
                {immersive ? <CornersIn size={15} weight="bold" /> : <CornersOut size={15} weight="bold" />}
              </button>
              <button onClick={handleExternalClick} title={tt("Abrir en pestaña externa")}
                className="hidden sm:flex w-7 h-7 items-center justify-center rounded-lg text-muted/50 hover:text-gold hover:bg-gold/8 transition-all flex-shrink-0">
                <ArrowSquareOut size={13} weight="bold" />
              </button>
              <button onClick={() => goTo(srcIdx)} title={tt("Recargar")}
                className="hidden sm:flex w-7 h-7 items-center justify-center rounded-lg text-muted/50 hover:text-chalk hover:bg-white/5 transition-all flex-shrink-0">
                <ArrowClockwise size={13} />
              </button>
              <button onClick={handleClose} title={tt("Cerrar")} aria-label={tt("Cerrar")}
                className="w-10 h-10 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg text-chalk/70 sm:text-muted/50 hover:text-red-400 hover:bg-red-400/8 transition-all flex-shrink-0">
                <X size={16} weight="bold" />
              </button>
            </div>

            {/* ── PANEL INFO ESPAÑOL ── */}
            <AnimatePresence>
              {showLang && !isEnglish() && (
                <motion.div
                  key="langtip"
                  initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden bg-[#0d0d1a] border-b border-white/[0.04]"
                >
                  <div className="flex items-start gap-3 px-4 py-3 bg-amber-500/[0.07] border-l-2 border-amber-400/40">
                    <Info size={16} weight="fill" className="text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-2">
                      <p className="text-amber-200 text-sm font-bold">{tt("⚠️ ¿Arrancó en inglés? Es normal — leé esto")}</p>
                      <p className="text-chalk/85 text-[12px] leading-relaxed">
                        {tt("El badge")} <strong>{tt("\"LATAM probable\"")}</strong> {tt("significa que el servidor tiene buen catálogo de doblajes, pero")} <strong className="text-amber-200">{tt("cada peli es distinta")}</strong>{tt(". Si arrancó en otro idioma:")}
                      </p>
                      <ol className="text-muted/85 text-[11px] leading-relaxed list-decimal list-inside space-y-0.5 marker:text-amber-400/70">
                        <li>{tt("Mové el mouse sobre el video → aparecen los controles del player")}</li>
                        <li>{tt("Buscá el ícono")} <strong className="text-amber-200">{tt("🔊 Audio")}</strong> {tt("o")} <strong className="text-amber-200">{tt("CC")}</strong> {tt("(a veces dice \"ES\" o un engranaje ⚙️)")}</li>
                        <li>{tt("Elegí")} <strong className="text-emerald-300">{tt("\"Español\"")}</strong>, <strong className="text-emerald-300">{tt("\"Latino\"")}</strong> {tt("o")} <strong className="text-emerald-300">{tt("\"Spanish\"")}</strong></li>
                        <li>{tt("Si NO aparece la opción → este servidor no tiene doblaje. Tocá los números")} <strong>1, 2, 3…</strong> {tt("arriba para probar otro.")}</li>
                      </ol>
                      <p className="text-muted/60 text-[10px] leading-relaxed pt-1 border-t border-amber-400/20">
                        💡 <strong>{tt("EmbedMaster")}</strong>, <strong>{tt("VidLink")}</strong> {tt("y")} <strong>{tt("111Movies")}</strong> {tt("son los que con más frecuencia traen pista latina.")}
                      </p>
                    </div>
                    <button onClick={() => setShowLang(false)} aria-label={tt("Cerrar")} className="text-muted/40 hover:text-chalk transition-colors flex-shrink-0 p-1">
                      <X size={12} weight="bold" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── PLAYER ── */}
            <div className="player-stage">
              {/* Spinner — con botón "Saltar al siguiente" */}
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

                    <motion.button
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 3, duration: 0.3 }}
                      onClick={() => goTo((srcIdx + 1) % sources.length)}
                      className="px-5 py-2.5 rounded-full bg-gold text-void font-bold text-sm hover:bg-gold-hi shadow-[0_4px_24px_rgba(232,160,32,0.4)] transition-all"
                    >
                      {tt("Saltar al siguiente →")}
                    </motion.button>

                    {isSlowNet && (
                      <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.5 }}
                        className="text-muted/35 text-[10px] font-mono text-center max-w-[28ch]">
                        {tt("Conexión lenta · puede tardar en arrancar")}
                      </motion.p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ¿No se ve? — ayuda sobre el video si nada confirmó que arrancó */}
              <AnimatePresence>
                {showHelp && phase !== 'failed' && (
                  <motion.div key="help"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="absolute z-10 left-2 right-2 bottom-2 sm:left-4 sm:right-auto sm:bottom-4 flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-full bg-void/90 border border-gold/30 shadow-lg">
                    <span className="text-chalk/80 text-xs">{tt("¿No se ve?")}</span>
                    <button onClick={tryAnother}
                      className="px-3 py-1.5 rounded-full bg-gold text-void text-xs font-bold hover:bg-gold-hi active:scale-95 transition-all whitespace-nowrap">
                      {tt("Probar otro servidor")}
                    </button>
                    <button onClick={() => setShowHelp(false)} aria-label={tt("Cerrar aviso")} className="w-7 h-7 flex items-center justify-center rounded-full text-muted hover:text-chalk">
                      <X size={11} weight="bold" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Fallo total — pantalla honesta + WatchProviders */}
              <AnimatePresence>
                {phase === 'failed' && (
                  <motion.div key="fail"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="absolute inset-0 z-20 flex flex-col items-center justify-start sm:justify-center gap-4 sm:gap-5 bg-void text-center px-4 sm:px-6 py-4 overflow-y-auto pointer-events-auto">
                    <SmileySad size={36} className="text-dim flex-shrink-0" />
                    <div className="space-y-2 max-w-md">
                      <p className="text-chalk font-display font-semibold text-lg">
                        {tt("Esta peli no la tenemos")}
                      </p>
                      <p className="text-muted text-sm">
                        {tt("Probamos los")} <strong className="text-chalk/85">{sources.length} {tt("servidores")}</strong> {tt("y ninguno la indexó todavía. Suele pasar con estrenos recientes o cine de nicho.")}
                      </p>
                      <p className="text-muted/60 text-xs">
                        {tt("Te mostramos abajo las opciones legales donde sí está disponible.")}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 justify-center">
                      <button onClick={() => goTo(0)}
                        className="px-5 py-2.5 rounded-full bg-gold text-void text-sm font-semibold hover:bg-gold-hi transition-colors">
                        {tt("Reintentar")}
                      </button>
                      <button onClick={() => {
                        try {
                          const reported = JSON.parse(localStorage.getItem('repelis:reported:v1') || '[]')
                          if (!reported.includes(movieId)) {
                            reported.push(movieId)
                            localStorage.setItem('repelis:reported:v1', JSON.stringify(reported))
                          }
                        } catch {}
                        showToast({ icon: '🙏', title: tt("Gracias. Reportamos esta peli como no disponible para revisar."), ttl: 3500, tone: 'blue' })
                      }}
                        className="px-5 py-2.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm font-semibold hover:bg-amber-500/20 transition-colors">
                        {tt("Reportar")}
                      </button>
                      <button onClick={handleClose}
                        className="px-5 py-2.5 rounded-full glass border border-white/10 text-muted text-sm hover:text-chalk transition-colors">
                        {tt("Cerrar")}
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

              <AnimatePresence>
                {offerNext && (
                  <NextEpisodeCard
                    key={`next-${localSeason}-${localEpisode}`}
                    target={target}
                    onPlay={nextEpisode}
                    onDismiss={() => setNextDismissed(`${localSeason}:${localEpisode}`)}
                  />
                )}
              </AnimatePresence>

              <iframe
                ref={iframeRef}
                key={iframeKey}
                src={url}
                title={title || tt("Reproductor")}
                className="absolute inset-0 w-full h-full"
                frameBorder="0"
                allowFullScreen
                allow={src?.allowAttr || DEFAULT_ALLOW}
                referrerPolicy="no-referrer"
                loading="eager"
                importance="high"
                onLoad={onIframeLoad}
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
                        <p className="text-chalk font-display font-semibold text-sm mb-1">{tt("Abrir en pestaña externa")}</p>
                        <p className="text-muted text-xs leading-relaxed mb-2">
                          {tt("Vamos a abrir el reproductor de")} <strong className="text-chalk/80">{src?.label}</strong> {tt("en una pestaña nueva. Es un servidor de terceros — puede mostrar publicidad o pop-ups.")} <strong className="text-chalk/80">{tt("No instales nada que te ofrezca.")}</strong>
                        </p>
                        <p className="text-muted/70 text-xs leading-relaxed">
                          <strong className="text-gold/80">{tt("¿Querés descargar?")}</strong> {tt("Instalá la extensión")} <em>{tt("\"Video DownloadHelper\"")}</em> {tt("en tu navegador y, en la pestaña externa, va a aparecer el ícono para bajar el video.")}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setShowExtConfirm(false)}
                        className="px-4 py-2 rounded-full text-muted text-xs font-semibold hover:text-chalk transition-colors"
                      >
                        {tt("Cancelar")}
                      </button>
                      <button
                        onClick={handleOpenExternal}
                        className="px-4 py-2 rounded-full bg-gold text-void text-xs font-bold hover:bg-gold-hi transition-colors"
                      >
                        {tt("Abrir")}
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── PANEL INFERIOR: en el celular es el panel de control principal (botones grandes, desplazable) ── */}
            <div className="player-body bg-[#0A0A14] border-t border-white/[0.03] px-3 sm:px-4 py-2.5 sm:py-1.5">
              {/* Fila 1: probar otro servidor + acciones */}
              <div className="flex flex-wrap items-center gap-2 mb-2.5 sm:mb-1.5">
                <button
                  onClick={tryAnother}
                  className="flex items-center gap-1.5 px-4 sm:px-3 py-2.5 sm:py-1.5 rounded-full bg-gold/10 border border-gold/30 text-gold text-xs sm:text-[11px] font-semibold hover:bg-gold/20 active:scale-95 transition-all"
                  title={tt("Si no carga, se ve mal o no está en español, probá otro servidor")}
                >
                  <ArrowClockwise size={13} weight="bold" />
                  {tt("¿No anda? Probar otro servidor")}
                </button>
                <span className="text-muted/25 text-[10px] font-mono hidden sm:block">{tt("ESC · cerrar")}</span>
                {/* Acciones extra solo en el celular (en escritorio están arriba) */}
                <div className="flex sm:hidden items-center gap-2 ml-auto">
                  {!isEnglish() && (
                    <button onClick={() => setShowLang((v) => !v)} aria-label={tt("Audio en español")}
                      className="h-10 px-3 flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 text-muted text-xs">
                      <Subtitles size={14} weight="fill" /> {tt("ES")}
                    </button>
                  )}
                  <button onClick={() => goTo(srcIdx)} aria-label={tt("Recargar")}
                    className="w-10 h-10 flex items-center justify-center rounded-full border border-white/10 bg-white/5 text-muted">
                    <ArrowClockwise size={15} />
                  </button>
                  <button onClick={handleExternalClick} aria-label={tt("Abrir en pestaña externa")}
                    className="w-10 h-10 flex items-center justify-center rounded-full border border-white/10 bg-white/5 text-muted">
                    <ArrowSquareOut size={15} weight="bold" />
                  </button>
                </div>
              </div>

              {/* Fila 2: episodios (series) en el celular */}
              {isTV && (
                <div className="flex sm:hidden items-center gap-2 mb-2.5">
                  <button onClick={prevEpisode} disabled={localSeason === 1 && localEpisode === 1} aria-label={tt("Episodio anterior")}
                    className="w-11 h-11 flex items-center justify-center rounded-xl border border-white/10 bg-white/5 text-chalk disabled:opacity-25">
                    <SkipBack size={16} weight="fill" />
                  </button>
                  <span className="flex-1 text-center text-sm font-mono text-chalk/80">
                    {tt("Temporada")} {localSeason} · {tt("Episodio")} {localEpisode}
                  </span>
                  <button onClick={nextEpisode} disabled={!target} aria-label={tt("Siguiente episodio")}
                    className="w-11 h-11 flex items-center justify-center rounded-xl border border-white/10 bg-white/5 text-chalk disabled:opacity-25">
                    <SkipForward size={16} weight="fill" />
                  </button>
                  {totalSeasons > 1 && (
                    <select value={localSeason} onChange={(e) => changeEpisode(Number(e.target.value), 1)}
                      aria-label={tt("Temporada")}
                      className="h-11 bg-surface border border-white/10 text-chalk text-xs rounded-xl px-2">
                      {Array.from({ length: totalSeasons }, (_, i) => i + 1).map((s) => (
                        <option key={s} value={s}>{tt("Temporada")} {s}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Fila 3: servidores */}
              <div className="flex items-center gap-1.5 sm:gap-1 flex-wrap sm:justify-start">
                <span className="text-muted/50 text-[10px] uppercase tracking-wider mr-1 sm:hidden w-full">{tt("Servidores")}</span>
                {sources.map((s, i) => serverChip(s, i, 'px-3 py-2.5 sm:px-2 sm:py-0.5 min-h-[40px] sm:min-h-0'))}
              </div>
              {isSlowNet && (
                <div className="flex items-center gap-1.5 mt-2 sm:hidden text-amber-400/70 text-[11px]">
                  <WifiLow size={12} weight="fill" /> {net.quality === 'slow' ? tt("Red lenta") : tt("Señal media")}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
