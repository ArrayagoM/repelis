import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LockKey, X, EnvelopeSimple } from '@phosphor-icons/react'
import GoogleButton from '../GoogleButton'
import { useAuth, loginWithGoogle, errorMessage } from '../../lib/auth'
import { requiresAccount, canUsePersonal } from '../../lib/access'
import { useAccountPrompt, dismissAccountPrompt } from '../../lib/accountPrompt'
import { pulseEvent, markGateShown } from '../../lib/pulse'

const PERKS = [
  'Mirás cualquier título, incluso los más calificados y populares',
  'Mi lista y Continuar viendo, en todos tus dispositivos',
  'Capítulos nuevos de tus series y recomendadas para vos',
]

/**
 * Reemplaza al video cuando el título es de los más calificados/populares y no hay sesión.
 * Se cierra solo: al iniciar sesión, el reproductor aparece en el mismo lugar.
 */
export default function AccessGate({ title, onClose, reason = 'watch' }) {
  const { status, googleClientId } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    pulseEvent(reason === 'list' || reason === 'social' ? 'gate_shown_list' : 'gate_shown_watch')
    markGateShown()
  }, [reason])

  const onGoogle = async (credential) => {
    if (busy) return
    setBusy(true); setError('')
    const r = await loginWithGoogle(credential)
    setBusy(false)
    if (!r.ok) setError(errorMessage(r.error))
  }

  const goToAccount = (modo) => {
    onClose()
    navigate(`/cuenta?modo=${modo}&volver=${encodeURIComponent(location.pathname)}`)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog" aria-modal="true" aria-label="Necesitás una cuenta para verla"
    >
      <motion.div
        initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }}
        className="relative w-full max-w-md rounded-2xl bg-[#0E0E18] border border-gold/25 shadow-[0_48px_120px_rgba(0,0,0,1)] overflow-hidden"
      >
        <button onClick={onClose} aria-label="Cerrar"
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-muted hover:text-chalk hover:bg-white/5">
          <X size={14} weight="bold" />
        </button>

        <div className="p-6 text-center bg-gradient-to-b from-gold/10 to-transparent">
          <div className="w-14 h-14 mx-auto rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center mb-4">
            <LockKey size={26} weight="fill" className="text-gold" />
          </div>
          <h2 className="font-display font-extrabold text-xl text-chalk leading-snug">
            {status === 'loading' ? 'Un momento…' : reason === 'social' ? 'Para participar, creá tu cuenta gratis' : reason === 'list' ? 'Para guardar, creá tu cuenta gratis' : 'Para verla, creá tu cuenta gratis'}
          </h2>
          <p className="text-muted text-sm mt-2 leading-relaxed">
            {status === 'loading'
              ? 'Estamos verificando tu sesión.'
              : reason === 'social'
                ? <>Dar like, seguir gente y armar tus propias listas es con cuenta. Ver las listas de la comunidad es libre, sin registrarte.</>
                : reason === 'list'
                ? <>Guardar <strong className="text-chalk/90">{title || 'este título'}</strong> en Mi lista (y seguir viendo después) es con cuenta. Ver y buscar sigue siendo libre, sin registrarte.</>
                : <><strong className="text-chalk/90">{title || 'Este título'}</strong> es de los más calificados y populares. Hay miles de títulos que se ven sin registrarte; para este necesitás una cuenta, y te lleva 10 segundos.</>}
          </p>
        </div>

        {status === 'out' && (
          <div className="px-6 pb-6 space-y-4">
            <ul className="space-y-1.5">
              {PERKS.map((p) => (
                <li key={p} className="flex gap-2 text-xs text-muted leading-snug"><span className="text-gold">✓</span>{p}</li>
              ))}
            </ul>

            {googleClientId && <GoogleButton clientId={googleClientId} onCredential={onGoogle} />}
            {busy && <p className="text-center text-muted text-xs">Ingresando…</p>}
            {error && <p role="alert" className="text-center text-red-300 text-xs">{error}</p>}

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => goToAccount('registro')}
                className="flex items-center justify-center gap-2 py-2.5 rounded-full bg-gold text-void font-bold text-sm hover:bg-gold-hi transition-colors">
                <EnvelopeSimple size={16} weight="bold" /> Crear cuenta
              </button>
              <button onClick={() => goToAccount('ingresar')}
                className="py-2.5 rounded-full glass border border-white/10 text-chalk text-sm hover:border-gold/30 hover:text-gold transition-colors">
                Ya tengo cuenta
              </button>
            </div>
            <button onClick={onClose} className="block mx-auto text-muted hover:text-chalk text-xs underline underline-offset-2">
              Ahora no, ver otras
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

/** Aviso en las fichas: "para darle play necesitás cuenta". Solo si corresponde (sin sesión y título bloqueado). */
export function GuestLockNote({ item, className = '' }) {
  const { status } = useAuth()
  if (status !== 'out' || !requiresAccount(item)) return null
  return (
    <p className={`flex items-start gap-2 max-w-xl p-3 rounded-xl bg-gold/10 border border-gold/25 text-gold/90 text-xs leading-relaxed ${className}`}>
      <LockKey size={16} weight="fill" className="flex-shrink-0 mt-px" />
      <span>Es de las más vistas y mejor calificadas: para darle play necesitás una <strong>cuenta gratis</strong> (10 segundos). Lo demás del sitio sigue libre.</span>
    </p>
  )
}

/** Muestra el pedido de cuenta que lanzó cualquier botón (requestAccount). Se cierra solo al ingresar. */
export function AccountPromptHost() {
  const prompt = useAccountPrompt()
  const { status } = useAuth()
  useEffect(() => { if (prompt && canUsePersonal(status)) dismissAccountPrompt() }, [prompt, status])
  return (
    <AnimatePresence>
      {prompt && <AccessGate key="account-prompt" reason={prompt.reason} title={prompt.title} onClose={dismissAccountPrompt} />}
    </AnimatePresence>
  )
}
