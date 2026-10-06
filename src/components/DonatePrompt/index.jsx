import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Coffee, X } from '@phosphor-icons/react'
import { WATCH_END_EVENT } from '../../lib/useWatchTracker'
import {
  getDonations, shouldShowPrompt, recordPromptShown, recordPromptDismissed, recordPromptDonate, markSupporter,
} from '../../lib/donations'
import { DONATE_OPTIONS } from '../DonateModal'
import DonateGoal from '../DonateGoal'
import { showToast } from '../../lib/toast'
import { pulseEvent } from '../../lib/pulse'

/**
 * Pedido de donación DESPUÉS de ver algo (no antes de reproducir).
 * Cuándo aparece lo decide shouldShowPrompt(): mínimo 20 min vistos, 1 vez por semana.
 */
export default function DonatePrompt() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onEnd = (e) => {
      const seconds = e.detail?.seconds || 0
      if (!shouldShowPrompt({ seconds, state: getDonations() })) return
      // Pequeña pausa: que el usuario vuelva a la página antes de pedirle algo
      setTimeout(() => { recordPromptShown(); setOpen(true); pulseEvent('donate_shown') }, 1200)
    }
    window.addEventListener(WATCH_END_EVENT, onEnd)
    return () => window.removeEventListener(WATCH_END_EVENT, onEnd)
  }, [])

  const dismiss = () => { recordPromptDismissed(); setOpen(false) }
  const donate = () => { recordPromptDonate(); pulseEvent('donate_click'); setOpen(false) }
  const already = () => {
    markSupporter(); setOpen(false)
    showToast({ icon: '💛', title: '¡Gracias por apoyar Life High!', text: 'Ya no te vamos a pedir más. Te dejamos la insignia Supporter.', ttl: 7000 })
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
          role="dialog" aria-label="Apoyá Life High"
          className="fixed z-[105] left-4 right-4 sm:left-1/2 sm:-translate-x-1/2 sm:w-[26rem] bottom-4 p-4 rounded-2xl bg-[#0E0E18]/97 backdrop-blur border border-gold/30 shadow-[0_24px_64px_rgba(0,0,0,0.7)]"
        >
          <button onClick={dismiss} aria-label="Cerrar"
            className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full text-muted hover:text-chalk hover:bg-white/5">
            <X size={13} weight="bold" />
          </button>
          <div className="flex items-start gap-3 pr-6">
            <span className="w-10 h-10 rounded-full bg-gold flex items-center justify-center flex-shrink-0 shadow-[0_0_20px_rgba(232,160,32,0.4)]">
              <Coffee size={18} weight="fill" className="text-void" />
            </span>
            <div>
              <p className="text-chalk font-display font-bold text-base leading-snug">¿Disfrutaste lo que viste?</p>
              <p className="text-muted text-xs leading-relaxed mt-1">
                Life High es gratis y lo mantiene una persona. Si podés, un cafecito ayuda a pagar los servidores.
              </p>
            </div>
          </div>

          <div className="mt-3"><DonateGoal compact /></div>

          <div className="flex flex-wrap gap-2 mt-3">
            {DONATE_OPTIONS.map((o) => (
              <a key={o.id} href={o.href} target="_blank" rel="noopener noreferrer" onClick={donate}
                className="flex-1 min-w-[8rem] text-center px-4 py-2.5 rounded-full bg-gold text-void text-sm font-bold hover:bg-gold-hi transition-colors">
                {o.cta}
              </a>
            ))}
          </div>
          <div className="flex items-center justify-between mt-3 text-xs">
            <button onClick={already} className="text-gold/90 hover:text-gold underline underline-offset-2">Ya doné ❤</button>
            <button onClick={dismiss} className="text-muted hover:text-chalk">Ahora no</button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
