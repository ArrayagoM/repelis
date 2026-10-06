import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  UserCircle, Eye, EyeSlash, CheckCircle, WarningCircle, CloudCheck, ArrowsClockwise, SignOut, Heart,
} from '@phosphor-icons/react'
import GoogleButton from '../../components/GoogleButton'
import {
  useAuth, register, login, loginWithGoogle, logout, forgotPassword, resetPassword, verifyEmail, resendVerification,
  changePassword, deleteAccount, syncNow, errorMessage,
} from '../../lib/auth'
import { useDonations, isSupporter } from '../../lib/donations'
import { useSEO } from '../../lib/useSEO'

const inputCls = 'w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-chalk text-sm placeholder:text-muted/50 focus:outline-none focus:border-gold/50 transition-colors'
const btnCls = 'w-full py-3 rounded-full bg-gold text-void font-bold text-sm hover:bg-gold-hi transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
const ghostBtn = 'px-4 py-2 rounded-full glass border border-white/10 text-chalk text-sm hover:border-gold/30 hover:text-gold transition-colors disabled:opacity-50'

const Shell = ({ title, subtitle, children }) => (
  <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-void pt-28 pb-24 px-6">
    <div className="max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="w-14 h-14 mx-auto rounded-full bg-gold/10 border border-gold/25 flex items-center justify-center mb-4">
          <UserCircle size={30} weight="fill" className="text-gold" />
        </div>
        <h1 className="font-display font-extrabold text-3xl text-chalk">{title}</h1>
        {subtitle && <p className="text-muted text-sm mt-2 leading-relaxed">{subtitle}</p>}
      </div>
      {children}
    </div>
  </motion.main>
)

function PasswordField({ id, label, value, onChange, autoComplete, hint }) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-muted font-mono uppercase tracking-wider mb-1.5">{label}</label>
      <div className="relative">
        <input id={id} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete} required minLength={8} maxLength={200} className={`${inputCls} pr-12`} />
        <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-chalk">
          {show ? <EyeSlash size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {hint && <p className="text-muted/70 text-[11px] mt-1">{hint}</p>}
    </div>
  )
}

const Message = ({ kind = 'error', children }) => (
  <p role={kind === 'error' ? 'alert' : 'status'}
    className={`flex items-start gap-2 p-3 rounded-xl text-sm leading-snug border ${kind === 'error' ? 'bg-red-500/10 border-red-500/25 text-red-200' : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200'}`}>
    {kind === 'error' ? <WarningCircle size={18} weight="fill" className="flex-shrink-0 mt-px" /> : <CheckCircle size={18} weight="fill" className="flex-shrink-0 mt-px" />}
    <span>{children}</span>
  </p>
)

