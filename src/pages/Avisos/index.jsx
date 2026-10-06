import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bell, UserPlus, Heart, ChatCircleText, ListPlus, LockKey } from '@phosphor-icons/react'
import { useAuth } from '../../lib/auth'
import { social, errorText } from '../../lib/social'
import { setUnread } from '../../lib/notifications'
import { devicePushState, enablePush, disablePush, pushSupported } from '../../lib/push'
import { ago } from '../../lib/panelFormat'
import { useSEO } from '../../lib/useSEO'

const ICONS = { follow: UserPlus, like: Heart, comment: ChatCircleText, new_list: ListPlus }

const Toggle = ({ on, onChange, label, hint, disabled }) => (
  <label className={`flex items-start gap-4 p-4 rounded-2xl bg-card border border-white/[0.06] ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
    <span className="mr-auto min-w-0">
      <span className="block text-chalk text-sm font-semibold">{label}</span>
      <span className="block text-muted text-xs mt-0.5 leading-relaxed">{hint}</span>
    </span>
    <input type="checkbox" role="switch" checked={on} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
    <span aria-hidden="true" className="relative mt-1 w-11 h-6 flex-shrink-0 rounded-full bg-white/10 peer-checked:bg-gold transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-5 after:h-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5" />
  </label>
)

export default function Avisos() {
  useEffect(() => { window.scrollTo(0, 0) }, [])
  useSEO({ title: 'Avisos', description: 'Tus avisos de Life High', noindex: true })
  const auth = useAuth()
  const [state, setState] = useState({ loading: true, error: '', items: [], prefs: { push: true, email: false }, push: { available: false, publicKey: null } })
  const [device, setDevice] = useState('off')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (auth.status !== 'in') return undefined
    let cancelled = false
    social.notifications().then(async (r) => {
      if (cancelled) return
      if (!r.ok) return setState((s) => ({ ...s, loading: false, error: errorText(r.error) }))
      setState({ loading: false, error: '', items: r.data.items, prefs: r.data.prefs, push: r.data.push })
      setDevice(await devicePushState())
      if (r.data.unread > 0) { await social.markRead(); setUnread(0) }
    })
    return () => { cancelled = true }
  }, [auth.status])

  if (auth.status === 'loading') return <div className="min-h-screen bg-void pt-32 px-6"><div className="max-w-2xl mx-auto skeleton h-56 rounded-3xl" /></div>
  if (auth.status !== 'in') {
    return (
      <main className="min-h-screen bg-void flex flex-col items-center justify-center gap-4 px-6 text-center">
        <LockKey size={36} className="text-gold" weight="fill" />
        <p className="text-chalk font-display font-bold text-xl">Tus avisos viven en tu cuenta gratis</p>
        <Link to="/cuenta?modo=registro&volver=/avisos" className="px-6 py-2.5 rounded-full bg-gold text-void font-bold text-sm hover:bg-gold-hi">Crear mi cuenta</Link>
      </main>
    )
  }

  const toggleDevice = async (on) => {
    setMsg('')
    if (on) {
      const r = await enablePush(state.push.publicKey)
      setDevice(await devicePushState())
      if (!r.ok) setMsg(r.reason === 'denied' ? 'El navegador bloqueó los avisos. Habilitalos desde el candado de la barra de direcciones.' : r.reason === 'unsupported' ? 'Este navegador no admite avisos.' : 'No pudimos activar los avisos. Probá de nuevo.')
    } else {
      await disablePush()
      setDevice(await devicePushState())
    }
  }
  const setPref = async (key, value) => {
    const r = await social.setPrefs({ [key]: value })
    if (r.ok) setState((s) => ({ ...s, prefs: r.data.prefs }))
  }

  return (
    <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-void pt-28 pb-24">
      <div className="max-w-2xl mx-auto px-6 space-y-8">
        <h1 className="font-display font-extrabold text-3xl text-chalk flex items-center gap-3"><Bell size={28} weight="fill" className="text-gold" /> Avisos</h1>

        <section aria-label="Preferencias" className="space-y-3">
          <Toggle label="Avisos en este dispositivo" on={device === 'on'} onChange={toggleDevice}
            disabled={!state.push.available || !pushSupported() || device === 'denied'}
            hint={!state.push.available ? 'Los avisos del navegador todavía no están disponibles.'
              : !pushSupported() ? 'Este navegador no admite avisos del sistema.'
              : device === 'denied' ? 'Bloqueaste los avisos en el navegador. Habilitalos desde el candado de la barra de direcciones.'
              : 'Te avisamos cuando alguien te sigue, comenta o da me gusta a tus listas, o cuando alguien que seguís publica una.'} />
          <Toggle label="Resumen por email" on={state.prefs.email} onChange={(v) => setPref('email', v)}
            hint="Un mail por día, solo si tuviste novedades. Podés desactivarlo cuando quieras." />
          {msg && <p role="alert" className="text-amber-300 text-xs">{msg}</p>}
        </section>

        <section aria-label="Novedades">
          <h2 className="font-display font-bold text-lg text-chalk mb-3">Novedades</h2>
          {state.loading ? <div className="skeleton h-24 rounded-2xl" />
            : state.error ? <p role="alert" className="text-red-200 text-sm">{state.error}</p>
            : state.items.length === 0 ? (
              <p className="p-6 rounded-2xl bg-card border border-white/[0.06] text-muted text-sm text-center leading-relaxed">
                Todavía no tenés avisos. Cuando alguien te siga o comente tus listas, lo ves acá.{' '}
                <Link to="/comunidad" className="text-gold hover:underline">Ir a la comunidad</Link>
              </p>
            ) : (
              <ul className="space-y-2">
                {state.items.map((n) => {
                  const Icon = ICONS[n.type] || Bell
                  return (
                    <li key={n.id}>
                      <Link to={n.link || '/'} className={`flex items-start gap-3 p-4 rounded-2xl border transition-colors hover:border-gold/30 ${n.read ? 'bg-card border-white/[0.06]' : 'bg-gold/[0.06] border-gold/25'}`}>
                        <span className="mt-0.5 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0"><Icon size={16} className="text-gold" weight="fill" /></span>
                        <span className="min-w-0">
                          <span className="block text-chalk text-sm leading-snug break-words">{n.text}</span>
                          <span className="block text-muted/70 text-[11px] mt-1">{ago(n.createdAt)}</span>
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
        </section>
      </div>
    </motion.main>
  )
}
