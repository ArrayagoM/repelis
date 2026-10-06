import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatCountdown } from '../../lib/roomRules'

/** Texto corto del estado de una sala para listados. */
export const phaseLabel = (room, now = Date.now()) => {
  if (room.phase === 'scheduled' && room.startsAt) {
    const when = new Date(room.startsAt)
    const day = when.toDateString() === new Date(now).toDateString() ? 'Hoy' : when.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
    return `${day} ${when.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
  }
  if (room.phase === 'live') return 'Abierta'
  return 'Terminó'
}

/** Cuenta regresiva (hasta `startsAt`) alineada con el reloj del servidor. */
export function useCountdown(startsAt, offset = 0) {
  const [now, setNow] = useState(() => Date.now() + offset)
  useEffect(() => {
    if (!startsAt) return undefined
    const tick = () => setNow(Date.now() + offset)
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [startsAt, offset])
  if (!startsAt) return { left: 0, started: true, text: '' }
  const left = startsAt - now
  return { left, started: left <= 0, text: formatCountdown(left) }
}

/** Reacciones que suben por la pantalla. */
export function FloatingReactions({ items, onDone }) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 bottom-0 h-[70vh] overflow-hidden z-40">
      <AnimatePresence>
        {items.map((f, i) => (
          <motion.span key={f.id}
            initial={{ y: 0, opacity: 0, scale: 0.6, x: 0 }}
            animate={{ y: -320 - (i % 3) * 60, opacity: [0, 1, 1, 0], scale: [0.6, 1.3, 1.1, 1], x: ((i * 53) % 120) - 60 }}
            transition={{ duration: 2.4, ease: 'easeOut' }}
            onAnimationComplete={() => onDone(f.id)}
            style={{ left: `${10 + ((i * 37) % 80)}%` }}
            className="absolute bottom-6 text-4xl">
            {f.emoji}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  )
}
