import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, PencilSimple, TrashSimple, Flag, FilmSlate, ListBullets } from '@phosphor-icons/react'
import { Avatar, LikeButton } from '../../components/Community'
import ShareButtons from '../../components/ShareButtons'
import Comments from '../../components/Comments'
import { IMG_W342 } from '../../api/tmdb'
import { TAG_LABELS } from '../../lib/socialRules'
import { social, errorText, ensureAccount, refreshMe } from '../../lib/social'
import { showToast } from '../../lib/toast'
import { useSEO } from '../../lib/useSEO'

export default function ListView() {
  useEffect(() => { window.scrollTo(0, 0) }, [])
  const { id } = useParams()
  const navigate = useNavigate()
  const [state, setState] = useState({ loading: true, data: null, notFound: false })
  const [reporting, setReporting] = useState(false)
  const [reason, setReason] = useState('')

  useEffect(() => {
    let cancelled = false
    setState({ loading: true, data: null, notFound: false })
    social.list(id).then((r) => { if (!cancelled) setState(r.ok ? { loading: false, data: r.data, notFound: false } : { loading: false, data: null, notFound: true }) })
    return () => { cancelled = true }
  }, [id])

  const list = state.data?.list
  useSEO(list
    ? { title: `${list.title} — lista de @${list.owner?.handle || 'la comunidad'}`, description: list.description || `Lista de ${list.itemsCount} títulos en Life High.`, type: 'website' }
    : { title: 'Lista' })

  if (state.loading) return <div className="min-h-screen bg-void pt-32 px-6"><div className="max-w-4xl mx-auto skeleton h-64 rounded-3xl" /></div>
  if (state.notFound || !list) {
    return (
      <main className="min-h-screen bg-void flex flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-display font-extrabold text-5xl text-gold/80">404</p>
        <p className="text-muted text-sm">Esta lista no existe, es privada o fue retirada.</p>
        <Link to="/comunidad" className="text-gold text-sm hover:underline">Ver la comunidad</Link>
      </main>
    )
  }

  const isOwner = !!state.data.viewer.isOwner
  const remove = async () => {
    if (!window.confirm('¿Eliminar esta lista para siempre?')) return
    const r = await social.deleteList(list.id)
    if (r.ok) { await refreshMe(); navigate('/perfil') } else showToast({ icon: '⚠️', title: errorText(r.error), ttl: 4000, tone: 'blue' })
  }
  const sendReport = async (e) => {
    e.preventDefault()
    if (!(await ensureAccount())) return
    const r = await social.report(list.id, reason)
    setReporting(false); setReason('')
    showToast(r.ok ? { icon: '🚩', title: 'Gracias por avisar', text: 'Revisamos los reportes y ocultamos lo que no cumple las reglas.', ttl: 5000 }
      : { icon: '⚠️', title: errorText(r.error), ttl: 4000, tone: 'blue' })
  }

  return (
    <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-void pt-28 pb-24">
      <div className="max-w-5xl mx-auto px-6 md:px-12">
        <Link to="/comunidad" className="inline-flex items-center gap-2 text-muted hover:text-gold text-sm mb-6 transition-colors"><ArrowLeft size={14} /> Comunidad</Link>

        {list.hidden && (
          <p role="status" className="mb-5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-sm">
            Esta lista está oculta por reportes de la comunidad y hoy solo la ves vos. Si creés que es un error, escribinos.
          </p>
        )}

        <header className="mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="px-2.5 py-0.5 rounded-full bg-gold/10 border border-gold/25 text-gold text-[11px] font-semibold uppercase tracking-wide">{TAG_LABELS[list.tag] || 'Lista'}</span>
            {list.visibility === 'private' && <span className="px-2.5 py-0.5 rounded-full bg-white/5 border border-white/15 text-muted text-[11px] font-semibold uppercase tracking-wide">Privada</span>}
          </div>
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-chalk leading-tight">{list.title}</h1>
          {list.description && <p className="text-chalk/80 mt-3 max-w-2xl leading-relaxed">{list.description}</p>}

          <div className="flex flex-wrap items-center gap-3 mt-5">
            {list.owner && (
              <Link to={`/u/${list.owner.handle}`} className="flex items-center gap-2.5 pr-3 text-sm text-chalk hover:text-gold transition-colors">
                <Avatar name={list.owner.name} size={32} />
                <span><strong>{list.owner.name}</strong> <span className="text-muted">@{list.owner.handle}</span></span>
              </Link>
            )}
            <span className="flex items-center gap-1.5 text-muted text-sm font-mono"><ListBullets size={14} /> {list.itemsCount} títulos</span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <LikeButton list={list} />
              {list.visibility === 'public' && <ShareButtons title={list.title} description={`Lista de ${list.itemsCount} títulos en Life High`} />}
              {isOwner ? (
                <>
                  <Link to={`/lista/${list.id}/editar`} className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-white/10 text-chalk text-sm hover:border-gold/30 hover:text-gold transition-colors"><PencilSimple size={14} /> Editar</Link>
                  <button onClick={remove} className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-white/10 text-muted text-sm hover:border-red-400/40 hover:text-red-300 transition-colors"><TrashSimple size={14} /> Eliminar</button>
                </>
              ) : (
                <button onClick={() => setReporting((v) => !v)} className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-muted text-xs hover:text-chalk transition-colors"><Flag size={13} /> Reportar</button>
              )}
            </div>
          </div>

          {reporting && (
            <form onSubmit={sendReport} className="mt-4 max-w-md p-4 rounded-2xl bg-card border border-white/10 space-y-3">
              <label className="block text-xs text-muted font-mono uppercase tracking-wider">¿Qué problema tiene esta lista?
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} rows={2}
                  className="mt-1.5 w-full bg-surface border border-white/10 rounded-xl px-3 py-2 text-chalk text-sm normal-case tracking-normal font-sans focus:outline-none focus:border-gold/40" />
              </label>
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 rounded-full bg-gold text-void text-sm font-bold hover:bg-gold-hi">Enviar reporte</button>
                <button type="button" onClick={() => setReporting(false)} className="px-4 py-2 rounded-full glass border border-white/10 text-muted text-sm">Cancelar</button>
              </div>
            </form>
          )}
        </header>

        {list.items.length === 0 ? (
          <p className="text-muted text-sm py-10 text-center">Esta lista todavía no tiene títulos.</p>
        ) : (
          <ol className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {list.items.map((it, i) => (
              <li key={it.key} className="min-w-0">
                <Link to={`/${it.type}/${it.id}`} className="group block">
                  <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-surface border border-white/[0.06] group-hover:border-gold/30 transition-colors">
                    {it.poster ? <img src={`${IMG_W342}${it.poster}`} alt={it.title} loading="lazy" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-dim"><FilmSlate size={28} /></div>}
                    <span className="absolute top-2 left-2 w-6 h-6 rounded-full bg-void/80 border border-white/15 text-[11px] font-mono text-gold flex items-center justify-center">{i + 1}</span>
                  </div>
                  <p className="mt-2 text-chalk text-sm font-semibold leading-tight truncate group-hover:text-gold transition-colors">{it.title}</p>
                  <p className="text-muted text-xs font-mono">{it.year || ''}{it.type === 'tv' ? ' · Serie' : ''}</p>
                </Link>
                {it.note && <p className="mt-1 text-muted text-xs leading-snug italic">“{it.note}”</p>}
              </li>
            ))}
          </ol>
        )}

        {list.visibility === 'public' && !list.hidden && (
          <div className="mt-14 max-w-3xl"><Comments target={`list:${list.id}`} title="Comentarios" /></div>
        )}
      </div>
    </motion.main>
  )
}
