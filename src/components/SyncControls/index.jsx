import { useEffect, useRef, useState } from 'react'
import { Timer, CheckCircle, FastForward, Rewind, Pause } from '@phosphor-icons/react'
import { useRoomSession } from '../../lib/roomSession'
import { countdownSeconds, formatClock } from '../../lib/playback'
import { showToast } from '../../lib/toast'

// Pitido corto (si el navegador no deja sonar, no pasa nada)
let audioCtx = null
const beep = (freq = 880, ms = 160, gain = 0.15) => {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)()
    audioCtx.resume?.()
    const o = audioCtx.createOscillator(), g = audioCtx.createGain()
    o.frequency.value = freq; g.gain.value = gain
    o.connect(g).connect(audioCtx.destination)
    o.start(); o.stop(audioCtx.currentTime + ms / 1000)
  } catch { /* sin audio */ }
}

/** Pantalla grande "3, 2, 1… ¡PLAY!" que llega a cero a la vez para todos (alineada con el reloj del servidor). */
export function SyncCountdownOverlay() {
  const s = useRoomSession()
  const at = s?.countdown?.at
  const [n, setN] = useState(null)       // número mostrado, o 0 = ¡PLAY!
  const last = useRef(null)
  const offset = s?.live.offset || 0

  useEffect(() => {
    if (!at) { setN(null); last.current = null; return undefined }
    const id = setInterval(() => {
      const left = countdownSeconds(at, Date.now() + offset)
      const shown = left > 0 ? left : 0
      if (shown !== last.current) {
        last.current = shown
        setN(shown)
        if (shown > 0 && shown <= 3) beep(520, 90, 0.08)
        if (shown === 0) beep(988, 320, 0.18)
      }
      if (left < -1.4 * 1) { clearInterval(id); s.endCountdown() }
    }, 80)
    return () => clearInterval(id)
  }, [at, offset]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!at || n === null) return null
  return (
    <div role="alert" aria-live="assertive" className="pointer-events-none fixed inset-0 z-[160] flex items-center justify-center bg-black/55">
      <div className="text-center">
        <p className={`font-display font-extrabold leading-none drop-shadow-[0_0_40px_rgba(232,160,32,0.7)] ${n === 0 ? 'text-emerald-300 text-7xl sm:text-9xl' : 'text-gold text-[9rem] sm:text-[14rem]'}`}>{n === 0 ? '¡PLAY!' : n}</p>
        <p className="mt-2 text-chalk text-lg font-semibold">{n === 0 ? 'Dale play ahora' : 'Preparate para dar play'}</p>
      </div>
    </div>
  )
}

/**
 * Controles de sincronía: botón del anfitrión para lanzar la cuenta regresiva y, para el resto, un indicador de qué tan
 * cerca están del anfitrión (si su reproductor informa el minuto) con instrucciones para corregirlo.
 */
export default function SyncControls({ size = 40, compact = false }) {
  const s = useRoomSession()
  const [open, setOpen] = useState(false)
  const [pause, setPause] = useState(null)         // segundos que faltan para volver a dar play
  const isHost = !!s?.live.room?.isHost
  const closed = s?.live.room?.phase === 'closed' || s?.live.room?.phase === 'expired'

  // Pausa guiada: "pausá X segundos" con cuenta propia y aviso al terminar
  useEffect(() => {
    if (pause === null) return undefined
    if (pause <= 0) { beep(988, 300, 0.18); showToast({ icon: '▶️', title: '¡Dale play!', text: 'Ya estás sincronizado.', ttl: 4000, tone: 'green' }); setPause(null); return undefined }
    const id = setTimeout(() => setPause((p) => (p === null ? null : p - 1)), 1000)
    return () => clearTimeout(id)
  }, [pause])

  if (!s || closed) return null
  const a = s.advice
  const box = { width: size, height: size }
  const call = async () => {
    const r = await s.callCountdown(8)
    if (!r.ok) showToast({ icon: '⚠️', title: r.error === 'sync_fast' ? 'Esperá un momento antes de lanzar otra cuenta.' : 'No pudimos lanzar la cuenta regresiva.', ttl: 3500, tone: 'blue' })
  }

  return (
    <>
      {isHost && (
        <button onClick={call} style={box} aria-label="Cuenta regresiva para dar play juntos" title="Cuenta regresiva de 8 segundos: ¡Play juntos! (todos la ven llegar a cero a la vez)"
          className="rounded-full text-gold hover:bg-gold/15 flex items-center justify-center transition-colors"><Timer size={size * 0.5} weight="bold" /></button>
      )}
      {!isHost && a && (
        <div className="relative">
          <button onClick={() => setOpen((v) => !v)} aria-expanded={open}
            className={`h-9 px-3 rounded-full text-xs font-semibold flex items-center gap-1.5 border transition-colors ${a.kind === 'ok' ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300' : 'bg-amber-500/15 border-amber-400/40 text-amber-200'}`}>
            {a.kind === 'ok' ? <CheckCircle size={14} weight="fill" /> : a.kind === 'ahead' ? <FastForward size={14} weight="fill" /> : <Rewind size={14} weight="fill" />}
            {pause !== null ? `Pausa: ${pause} s` : a.kind === 'ok' ? (compact ? 'Sincro' : 'Sincronizado') : a.kind === 'ahead' ? `+${a.seconds} s` : `−${a.seconds} s`}
          </button>
          {open && (
            <div role="dialog" aria-label="Sincronía con el anfitrión" className="absolute bottom-12 left-1/2 -translate-x-1/2 w-72 p-4 rounded-2xl bg-card border border-white/10 shadow-2xl text-left space-y-2">
              {a.kind === 'ok' && <p className="text-sm text-chalk">Vas a la par del anfitrión. ¡A disfrutar!</p>}
              {a.kind === 'ahead' && (
                <>
                  <p className="text-sm text-chalk">Estás <strong className="text-amber-200">{a.seconds} s adelantado</strong>. Pausá tu video y dale play cuando termine la cuenta.</p>
                  <button onClick={() => { setPause(a.seconds); setOpen(false) }} className="w-full px-4 py-2 rounded-full bg-gold text-void text-sm font-bold hover:bg-gold-hi flex items-center justify-center gap-2"><Pause size={14} weight="fill" /> Pausar {a.seconds} s</button>
                </>
              )}
              {a.kind === 'behind' && (
                <p className="text-sm text-chalk">Estás <strong className="text-amber-200">{a.seconds} s atrasado</strong>. El anfitrión va en <strong>{formatClock(a.target)}</strong>: llevá tu video a ese minuto con la barra del reproductor.</p>
              )}
              <p className="text-[11px] text-muted leading-snug">Se actualiza solo. Para empezar de cero juntos, pedile al anfitrión una cuenta regresiva.</p>
            </div>
          )}
        </div>
      )}
    </>
  )
}
