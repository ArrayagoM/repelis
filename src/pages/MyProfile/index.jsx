import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, LockKey, EyeSlash, Crown } from '@phosphor-icons/react'
import { Avatar, ListGrid, EmptyState } from '../../components/Community'
import { HANDLE_RE, LIMITS, normalizeHandle } from '../../lib/socialRules'
import { social, errorText, useMe, refreshMe } from '../../lib/social'
import { useAuth } from '../../lib/auth'
import { useSEO } from '../../lib/useSEO'

const inputCls = 'w-full bg-surface border border-white/10 rounded-xl px-4 py-2.5 text-chalk text-sm placeholder:text-muted/50 focus:outline-none focus:border-gold/50 transition-colors'

/** Mi perfil: elegir @usuario y bio, y ver/administrar mis listas (públicas, privadas y ocultas). */
export default function MyProfile() {
  useEffect(() => { window.scrollTo(0, 0) }, [])
  useSEO({ title: 'Mi perfil', description: 'Tu perfil y tus listas en Life High', noindex: true })
  const auth = useAuth()
  const navigate = useNavigate()
  const me = useMe()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ handle: '', name: '', bio: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const data = me.data
  const profile = data?.profile

  useEffect(() => {
    if (profile) setForm({ handle: profile.handle, name: profile.name || '', bio: profile.bio || '' })
    else if (me.loaded && auth.user) setForm((f) => ({ ...f, name: f.name || auth.user.name || '' }))
  }, [profile?.handle, profile?.name, profile?.bio, me.loaded, auth.user?.name]) // eslint-disable-line react-hooks/exhaustive-deps

  if (auth.status === 'loading' || (auth.status === 'in' && !me.loaded)) return <div className="min-h-screen bg-void pt-32 px-6"><div className="max-w-3xl mx-auto skeleton h-56 rounded-3xl" /></div>
  if (auth.status !== 'in') {
    return (
      <main className="min-h-screen bg-void flex flex-col items-center justify-center gap-4 px-6 text-center">
        <LockKey size={36} className="text-gold" weight="fill" />
        <p className="text-chalk font-display font-bold text-xl">Tu perfil es parte de tu cuenta gratis</p>
        <p className="text-muted text-sm max-w-sm">Con tu @usuario armás listas, seguís a otras personas y compartís tus planes.</p>
        <Link to="/cuenta?modo=registro&volver=/perfil" className="px-6 py-2.5 rounded-full bg-gold text-void font-bold text-sm hover:bg-gold-hi">Crear mi cuenta</Link>
      </main>
    )
  }

  const handle = normalizeHandle(form.handle)
  const handleOk = HANDLE_RE.test(handle)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const save = async (e) => {
    e.preventDefault()
    if (!handleOk || saving) return
    setSaving(true); setError('')
    const r = await social.saveProfile({ handle, name: form.name, bio: form.bio })
    setSaving(false)
    if (!r.ok) return setError(errorText(r.error))
    await refreshMe()
    setEditing(false)
  }

  const showForm = !profile || editing
  const lists = data?.lists || []
  const plan = data?.plan

  return (
    <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-void pt-28 pb-24">
      <div className="max-w-6xl mx-auto px-6 md:px-12">
        <h1 className="font-display font-extrabold text-3xl text-chalk mb-8">Mi perfil</h1>

        {showForm ? (
          <form onSubmit={save} className="max-w-xl space-y-4 mb-12 p-6 rounded-3xl bg-card border border-white/[0.06]">
            <p className="text-muted text-sm leading-relaxed">
              {profile ? 'Podés cambiar tu @usuario una vez cada 30 días.' : 'Elegí cómo te van a ver los demás. El @usuario es público y único.'}
            </p>
            {data && !data.canPublish && (
              <p role="status" className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-sm">
                Para publicar, verificá tu email o esperá una hora desde que creaste la cuenta. Es una protección contra el spam.
              </p>
            )}
            <label className="block text-xs text-muted font-mono uppercase tracking-wider">@usuario
              <div className="relative mt-1.5">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">@</span>
                <input value={form.handle} onChange={(e) => set({ handle: e.target.value.replace(/^@/, '') })} maxLength={20} autoComplete="off" autoCapitalize="none" spellCheck={false}
                  className={`${inputCls} pl-8 normal-case tracking-normal font-sans`} placeholder="tu_usuario" required />
              </div>
              {form.handle && !handleOk && <span className="block mt-1.5 text-amber-300 normal-case tracking-normal font-sans">De 3 a 20 caracteres: letras minúsculas, números o guion bajo.</span>}
            </label>
            <label className="block text-xs text-muted font-mono uppercase tracking-wider">Nombre
              <input value={form.name} onChange={(e) => set({ name: e.target.value })} maxLength={40} className={`${inputCls} mt-1.5 normal-case tracking-normal font-sans`} />
            </label>
            <label className="block text-xs text-muted font-mono uppercase tracking-wider">Sobre vos (opcional)
              <textarea value={form.bio} onChange={(e) => set({ bio: e.target.value })} maxLength={LIMITS.bio} rows={3} className={`${inputCls} mt-1.5 normal-case tracking-normal font-sans`} />
            </label>
            {error && <p role="alert" className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-200 text-sm">{error}</p>}
            <div className="flex gap-3">
              <button type="submit" disabled={!handleOk || saving} className="px-7 py-2.5 rounded-full bg-gold text-void font-bold text-sm hover:bg-gold-hi disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? 'Guardando…' : profile ? 'Guardar' : 'Crear mi perfil'}
              </button>
              {profile && <button type="button" onClick={() => { setEditing(false); setError('') }} className="px-6 py-2.5 rounded-full glass border border-white/10 text-muted text-sm hover:text-chalk">Cancelar</button>}
            </div>
          </form>
        ) : (
          <header className="flex flex-wrap items-center gap-5 mb-12">
            <Avatar name={profile.name} size={84} />
            <div className="mr-auto min-w-0">
              <h2 className="font-display font-extrabold text-2xl text-chalk flex items-center gap-2">
                {profile.name}
                {plan?.premium && <Crown size={18} weight="fill" className="text-gold" aria-label="Premium" />}
              </h2>
              <Link to={`/u/${profile.handle}`} className="text-muted font-mono text-sm hover:text-gold">@{profile.handle} · ver perfil público</Link>
              {profile.bio && <p className="text-chalk/80 text-sm mt-2 max-w-xl">{profile.bio}</p>}
              <p className="flex gap-4 text-sm text-muted mt-3">
                <span><strong className="text-chalk">{profile.followers}</strong> seguidores</span>
                <span><strong className="text-chalk">{profile.following}</strong> siguiendo</span>
              </p>
            </div>
            <button onClick={() => setEditing(true)} className="px-5 py-2.5 rounded-full glass border border-white/10 text-chalk text-sm hover:border-gold/30 hover:text-gold transition-colors">Editar perfil</button>
          </header>
        )}

        {profile && (
          <section>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <h2 className="font-display font-bold text-xl text-chalk mr-auto">
                Mis listas {plan && <span className="text-muted font-mono text-sm">({lists.length}/{plan.maxLists})</span>}
              </h2>
              <button onClick={() => navigate('/lista/nueva')} disabled={!!plan && lists.length >= plan.maxLists}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gold text-void font-bold text-sm hover:bg-gold-hi disabled:opacity-50 disabled:cursor-not-allowed">
                <Plus size={16} weight="bold" /> Nueva lista
              </button>
            </div>
            {plan && !plan.premium && lists.length >= plan.maxLists && (
              <p className="mb-4 text-sm text-muted">Llegaste al máximo de listas del plan gratis. Podés borrar una para armar otra.</p>
            )}
            {lists.length === 0 ? (
              <EmptyState title="Todavía no armaste ninguna lista"
                action={<button onClick={() => navigate('/lista/nueva')} className="mt-5 px-6 py-2.5 rounded-full bg-gold text-void font-bold text-sm hover:bg-gold-hi">Armar mi primera lista</button>}>
                Un zapping para la noche, el plan del finde, una maratón… y la compartís con quien quieras.
              </EmptyState>
            ) : (
              <>
                {lists.some((l) => l.hidden) && (
                  <p role="status" className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-sm flex items-center gap-2">
                    <EyeSlash size={16} /> Alguna de tus listas está oculta por reportes de la comunidad. Solo la ves vos.
                  </p>
                )}
                <ListGrid lists={lists} />
              </>
            )}
          </section>
        )}
      </div>
    </motion.main>
  )
}
