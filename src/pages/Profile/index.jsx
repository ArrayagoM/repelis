import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, UsersThree } from '@phosphor-icons/react'
import { Avatar, FollowButton, ListGrid, EmptyState } from '../../components/Community'
import { social } from '../../lib/social'
import { useSEO } from '../../lib/useSEO'

/** Perfil público de una persona: @usuario, bio, seguidores y sus listas públicas. */
export default function Profile() {
  useEffect(() => { window.scrollTo(0, 0) }, [])
  const { handle } = useParams()
  const [state, setState] = useState({ loading: true, data: null })
  const [followers, setFollowers] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState({ loading: true, data: null })
    social.profile(handle).then((r) => {
      if (cancelled) return
      setState({ loading: false, data: r.ok ? r.data : null })
      if (r.ok) setFollowers(r.data.profile.followers)
    })
    return () => { cancelled = true }
  }, [handle])

  const p = state.data?.profile
  useSEO(p ? { title: `@${p.handle} — listas en Life High`, description: p.bio || `Listas de películas y series de ${p.name}.` } : { title: 'Perfil' })

  if (state.loading) return <div className="min-h-screen bg-void pt-32 px-6"><div className="max-w-5xl mx-auto skeleton h-48 rounded-3xl" /></div>
  if (!p) {
    return (
      <main className="min-h-screen bg-void flex flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-display font-extrabold text-5xl text-gold/80">404</p>
        <p className="text-muted text-sm">No encontramos a @{handle}.</p>
        <Link to="/comunidad" className="text-gold text-sm hover:underline">Ver la comunidad</Link>
      </main>
    )
  }

  return (
    <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-void pt-28 pb-24">
      <div className="max-w-6xl mx-auto px-6 md:px-12">
        <Link to="/comunidad" className="inline-flex items-center gap-2 text-muted hover:text-gold text-sm mb-6"><ArrowLeft size={14} /> Comunidad</Link>
        <header className="flex flex-wrap items-center gap-5 mb-10">
          <Avatar name={p.name} size={84} />
          <div className="mr-auto min-w-0">
            <h1 className="font-display font-extrabold text-3xl text-chalk leading-tight">{p.name}</h1>
            <p className="text-muted font-mono text-sm">@{p.handle}</p>
            {p.bio && <p className="text-chalk/80 text-sm mt-2 max-w-xl leading-relaxed">{p.bio}</p>}
            <p className="flex items-center gap-4 text-sm text-muted mt-3">
              <span><strong className="text-chalk">{followers}</strong> seguidores</span>
              <span><strong className="text-chalk">{p.following}</strong> siguiendo</span>
              <span><strong className="text-chalk">{state.data.lists.length}</strong> listas</span>
            </p>
          </div>
          {state.data.viewer.isMe
            ? <Link to="/perfil" className="px-5 py-2.5 rounded-full glass border border-white/10 text-chalk text-sm hover:border-gold/30 hover:text-gold transition-colors">Editar mi perfil</Link>
            : <FollowButton handle={p.handle} following={state.data.viewer.following} onChange={(d) => setFollowers(d.followers)} />}
        </header>

        <h2 className="font-display font-bold text-xl text-chalk mb-4 flex items-center gap-2"><UsersThree size={18} className="text-gold" /> Listas de @{p.handle}</h2>
        {state.data.lists.length === 0
          ? <EmptyState title="Todavía no publicó listas">Cuando arme una, la vas a ver acá.</EmptyState>
          : <ListGrid lists={state.data.lists} />}
      </div>
    </motion.main>
  )
}
