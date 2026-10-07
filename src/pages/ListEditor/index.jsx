import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, MagnifyingGlass, Plus, X, CaretUp, CaretDown, FilmSlate, DownloadSimple, LockKey } from '@phosphor-icons/react'
import { searchMulti, IMG_W342 } from '../../api/tmdb'
import { LIMITS, TAGS, TAG_LABELS, planOf, hasLink } from '../../lib/socialRules'
import { social, errorText, useMe, refreshMe } from '../../lib/social'
import { useAuth } from '../../lib/auth'
import { useLibrary } from '../../lib/library'
import { useSEO } from '../../lib/useSEO'

const inputCls = 'w-full bg-surface border border-white/10 rounded-xl px-4 py-2.5 text-chalk text-sm placeholder:text-muted/50 focus:outline-none focus:border-gold/50 transition-colors'

const fromTmdb = (r) => ({
  type: r.media_type === 'tv' ? 'tv' : 'movie', id: r.id, title: r.title || r.name || '',
  poster: r.poster_path || null, year: (r.release_date || r.first_air_date || '').slice(0, 4) || null, note: '',
})

export default function ListEditor() {
  useEffect(() => { window.scrollTo(0, 0) }, [])
  const { id } = useParams()
  const editing = !!id
  const navigate = useNavigate()
  const location = useLocation()
  const auth = useAuth()
  const me = useMe()
  const library = useLibrary()
  useSEO({ title: editing ? 'Editar lista' : 'Nueva lista', description: 'Armá y compartí tu lista', noindex: true })

  const [form, setForm] = useState(() => ({
    title: String(location.state?.title || '').slice(0, 80), description: '',
    tag: TAGS.includes(location.state?.tag) ? location.state.tag : 'finde', visibility: 'public', items: [],
  }))
  const [loading, setLoading] = useState(editing)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const preloaded = useRef(false)

  const premium = !!me.data?.plan?.premium
  const plan = LIMITS[planOf({ premium })]

  // Editar: cargar la lista
  useEffect(() => {
    if (!editing) return undefined
    let cancelled = false
    social.list(id).then((r) => {
      if (cancelled) return
      if (!r.ok || !r.data.viewer.isOwner) { setError(r.ok ? 'Solo quien armó la lista puede editarla.' : errorText(r.error)); setLoading(false); return }
      const l = r.data.list
      setForm({ title: l.title, description: l.description || '', tag: l.tag, visibility: l.visibility, items: l.items })
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [id, editing])

  // Nueva lista que viene de "Agregar a una lista" en una ficha: ya trae un título
  useEffect(() => {
    const first = location.state?.item
    if (!editing && first && !preloaded.current) { preloaded.current = true; setForm((f) => ({ ...f, items: [{ ...first, note: '' }] })) }
  }, [editing, location.state])

  // Búsqueda de títulos (con espera, para no gastar pedidos a TMDB en cada tecla)
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResults([]); return undefined }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const { data } = await searchMulti(q)
        setResults((data.results || []).filter((r) => (r.media_type === 'movie' || r.media_type === 'tv') && (r.title || r.name)).slice(0, 8).map(fromTmdb))
      } catch { setResults([]) }
      setSearching(false)
    }, 350)
    return () => clearTimeout(t)
  }, [query])

  const keys = useMemo(() => new Set(form.items.map((i) => `${i.type}:${i.id}`)), [form.items])
  const full = form.items.length >= plan.items
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const add = (it) => { if (!keys.has(`${it.type}:${it.id}`) && !full) set({ items: [...form.items, it] }) }
  const remove = (i) => set({ items: form.items.filter((_, idx) => idx !== i) })
  const move = (i, d) => {
    const j = i + d
    if (j < 0 || j >= form.items.length) return
    const next = [...form.items]; [next[i], next[j]] = [next[j], next[i]]
    set({ items: next })
  }
  const setNote = (i, note) => set({ items: form.items.map((it, idx) => (idx === i ? { ...it, note } : it)) })

  const importFromMyList = () => {
    const extra = library.list
      .filter((x) => !keys.has(`${x.type}:${x.id}`))
      .map((x) => ({ type: x.type, id: x.id, title: x.title, poster: x.poster, year: (x.date || '').slice(0, 4) || null, note: '' }))
    set({ items: [...form.items, ...extra].slice(0, plan.items) })
  }

  const linkInText = hasLink(form.title) || hasLink(form.description) || form.items.some((i) => hasLink(i.note || ''))
  const canSave = form.title.trim().length >= 3 && !linkInText && !saving

  const save = async (e) => {
    e.preventDefault()
    if (!canSave) return
    setSaving(true); setError('')
    const r = await social.saveList({ id: editing ? id : undefined, ...form })
    setSaving(false)
    if (!r.ok) return setError(errorText(r.error))
    await refreshMe()
    navigate(`/lista/${r.data.list.id}`)
  }

  if (auth.status === 'loading' || loading) return <div className="min-h-screen bg-void pt-32 px-6"><div className="max-w-3xl mx-auto skeleton h-72 rounded-3xl" /></div>
  if (auth.status !== 'in') {
    return (
      <main className="min-h-screen bg-void flex flex-col items-center justify-center gap-4 px-6 text-center">
        <LockKey size={36} className="text-gold" weight="fill" />
        <p className="text-chalk font-display font-bold text-xl">Para armar listas necesitás una cuenta gratis</p>
        <Link to="/cuenta?modo=registro&volver=/lista/nueva" className="px-6 py-2.5 rounded-full bg-gold text-void font-bold text-sm hover:bg-gold-hi">Crear mi cuenta</Link>
      </main>
    )
  }
  if (error && editing && !form.title) {
    return <main className="min-h-screen bg-void flex flex-col items-center justify-center gap-3 px-6 text-center"><p className="text-muted text-sm">{error}</p><Link to="/perfil" className="text-gold text-sm hover:underline">Volver a mi perfil</Link></main>
  }

  return (
    <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-void pt-28 pb-24">
      <form onSubmit={save} className="max-w-3xl mx-auto px-6 space-y-8">
        <div>
          <Link to={editing ? `/lista/${id}` : '/comunidad'} className="inline-flex items-center gap-2 text-muted hover:text-gold text-sm mb-4"><ArrowLeft size={14} /> Volver</Link>
          <h1 className="font-display font-extrabold text-3xl text-chalk">{editing ? 'Editar lista' : 'Nueva lista'}</h1>
          <p className="text-muted text-sm mt-1">Una selección para compartir: un zapping, un plan de finde, una maratón.</p>
        </div>

        <section className="space-y-4">
          <label className="block text-xs text-muted font-mono uppercase tracking-wider">Título
            <input value={form.title} onChange={(e) => set({ title: e.target.value })} maxLength={LIMITS.title} placeholder="Ej: Plan de finde para ver en pareja" className={`${inputCls} mt-1.5 normal-case tracking-normal font-sans`} required />
          </label>
          <label className="block text-xs text-muted font-mono uppercase tracking-wider">Descripción (opcional)
            <textarea value={form.description} onChange={(e) => set({ description: e.target.value })} maxLength={LIMITS.description} rows={3} className={`${inputCls} mt-1.5 normal-case tracking-normal font-sans`} />
          </label>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block text-xs text-muted font-mono uppercase tracking-wider">Tipo
              <select value={form.tag} onChange={(e) => set({ tag: e.target.value })} className={`${inputCls} mt-1.5 normal-case tracking-normal font-sans`}>
                {TAGS.map((t) => <option key={t} value={t}>{TAG_LABELS[t]}</option>)}
              </select>
            </label>
            <label className="block text-xs text-muted font-mono uppercase tracking-wider">Quién la ve
              <select value={form.visibility} onChange={(e) => set({ visibility: e.target.value })} className={`${inputCls} mt-1.5 normal-case tracking-normal font-sans`}>
                <option value="public">Todos (pública)</option>
                <option value="private" disabled={!premium}>Solo yo (privada){premium ? '' : ' — Premium'}</option>
              </select>
            </label>
          </div>
          {linkInText && <p role="alert" className="text-amber-300 text-xs">Por seguridad no se permiten links en los textos.</p>}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display font-bold text-lg text-chalk">Títulos <span className="text-muted font-mono text-sm">({form.items.length}/{plan.items})</span></h2>
            {library.list.length > 0 && (
              <button type="button" onClick={importFromMyList} disabled={full}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full glass border border-white/10 text-muted text-xs hover:text-gold hover:border-gold/30 disabled:opacity-40">
                <DownloadSimple size={13} /> Importar de Mi lista
              </button>
            )}
          </div>

          <div className="relative">
            <MagnifyingGlass size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar una película o serie para agregar…" className={`${inputCls} pl-10`} aria-label="Buscar títulos" />
          </div>
          {(results.length > 0 || searching) && (
            <ul className="rounded-2xl bg-card border border-white/10 divide-y divide-white/5 overflow-hidden">
              {searching && results.length === 0 && <li className="p-3 text-muted text-xs">Buscando…</li>}
              {results.map((r) => {
                const already = keys.has(`${r.type}:${r.id}`)
                return (
                  <li key={`${r.type}:${r.id}`} className="flex items-center gap-3 p-2.5">
                    <div className="w-9 h-[3.4rem] rounded-md overflow-hidden bg-surface flex-shrink-0">{r.poster && <img src={`${IMG_W342}${r.poster}`} alt="" className="w-full h-full object-cover" />}</div>
                    <div className="min-w-0 flex-1"><p className="text-chalk text-sm font-semibold truncate">{r.title}</p><p className="text-muted text-xs font-mono">{r.year || '—'} · {r.type === 'tv' ? 'Serie' : 'Película'}</p></div>
                    <button type="button" onClick={() => add(r)} disabled={already || full} aria-label={`Agregar ${r.title}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-gold/15 border border-gold/30 text-gold text-xs font-semibold hover:bg-gold/25 disabled:opacity-40">
                      <Plus size={12} weight="bold" /> {already ? 'Agregada' : 'Agregar'}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {form.items.length === 0 ? (
            <p className="text-muted text-sm py-6 text-center border border-dashed border-white/10 rounded-2xl">Todavía no agregaste títulos. Buscalos arriba.</p>
          ) : (
            <ol className="space-y-2">
              {form.items.map((it, i) => (
                <li key={`${it.type}:${it.id}`} className="flex items-start gap-3 p-2.5 rounded-2xl bg-card border border-white/[0.06]">
                  <span className="w-6 text-center text-gold font-mono text-sm pt-1">{i + 1}</span>
                  <div className="w-10 h-[3.75rem] rounded-md overflow-hidden bg-surface flex-shrink-0">{it.poster ? <img src={`${IMG_W342}${it.poster}`} alt="" className="w-full h-full object-cover" /> : <FilmSlate size={18} className="m-3 text-dim" />}</div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="text-chalk text-sm font-semibold truncate">{it.title} <span className="text-muted font-mono text-xs">{it.year || ''}</span></p>
                    <input value={it.note || ''} onChange={(e) => setNote(i, e.target.value)} maxLength={LIMITS.note} placeholder="Una nota corta (opcional)" aria-label={`Nota para ${it.title}`}
                      className="w-full bg-surface border border-white/10 rounded-lg px-3 py-1.5 text-chalk text-xs placeholder:text-muted/50 focus:outline-none focus:border-gold/40" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir" className="w-7 h-7 rounded-md text-muted hover:text-chalk hover:bg-white/5 disabled:opacity-25 flex items-center justify-center"><CaretUp size={14} /></button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === form.items.length - 1} aria-label="Bajar" className="w-7 h-7 rounded-md text-muted hover:text-chalk hover:bg-white/5 disabled:opacity-25 flex items-center justify-center"><CaretDown size={14} /></button>
                  </div>
                  <button type="button" onClick={() => remove(i)} aria-label={`Quitar ${it.title}`} className="w-7 h-7 rounded-md text-muted hover:text-red-300 hover:bg-red-500/10 flex items-center justify-center"><X size={14} /></button>
                </li>
              ))}
            </ol>
          )}
        </section>

        {error && <p role="alert" className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-200 text-sm">{error}</p>}

        <div className="flex gap-3">
          <button type="submit" disabled={!canSave} className="px-8 py-3 rounded-full bg-gold text-void font-bold text-sm hover:bg-gold-hi transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Publicar lista'}
          </button>
          <Link to={editing ? `/lista/${id}` : '/comunidad'} className="px-6 py-3 rounded-full glass border border-white/10 text-muted text-sm hover:text-chalk">Cancelar</Link>
        </div>
      </form>
    </motion.main>
  )
}
