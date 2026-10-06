import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { UsersThree, Plus, UserCircle } from '@phosphor-icons/react'
import { ListGrid, EmptyState } from '../../components/Community'
import { useAuth } from '../../lib/auth'
import { social, errorText, ensureAccount } from '../../lib/social'
import { useSEO } from '../../lib/useSEO'

const TABS = [['popular', 'Populares'], ['new', 'Nuevas'], ['following', 'Siguiendo']]

export default function Comunidad() {
  useEffect(() => { window.scrollTo(0, 0) }, [])
  useSEO({
    title: 'Comunidad: listas y planes de la gente',
    description: 'Listas de películas y series armadas por la comunidad: zapping, planes de finde, maratones. Seguí a quien tenga tu mismo gusto.',
  })
  const auth = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('popular')
  const [state, setState] = useState({ loading: true, lists: [], error: '' })

  useEffect(() => {
    let cancelled = false
    if (tab === 'following' && auth.status !== 'in') { setState({ loading: false, lists: [], error: '' }); return undefined }
    setState((s) => ({ ...s, loading: true, error: '' }))
    social.feed(tab).then((r) => {
      if (cancelled) return
      setState(r.ok ? { loading: false, lists: r.data.lists, error: '' } : { loading: false, lists: [], error: errorText(r.error) })
    })
    return () => { cancelled = true }
  }, [tab, auth.status])

  const create = async () => { if (await ensureAccount()) navigate('/lista/nueva') }

  return (
    <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-void pt-28 pb-24">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <header className="flex flex-wrap items-end gap-4 mb-8">
          <div className="mr-auto">
            <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-chalk flex items-center gap-3">
              <UsersThree size={32} weight="fill" className="text-gold" /> Comunidad
            </h1>
            <p className="text-muted text-sm mt-2 max-w-xl leading-relaxed">
              Listas armadas por la gente: zapping para la noche, planes de finde, maratones. Mirarlas es libre; para dar like, seguir o armar las tuyas hace falta una cuenta gratis.
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/perfil" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full glass border border-white/10 text-chalk text-sm hover:border-gold/30 hover:text-gold transition-colors">
              <UserCircle size={16} /> Mi perfil
            </Link>
            <button onClick={create} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gold text-void font-bold text-sm hover:bg-gold-hi transition-colors">
              <Plus size={16} weight="bold" /> Crear lista
            </button>
          </div>
        </header>

        <div className="flex gap-2 mb-6" role="tablist">
          {TABS.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={`px-4 py-1.5 rounded-full border text-sm font-medium transition-colors ${tab === id ? 'bg-gold text-void border-gold' : 'glass border-white/10 text-muted hover:text-chalk'}`}>
              {label}
            </button>
          ))}
        </div>

        {state.error && <p role="alert" className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-200 text-sm mb-4">{state.error}</p>}

        {state.loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-64 rounded-2xl" />)}</div>
        ) : tab === 'following' && auth.status !== 'in' ? (
          <EmptyState title="Las listas de quienes seguís" action={<button onClick={() => ensureAccount()} className="mt-5 px-6 py-2.5 rounded-full bg-gold text-void font-bold text-sm hover:bg-gold-hi">Ingresar o crear cuenta</button>}>
            Con tu cuenta seguís a gente con tu mismo gusto y acá ves lo nuevo que arman.
          </EmptyState>
        ) : state.lists.length === 0 ? (
          <EmptyState title={tab === 'following' ? 'Todavía no seguís a nadie' : 'Todavía no hay listas'}
            action={<button onClick={() => (tab === 'following' ? setTab('popular') : create())} className="mt-5 px-6 py-2.5 rounded-full bg-gold text-void font-bold text-sm hover:bg-gold-hi">{tab === 'following' ? 'Descubrir gente' : 'Armar la primera'}</button>}>
            {tab === 'following' ? 'Entrá a una lista que te guste y tocá "Seguir" en el perfil de quien la armó.' : 'Sé la primera persona en compartir una lista.'}
          </EmptyState>
        ) : (
          <ListGrid lists={state.lists} />
        )}
      </div>
    </motion.main>
  )
}