// ─── Ingresar / Crear cuenta / Olvidé mi contraseña ─────────────────────
function AuthForm({ mail, googleClientId }) {
  const [mode, setMode] = useState('login')       // 'login' | 'register' | 'forgot'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const navigate = useNavigate()

  const switchMode = (m) => { setMode(m); setError(''); setInfo('') }

  const onGoogle = async (credential) => {
    if (busy) return
    setBusy(true); setError(''); setInfo('')
    const r = await loginWithGoogle(credential)
    setBusy(false)
    if (!r.ok) return setError(errorMessage(r.error))
    navigate('/mi-lista')
  }

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError(''); setInfo('')
    if (mode === 'forgot') {
      const r = await forgotPassword(email)
      setBusy(false)
      if (!r.ok) return setError(errorMessage(r.error))
      return setInfo(mail
        ? 'Si ese mail tiene una cuenta, te enviamos un enlace para elegir una contraseña nueva. Revisá también Spam.'
        : 'El envío de mails todavía no está activado, así que no podemos mandarte el enlace. Escribinos y lo resolvemos a mano.')
    }
    const r = mode === 'register' ? await register({ email, password, name }) : await login({ email, password })
    setBusy(false)
    if (!r.ok) return setError(errorMessage(r.error))
    navigate('/mi-lista')
  }

  const titles = { login: 'Ingresar', register: 'Crear cuenta', forgot: 'Recuperar contraseña' }
  const subtitles = {
    login: 'Para ver tu lista y lo que estabas mirando en cualquier dispositivo.',
    register: 'Es gratis y opcional. Lo que ya guardaste en este dispositivo se suma a tu cuenta.',
    forgot: 'Escribí tu mail y te mandamos un enlace para elegir una contraseña nueva.',
  }

  return (
    <Shell title={titles[mode]} subtitle={subtitles[mode]}>
      {googleClientId && mode !== 'forgot' && (
        <div className="mb-6">
          <GoogleButton clientId={googleClientId} onCredential={onGoogle} text={mode === 'register' ? 'signup_with' : 'continue_with'} />
          <div className="flex items-center gap-3 mt-6 text-muted/60 text-xs">
            <span className="flex-1 h-px bg-white/10" /> o con tu mail <span className="flex-1 h-px bg-white/10" />
          </div>
        </div>
      )}
      <form onSubmit={submit} className="space-y-4" noValidate={false}>
        {mode === 'register' && (
          <div>
            <label htmlFor="name" className="block text-xs text-muted font-mono uppercase tracking-wider mb-1.5">Nombre (opcional)</label>
            <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" maxLength={60} className={inputCls} />
          </div>
        )}
        <div>
          <label htmlFor="email" className="block text-xs text-muted font-mono uppercase tracking-wider mb-1.5">Mail</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required maxLength={254}
            inputMode="email" autoCapitalize="none" className={inputCls} />
        </div>
        {mode !== 'forgot' && (
          <PasswordField id="password" label="Contraseña" value={password} onChange={setPassword}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            hint={mode === 'register' ? 'Mínimo 8 caracteres. Usá una que no uses en otros sitios.' : undefined} />
        )}

        {error && <Message>{error}</Message>}
        {info && <Message kind="ok">{info}</Message>}

        <button type="submit" disabled={busy} className={btnCls}>
          {busy ? 'Un momento…' : mode === 'login' ? 'Ingresar' : mode === 'register' ? 'Crear mi cuenta' : 'Enviarme el enlace'}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-muted space-y-2">
        {mode === 'login' && (
          <>
            <p><button onClick={() => switchMode('forgot')} className="text-gold hover:underline">Olvidé mi contraseña</button></p>
            <p>¿No tenés cuenta? <button onClick={() => switchMode('register')} className="text-gold hover:underline">Crear una</button></p>
          </>
        )}
        {mode === 'register' && <p>¿Ya tenés cuenta? <button onClick={() => switchMode('login')} className="text-gold hover:underline">Ingresar</button></p>}
        {mode === 'forgot' && <p><button onClick={() => switchMode('login')} className="text-gold hover:underline">Volver a ingresar</button></p>}
      </div>

      <p className="mt-8 text-muted/60 text-[11px] text-center leading-relaxed">
        Guardamos tu mail y tu biblioteca para sincronizarla. No vendemos ni compartimos datos.
        Mirá la <Link to="/privacy" className="text-gold/80 hover:underline">política de privacidad</Link>.
      </p>
    </Shell>
  )
}

// ─── Panel de la cuenta ─────────────────────────────────────────────────
const agoText = (ts) => {
  if (!ts) return 'todavía no'
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 10) return 'recién'
  if (s < 60) return `hace ${s} s`
  const m = Math.round(s / 60)
  return m < 60 ? `hace ${m} min` : `hace ${Math.round(m / 60)} h`
}

