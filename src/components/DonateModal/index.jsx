import { motion, AnimatePresence } from 'framer-motion'
import { X, Coffee, Heart, ArrowSquareOut } from '@phosphor-icons/react'

// 💡 Cambiá estos enlaces cuando crees tus cuentas reales.
// Cafecito: https://cafecito.app/ → registrate y obtené tu URL
// MercadoPago: cargá un Link de Pago en https://www.mercadopago.com.ar/herramientas/link
const DONATE_OPTIONS = [
  {
    id: 'cafecito',
    label: 'Cafecito',
    description: 'El más usado en Argentina. Procesa con Mercado Pago.',
    href: 'https://cafecito.app/tintech',
    cta: 'Invitar un café',
    accent: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
    icon: Coffee,
  },
  {
    id: 'mercadopago',
    label: 'Mercado Pago',
    description: 'Link de pago directo, sin intermediarios.',
    href: 'https://link.mercadopago.com.ar/tintech',
    cta: 'Donar con MP',
    accent: 'bg-sky-500/10 border-sky-500/30 text-sky-300',
    icon: Heart,
  },
]

export default function DonateModal({ open, onClose }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="bg"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-md rounded-2xl bg-[#0E0E18] border border-white/10 shadow-[0_48px_120px_rgba(0,0,0,1)] overflow-hidden"
          >
            <div className="relative p-6 bg-gradient-to-br from-gold/15 to-gold/0 border-b border-white/5">
              <button onClick={onClose}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-muted hover:text-chalk hover:bg-white/5 transition-all">
                <X size={14} weight="bold" />
              </button>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-gold flex items-center justify-center shadow-[0_0_20px_rgba(232,160,32,0.5)]">
                  <Coffee size={18} weight="fill" className="text-void" />
                </div>
                <div>
                  <p className="font-display font-bold text-chalk text-lg">Apoyá Repelis</p>
                  <p className="text-muted text-xs">Hecho por TinTech</p>
                </div>
              </div>
              <p className="text-muted/80 text-sm leading-relaxed mt-3">
                Repelis es 100% gratis y sin publicidad propia. Si te gusta y querés ayudar a
                mantenerlo, cualquier aporte cuenta. ¡Gracias!
              </p>
            </div>

            <div className="p-5 space-y-3">
              {DONATE_OPTIONS.map((opt) => {
                const Icon = opt.icon
                return (
                  <a
                    key={opt.id}
                    href={opt.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={onClose}
                    className="group flex items-center gap-4 p-4 rounded-xl bg-surface border border-white/[0.06] hover:border-gold/30 hover:bg-gold/5 transition-all duration-200"
                  >
                    <div className={`w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0 ${opt.accent}`}>
                      <Icon size={20} weight="fill" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-semibold text-chalk text-sm flex items-center gap-1.5">
                        {opt.label}
                        <ArrowSquareOut size={11} className="text-muted/40 group-hover:text-gold transition-colors" />
                      </p>
                      <p className="text-muted text-xs mt-0.5">{opt.description}</p>
                    </div>
                  </a>
                )
              })}
            </div>

            <div className="px-5 pb-5 pt-2">
              <p className="text-muted/40 text-[10px] text-center font-mono leading-relaxed">
                100% del aporte va al desarrollador. Sin fees ocultos.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
