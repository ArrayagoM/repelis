import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WarningCircle, X } from '@phosphor-icons/react'
import { subscribe, clearErrors } from '../../lib/errorMonitor'

export default function ErrorBar() {
  const [errors, setErrors] = useState([])
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => subscribe(setErrors), [])

  // Filtrar errores muy viejos (>10 min) que ya no importan
  const fresh = errors.filter((e) => Date.now() - e.ts < 10 * 60 * 1000)
  if (fresh.length === 0 || collapsed) return null

  const last = fresh[0]

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -40, opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed top-0 left-0 right-0 z-[200] flex items-center gap-2 px-4 py-1.5 bg-red-950/95 border-b border-red-500/30 text-red-100 text-[11px] font-mono"
      >
        <WarningCircle size={12} weight="fill" className="text-red-400 flex-shrink-0" />
        <span className="truncate flex-1 min-w-0">
          <span className="text-red-400/80">[{last.scope}]</span> {last.message}
        </span>
        {fresh.length > 1 && (
          <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-200 text-[9px]">
            +{fresh.length - 1}
          </span>
        )}
        <button
          onClick={() => { clearErrors(); setCollapsed(true); setTimeout(() => setCollapsed(false), 30_000) }}
          className="text-red-300/70 hover:text-red-100 ml-2"
          title="Cerrar (30s)"
        >
          <X size={11} weight="bold" />
        </button>
      </motion.div>
    </AnimatePresence>
  )
}
