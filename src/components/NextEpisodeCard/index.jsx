import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { SkipForward } from '@phosphor-icons/react'
import { getAutoNext, setAutoNext } from '../../lib/nextEpisode'
import { tt } from '../../lib/i18n'

const COUNTDOWN = 15

/**
 * Cartel "Siguiente episodio" sobre el reproductor.
 * No podemos leer el reproductor (iframe de terceros): estimamos el final por el tiempo
 * reproducido. Por eso la cuenta regresiva es cancelable y se puede apagar.
 */
export default function NextEpisodeCard({ target, onPlay, onDismiss }) {
  const [auto, setAuto] = useState(getAutoNext)
  const [left, setLeft] = useState(COUNTDOWN)

  useEffect(() => {
    if (!auto) return undefined
    if (left <= 0) { onPlay(); return undefined }
    const t = setTimeout(() => setLeft((n) => n - 1), 1000)
    return () => clearTimeout(t)
  }, [auto, left, onPlay])

  const toggleAuto = () => { const v = !auto; setAuto(v); setAutoNext(v); setLeft(COUNTDOWN) }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }}
      className="absolute z-30 right-3 bottom-3 sm:right-5 sm:bottom-5 w-[min(21rem,calc(100%-1.5rem))] p-3.5 rounded-2xl bg-void/92 backdrop-blur border border-gold/30 shadow-[0_16px_48px_rgba(0,0,0,0.7)]"
      role="dialog" aria-label={tt("Siguiente episodio")}
    >
      <p className="text-muted text-[11px] font-mono uppercase tracking-wider">{tt("Parece que terminó")}</p>
      <p className="text-chalk font-display font-bold text-base mt-0.5">
        {tt("Siguiente: T")}{target.season} {tt("E")}{target.episode}
      </p>
      <div className="flex items-center gap-2 mt-3">
        <button onClick={onPlay}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-gold text-void text-sm font-bold hover:bg-gold-hi transition-colors">
          <SkipForward size={14} weight="fill" />
          {auto ? tt("Ver ahora ({left})", { left: left }) : tt("Ver ahora")}
        </button>
        <button onClick={onDismiss}
          className="px-4 py-2.5 rounded-full glass border border-white/10 text-muted text-sm hover:text-chalk transition-colors">
          {tt("Quedarme")}
        </button>
      </div>
      <label className="flex items-center gap-2 mt-3 text-[11px] text-muted cursor-pointer select-none">
        <input type="checkbox" checked={auto} onChange={toggleAuto} className="accent-[#E8A020]" />
        {tt("Pasar solo al siguiente episodio")}
      </label>
    </motion.div>
  )
}
