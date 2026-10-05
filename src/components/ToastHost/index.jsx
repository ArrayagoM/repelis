import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from '@phosphor-icons/react'
import { subscribeToasts } from '../../lib/toast'

const TONES = {
  gold:  'border-gold/30',
  blue:  'border-blue-400/30',
  green: 'border-emerald-400/30',
}

const MAX_VISIBLE = 3

export default function ToastHost() {
  const [toasts, setToasts] = useState([])
  const navigate = useNavigate()

  useEffect(() => subscribeToasts((t) => {
    setToasts((cur) => [...cur.slice(-(MAX_VISIBLE - 1)), t])
    if (t.ttl > 0) setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== t.id)), t.ttl)
  }), [])

  const close = (id) => setToasts((cur) => cur.filter((x) => x.id !== id))

  return (
    <div className="fixed z-[120] left-4 right-4 sm:left-auto sm:right-4 bottom-4 sm:w-[22rem] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl bg-[#0E0E18]/95 backdrop-blur border shadow-[0_16px_48px_rgba(0,0,0,0.6)] ${TONES[t.tone] || TONES.gold}`}
          >
            {t.icon && <span className="text-2xl leading-none mt-0.5" aria-hidden="true">{t.icon}</span>}
            <div className="flex-1 min-w-0">
              <p className="text-chalk text-sm font-semibold leading-snug">{t.title}</p>
              {t.text && <p className="text-muted text-xs leading-relaxed mt-0.5">{t.text}</p>}
              {(t.to || t.onAction) && (
                <button
                  onClick={() => { if (t.to) navigate(t.to); t.onAction?.(); close(t.id) }}
                  className="mt-2 px-3 py-1 rounded-full bg-gold/15 border border-gold/30 text-gold text-xs font-semibold hover:bg-gold/25 transition-colors"
                >
                  {t.actionLabel || 'Ver'}
                </button>
              )}
            </div>
            <button onClick={() => close(t.id)} aria-label="Cerrar aviso"
              className="w-6 h-6 flex items-center justify-center rounded-full text-muted hover:text-chalk hover:bg-white/5 flex-shrink-0">
              <X size={12} weight="bold" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