function AccountPanel() {
  const { user, syncing, lastSyncAt, syncError, mail, googleClientId } = useAuth()
  const supporter = isSupporter(useDonations())
  const navigate = useNavigate()
  const [msg, setMsg] = useState({ kind: '', text: '' })
  const [pw, setPw] = useState({ current: '', next: '' })
  const [showPw, setShowPw] = useState(false)
  const [delPw, setDelPw] = useState('')
  const [showDel, setShowDel] = useState(false)
  const [busy, setBusy] = useState('')
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 15000); return () => clearInterval(t) }, [])

  const say = (kind, text) => setMsg({ kind, text })
  const run = async (name, fn) => { setBusy(name); setMsg({ kind: '', text: '' }); try { await fn() } finally { setBusy('') } }

  const onResend = () => run('resend', async () => {
    const r = await resendVerification()
    if (!r.ok) return say('error', errorMessage(r.error))
    say('ok', r.alreadyVerified ? 'Tu mail ya está confirmado.' : 'Listo, te enviamos el mail de confirmación.')
  })
  const onChangePw = (e) => { e.preventDefault(); run('pw', async () => {
    const r = await changePassword(pw)
    if (!r.ok) return say('error', errorMessage(r.error))
    setPw({ current: '', next: '' }); setShowPw(false)
    say('ok', 'Contraseña cambiada. Cerramos tus otras sesiones por seguridad.')
  }) }
  const onLogout = () => run('logout', async () => { await logout(); navigate('/') })
  const onDelete = (e) => { e.preventDefault(); run('del', async () => {
    const r = await deleteAccount(delPw)
    if (!r.ok) return say('error', errorMessage(r.error))
    navigate('/')
  }) }
  const onDeleteGoogle = (credential) => run('del', async () => {
    const r = await deleteAccount({ credential })
    if (!r.ok) return say('error', errorMessage(r.error))
    navigate('/')
  })

  return (
    <Shell title={user.name ? `Hola, ${user.name}` : 'Tu cuenta'} subtitle={user.email}>
      <div className="space-y-4">
        {supporter && (
          <p className="flex items-center gap-2 p-3 rounded-xl bg-gold/10 border border-gold/30 text-gold text-sm">
            <Heart size={18} weight="fill" /> Sos Supporter de Life High. ¡Gracias!
          </p>
        )}

        {!user.emailVerified && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25">
            <p className="text-amber-200 text-sm font-semibold">Falta confirmar tu mail</p>
            <p className="text-muted text-xs leading-relaxed mt-1">Sin confirmarlo no podrías recuperar la cuenta si olvidás la contraseña.</p>
            {mail && <button onClick={onResend} disabled={busy === 'resend'} className={`${ghostBtn} mt-3`}>{busy === 'resend' ? 'Enviando…' : 'Reenviar mail de confirmación'}</button>}
          </div>
        )}

        <div className="p-4 rounded-2xl bg-card border border-white/[0.06]">
          <p className="flex items-center gap-2 text-chalk text-sm font-semibold">
            {syncError ? <WarningCircle size={18} weight="fill" className="text-red-300" /> : <CloudCheck size={18} weight="fill" className="text-emerald-300" />}
            {syncError ? 'No pudimos sincronizar' : 'Sincronización activa'}
          </p>
          <p className="text-muted text-xs mt-1 leading-relaxed">
            Mi lista, Continuar viendo, avisos de estreno y logros viajan a todos tus dispositivos. Última vez: {agoText(lastSyncAt)}.
          </p>
          <button onClick={() => syncNow()} disabled={syncing} className={`${ghostBtn} mt-3 inline-flex items-center gap-2`}>
            <ArrowsClockwise size={14} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
          </button>
        </div>

        {msg.text && <Message kind={msg.kind === 'ok' ? 'ok' : 'error'}>{msg.text}</Message>}

        {user.hasPassword && (
        <div className="p-4 rounded-2xl bg-card border border-white/[0.06]">
          <button onClick={() => setShowPw((v) => !v)} className="text-chalk text-sm font-semibold w-full text-left flex justify-between" aria-expanded={showPw}>
            Cambiar contraseña <span className="text-muted">{showPw ? '–' : '+'}</span>
          </button>
          {showPw && (
            <form onSubmit={onChangePw} className="space-y-3 mt-4">
              <PasswordField id="pw-current" label="Contraseña actual" value={pw.current} onChange={(v) => setPw((p) => ({ ...p, current: v }))} autoComplete="current-password" />
              <PasswordField id="pw-next" label="Contraseña nueva" value={pw.next} onChange={(v) => setPw((p) => ({ ...p, next: v }))} autoComplete="new-password" hint="Mínimo 8 caracteres." />
              <button type="submit" disabled={busy === 'pw'} className={btnCls}>{busy === 'pw' ? 'Guardando…' : 'Cambiar contraseña'}</button>
            </form>
          )}
        </div>
        )}
        {!user.hasPassword && user.google && (
          <p className="text-muted text-xs leading-relaxed p-3 rounded-xl bg-white/5 border border-white/10">
            Ingresás con tu cuenta de Google, por eso no tenés contraseña de Life High. Si querés una, usá "Olvidé mi contraseña" al ingresar.
          </p>
        )}

        <button onClick={onLogout} disabled={busy === 'logout'} className={`${ghostBtn} w-full inline-flex items-center justify-center gap-2`}>
          <SignOut size={16} /> {busy === 'logout' ? 'Cerrando…' : 'Cerrar sesión'}
        </button>
        <p className="text-muted/60 text-[11px] text-center leading-relaxed -mt-1">
          Al cerrar sesión, tu lista se borra de <strong>este</strong> dispositivo (sigue guardada en tu cuenta), para que nadie más la vea.
        </p>

        <div className="pt-6 mt-2 border-t border-white/5">
          <button onClick={() => setShowDel((v) => !v)} className="text-red-300/80 text-xs hover:text-red-300" aria-expanded={showDel}>Eliminar mi cuenta</button>
          {showDel && (
            <form onSubmit={onDelete} className="space-y-3 mt-3 p-4 rounded-2xl bg-red-500/5 border border-red-500/20">
              <p className="text-muted text-xs leading-relaxed">Se borran tu cuenta y todo lo sincronizado en nuestros servidores. No se puede deshacer. Lo guardado en este dispositivo se conserva.</p>
              {user.hasPassword && (
                <>
                  <PasswordField id="del-pw" label="Tu contraseña para confirmar" value={delPw} onChange={setDelPw} autoComplete="current-password" />
                  <button type="submit" disabled={busy === 'del'} className="w-full py-3 rounded-full bg-red-500/90 text-white font-bold text-sm hover:bg-red-500 transition-colors disabled:opacity-50">
                    {busy === 'del' ? 'Eliminando…' : 'Eliminar para siempre'}
                  </button>
                </>
              )}
              {user.google && googleClientId && (
                <div>
                  <p className="text-muted text-xs mb-2">{user.hasPassword ? 'O confirmá con Google:' : 'Confirmá con tu cuenta de Google para eliminarla:'}</p>
                  <GoogleButton clientId={googleClientId} onCredential={onDeleteGoogle} text="continue_with" />
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </Shell>
  )
}

// ─── /cuenta/restablecer?token=… ────────────────────────────────────────
function ResetView() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    const r = await resetPassword({ token, password })
    setBusy(false)
    if (!r.ok) return setError(errorMessage(r.error))
    setDone(true)
  }

  if (!token) return <Shell title="Enlace incompleto"><Message>{errorMessage('token_invalid')}</Message><p className="text-center mt-6"><Link to="/cuenta" className="text-gold hover:underline">Ir a ingresar</Link></p></Shell>
  if (done) return (
    <Shell title="¡Listo!" subtitle="Cambiaste tu contraseña. Cerramos las sesiones abiertas por seguridad.">
      <Link to="/cuenta" className={`${btnCls} block text-center`}>Ingresar</Link>
    </Shell>
  )
  return (
    <Shell title="Nueva contraseña" subtitle="Elegí una contraseña nueva para tu cuenta.">
      <form onSubmit={submit} className="space-y-4">
        <PasswordField id="new-password" label="Contraseña nueva" value={password} onChange={setPassword} autoComplete="new-password" hint="Mínimo 8 caracteres." />
        {error && <Message>{error}</Message>}
        <button type="submit" disabled={busy} className={btnCls}>{busy ? 'Guardando…' : 'Guardar contraseña'}</button>
      </form>
    </Shell>
  )
}

