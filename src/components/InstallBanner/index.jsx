import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Export, PlusSquare, CheckCircle, X, Copy, Warning } from '@phosphor-icons/react'
import {
  IOS_GUIDE_EVENT, currentPlatform, dismissInstallBanner, dismissedRecently, inAppBrowserName,
  isStandalone, requestInstall, shouldShowBanner, wasInstalled, subscribeInstall,
} from '../../lib/install'

const HIDDEN_ON = ['/descargar', '/apk', '/admin']

/** Los 3 pasos para iPhone/iPad, en grande y sin palabras raras. */
export function IOSSteps({ compact = false }) {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
  const app = inAppBrowserName(ua)
  const [copied, setCopied] = useState(false)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText('https://repelis.vercel.app')
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch { /* sin permiso de portapapeles */ }
  }

  const steps = [
    {
      Icon: Export,
      title: 'Tocá el botón Compartir',
      text: 'Es el cuadradito con una flecha hacia arriba. Está abajo en el centro de Safari. Si no lo ves, tocá los tres puntitos ••• primero.',
    },
    {
      Icon: PlusSquare,
      title: 'Elegí “Agregar a pantalla de inicio”',
      text: 'Deslizá la lista hacia arriba hasta encontrarlo. Tiene un cuadradito con un “+”.',
    },
    {
      Icon: CheckCircle,
      title: 'Tocá “Agregar”',
      text: 'Listo: Life High aparece en tu pantalla de inicio con su ícono, como cualquier otra app.',
    },
  ]

  return (
    <div className="space-y-3">
      {app && (
        <div className="flex gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <Warning size={20} weight="fill" className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-amber-200 font-semibold">Estás dentro de {app}</p>
            <p className="text-chalk/80 mt-1 leading-relaxed">
              Desde acá no se puede instalar. Tocá los tres puntitos de {app} → <strong>“Abrir en Safari”</strong> y después seguí estos pasos.
            </p>
            <button onClick={copyLink} className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gold text-void text-xs font-bold">
              <Copy size={12} weight="bold" /> {copied ? '¡Enlace copiado!' : 'Copiar enlace para pegar en Safari'}
            </button>
          </div>
        </div>
      )}
      {steps.map(({ Icon, title, text }, i) => (
        <div key={title} className="flex items-start gap-4 p-4 rounded-2xl bg-surface border border-white/10">
          <div className="relative flex-shrink-0">
            <div className="w-14 h-14 rounded-2xl bg-void border border-gold/30 flex items-center justify-center">
              <Icon size={30} weight="bold" className="text-gold" />
            </div>
            <span className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-gold text-void text-xs font-extrabold flex items-center justify-center">{i + 1}</span>
          </div>
          <div className="flex-1">
            <p className={`text-chalk font-display font-bold ${compact ? 'text-base' : 'text-lg'} leading-snug`}>{title}</p>
            <p className="text-muted text-sm mt-1 leading-relaxed">{text}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function InstallBanner() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [visible, setVisible] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [platform] = useState(currentPlatform)

  // Esperamos un par de segundos: da tiempo a que Chrome ofrezca la instalación y no tapa la primera carga.
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 2500)
    return () => clearTimeout(t)
  }, [])

  const evaluate = useCallback(() => {
    setVisible(shouldShowBanner({
      platform,
      standalone: isStandalone(),
      installed: wasInstalled(),
      dismissed: dismissedRecently(),
    }))
  }, [platform])

  useEffect(() => { if (ready) evaluate() }, [ready, evaluate])
  useEffect(() => subscribeInstall(evaluate), [evaluate])

  useEffect(() => {
    const open = () => setSheetOpen(true)
    window.addEventListener(IOS_GUIDE_EVENT, open)
    return () => window.removeEventListener(IOS_GUIDE_EVENT, open)
  }, [])

  const show = visible && !HIDDEN_ON.includes(pathname)

  useEffect(() => {
    document.body.classList.toggle('has-install-banner', show)
    return () => document.body.classList.remove('has-install-banner')
  }, [show])

  const onInstall = async () => {
    const result = await requestInstall()
    if (result === 'unavailable') navigate('/descargar')
    if (result === 'accepted') setVisible(false)
  }

  const onClose = () => {
    dismissInstallBanner()
    setVisible(false)
  }

  return (
    <>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className="fixed left-3 right-3 z-50 flex items-center gap-3 p-3 rounded-2xl bg-deep/95 backdrop-blur-xl border border-gold/30 shadow-[0_12px_40px_rgba(0,0,0,0.6)]"
            style={{ bottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
            role="region" aria-label="Instalar la app"
          >
            <div className="w-11 h-11 rounded-full bg-gold flex items-center justify-center flex-shrink-0 shadow-[0_0_16px_rgba(232,160,32,0.45)]">
              <svg viewBox="0 0 12 12" className="w-5 h-5" aria-hidden="true"><polygon points="3.5,2 10,6 3.5,10" fill="#08080E" /></svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-chalk font-display font-bold text-sm leading-tight">Instalá Life High</p>
              <p className="text-muted text-xs leading-tight mt-0.5">Gratis · se abre como una app</p>
            </div>
            <button
              onClick={onInstall}
              className="px-4 py-2.5 rounded-full bg-gold text-void text-sm font-extrabold hover:bg-gold-hi active:scale-95 transition-all flex-shrink-0"
            >
              Instalar
            </button>
            <button onClick={onClose} aria-label="Cerrar aviso" className="w-8 h-8 flex items-center justify-center rounded-full text-muted hover:text-chalk flex-shrink-0">
              <X size={16} weight="bold" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sheetOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/70 flex items-end sm:items-center justify-center"
            onClick={() => setSheetOpen(false)}
          >
            <motion.div
              initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }}
              transition={{ type: 'spring', stiffness: 280, damping: 30 }}
              role="dialog" aria-modal="true" aria-label="Cómo instalar Life High en iPhone"
              className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-deep border border-white/10 p-5 pb-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 mb-1">
                <h2 className="font-display font-extrabold text-xl text-chalk leading-tight">
                  Instalá Life High en tu iPhone
                </h2>
                <button onClick={() => setSheetOpen(false)} aria-label="Cerrar" className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-muted hover:text-chalk flex-shrink-0">
                  <X size={16} weight="bold" />
                </button>
              </div>
              <p className="text-muted text-sm mb-4">Son 3 toques y tarda 20 segundos. No necesitás la App Store.</p>
              <IOSSteps compact />
              <button onClick={() => setSheetOpen(false)} className="mt-5 w-full py-3 rounded-full bg-gold text-void font-extrabold text-base">
                Entendido
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
