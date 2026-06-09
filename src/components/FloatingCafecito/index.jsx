import { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from '@phosphor-icons/react'
import CafecitoButton from '../CafecitoButton'

const DISMISS_KEY = 'repelis:cafecitoDismiss:v1'
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000   // 24 horas

/**
 * Botón flotante de Cafecito, esquina inferior derecha.
 *
 * Reglas para no molestar:
 *  - Aparece 8s después del primer paint.
 *  - Si el usuario lo cierra (X), no aparece por 24h.
 *  - Se oculta automáticamente cuando el PlayerModal está abierto.
 *  - En mobile baja un poco más de tamaño y se reposiciona.
 */
export default function FloatingCafecito() {
  const isPlayerOpen = useSelector((s) => s.player.isOpen)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(DISMISS_KEY)
      if (dismissed) {
        const ts = Number(dismissed)
        if (Number.isFinite(ts) && Date.now() - ts < DISMISS_TTL_MS) return
      }
    } catch {}

    const t = setTimeout(() => setVisible(true), 8000)
    return () => clearTimeout(t)
  }, [])

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch {}
    setVisible(false)
  }

  if (isPlayerOpen) return null

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 20 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-4 right-4 z-40 group"
        >
          <button
            onClick={dismiss}
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-void border border-white/15 text-muted hover:text-chalk hover:bg-red-500/20 hover:border-red-500/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 shadow-md"
            aria-label="Ocultar por 24 horas"
            title="Ocultar por 24 horas"
          >
            <X size={11} weight="bold" />
          </button>
          <CafecitoButton className="drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)]" />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