// ─── /cuenta/verificar?token=… ──────────────────────────────────────────
function VerifyView() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [state, setState] = useState(token ? 'loading' : 'bad')
  const ran = useRef(false)

  useEffect(() => {
    if (!token || ran.current) return
    ran.current = true                      // el token es de un solo uso: no lo gastamos dos veces (modo estricto)
    verifyEmail(token).then((r) => setState(r.ok ? 'ok' : 'bad'))
  }, [token])

  return (
    <Shell title={state === 'ok' ? '¡Mail confirmado!' : state === 'loading' ? 'Confirmando…' : 'No pudimos confirmarlo'}>
      {state === 'ok' && <Message kind="ok">Tu mail quedó confirmado. Ya podés recuperar tu cuenta si olvidás la contraseña.</Message>}
      {state === 'bad' && <Message>{errorMessage('token_invalid')}</Message>}
      <p className="text-center mt-6"><Link to="/cuenta" className="text-gold hover:underline">Ir a mi cuenta</Link></p>
    </Shell>
  )
}

export default function Cuenta({ view = 'main' }) {
  useSEO({ title: 'Mi cuenta', description: 'Ingresá o creá tu cuenta en Life High para sincronizar tu lista en todos tus dispositivos.', noindex: true })
  const auth = useAuth()

  if (view === 'reset') return <ResetView />
  if (view === 'verify') return <VerifyView />

  if (auth.status === 'loading') {
    return <div className="min-h-screen bg-void flex items-center justify-center"><div className="w-10 h-10 rounded-full border-2 border-gold/15 border-t-gold animate-spin" /></div>
  }
  if (auth.status === 'unavailable') {
    return (
      <Shell title="Cuentas no disponibles" subtitle="Todavía no podemos ofrecer cuentas. Tu lista y lo que mirás siguen guardándose en este dispositivo.">
        <p className="text-center"><Link to="/" className="text-gold hover:underline">Volver al inicio</Link></p>
      </Shell>
    )
  }
  return auth.status === 'in' ? <AccountPanel /> : <AuthForm mail={auth.mail} googleClientId={auth.googleClientId} />
}
