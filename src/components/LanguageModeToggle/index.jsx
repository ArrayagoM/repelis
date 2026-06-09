import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Translate, CheckCircle, CaretDown } from '@phosphor-icons/react'
import {
  getLanguageMode, setLanguageMode, subscribeLanguageMode,
  MODE_LABELS, MODE_DESCRIPTIONS,
} from '../../lib/languageMode'

const ORDER = ['broad', 'strict', 'all']

const ICONS = {
  strict: '🇲🇽',
  broad:  '🌎',
  all:    '🌐',
}

export default function LanguageModeToggle({ variant = 'navbar' }) {
  const [mode, setMode] = useState(getLanguageMode())
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => subscribeLanguageMode(setMode), [])

  useEffect(() => {
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    if (open) document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const choose = (m) => {
    setLanguageMode(m)
    setOpen(false)
  }

  const isCompact = variant === 'navbar'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-full transition-all whitespace-nowrap
          ${isCompact
            ? 'px-2.5 py-1 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[10px]'
            : 'px-4 py-2 bg-surface border border-white/10 text-sm'}
          ${mode === 'strict' ? 'text-emerald-300 border-emerald-400/30' :
            mode === 'broad'  ? 'text-gold border-gold/30' :
                                'text-muted'}`}
        title={MODE_DESCRIPTIONS[mode]}
        aria-label={`Modo idioma: ${MODE_LABELS[mode]}`}
      >
        <span className={isCompact ? 'text-xs leading-none' : 'text-base leading-none'}>{ICONS[mode]}</span>
        <span className="font-bold uppercase tracking-wide">{MODE_LABELS[mode]}</span>
        <CaretDown size={isCompact ? 9 : 11} weight="bold" className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 top-full mt-2 w-72 bg-[#0E0E18] rounded-2xl border border-white/10 shadow-[0_24px_60px_rgba(0,0,0,0.7)] overflow-hidden z-50"
          >
            <div className="px-4 py-3 border-b border-white/5">
              <p className="text-chalk text-sm font-display font-semibold flex items-center gap-2">
                <Translate size={13} weight="fill" className="text-gold" />
                Filtro de idioma
              </p>
              <p className="text-muted/60 text-[10px] mt-0.5">Aplica al catálogo entero</p>
            </div>

            <ul className="p-1">
              {ORDER.map((m) => {
                const active = mode === m
                return (
                  <li key={m}>
                    <button
                      onClick={() => choose(m)}
                      className={`w-full text-left p-3 rounded-lg flex items-start gap-3 transition-colors ${
                        active ? 'bg-gold/8' : 'hover:bg-white/[0.04]'
                      }`}
                    >
                      <span className="text-xl leading-none flex-shrink-0">{ICONS[m]}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${active ? 'text-gold' : 'text-chalk'}`}>
                          {MODE_LABELS[m]}
                        </p>
                        <p className="text-muted/70 text-[10px] mt-0.5 leading-snug">
                          {MODE_DESCRIPTIONS[m]}
                        </p>
                      </div>
                      {active && <CheckCircle size={14} weight="fill" className="text-gold flex-shrink-0 mt-0.5" />}
                    </button>
                  </li>
                )
              })}
            </ul>

            <div className="px-4 py-2.5 border-t border-white/5">
              <p className="text-muted/50 text-[10px] leading-relaxed">
                <strong className="text-chalk/70">Importante:</strong> el filtro recorta el catálogo, pero el audio final lo decide el servidor donde se reproduce. Si escuchás inglés, cambiá el audio dentro del player (icono 🔊).
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
