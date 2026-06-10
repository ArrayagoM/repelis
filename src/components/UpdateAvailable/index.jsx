import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowClockwise, X } from '@phosphor-icons/react'

/**
 * Toast que aparece cuando hay una nueva versión del Service Worker
 * (= se hizo deploy nuevo en Vercel). El usuario puede recargar para
 * obtenerla, o seguir usando la vieja hasta cerrar la pestaña.
 */
export default function UpdateAvailable() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return

      // Si ya hay un SW esperando, lo mostramos
      if (reg.waiting) {
        setShow(true)
        return
      }

      // Detectar nuevos SWs en instalación
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setShow(true)
          }
        })
      })

      // Chequear updates cada 5 min mientras la pestaña está abierta
      const interval = setInterval(() => reg.update().catch(() => {}), 5 * 60 * 1000)
      return () => clearInterval(interval)
    }).catch(() => {})
  }, [])

  const reload = () => {
    // Saltea el waiting y recarga
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg?.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' })
    }).finally(() => {
      window.location.reload()
    })
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.95 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-4 py-3 rounded-2xl bg-gold text-void shadow-[0_24px_60px_rgba(232,160,32,0.4)] border border-gold-hi/30"
        >
          <ArrowClockwise size={16} weight="bold" />
          <div className="flex flex-col">
            <span className="font-bold text-sm leading-tight">Nueva versión disponible</span>
            <span className="text-void/70 text-[10px] font-mono leading-tight">Recargá para verla</span>
          </div>
          <button
            onClick={reload}
            className="ml-2 px-3 py-1.5 rounded-full bg-void text-gold text-xs font-bold hover:bg-void/80 transition-colors"
          >
            Recargar
          </button>
          <button
            onClick={() => setShow(false)}
            className="text-void/50 hover:text-void"
            aria-label="Más tarde"
          >
            <X size={12} weight="bold" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
