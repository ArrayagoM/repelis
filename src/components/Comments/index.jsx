import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Star, ChatCircleText, Trash, Flag } from '@phosphor-icons/react'
import HeartButton from '../HeartButton'
import { seedReactions } from '../../lib/reactions'
import { Avatar } from '../Community'
import { LIMITS } from '../../lib/socialRules'
import { social, errorText, ensureAccount, useMe } from '../../lib/social'
import { useAuth } from '../../lib/auth'
import { showToast } from '../../lib/toast'
import { ago } from '../../lib/panelFormat'

const Stars = ({ value = 0, size = 14 }) => (
  <span className="inline-flex gap-0.5" role="img" aria-label={`${value} de 5 estrellas`}>
    {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={size} weight={n <= Math.round(value) ? 'fill' : 'regular'} className={n <= Math.round(value) ? 'text-gold' : 'text-dim'} />)}
  </span>
)

const StarPicker = ({ value, onChange }) => (
  <div className="flex items-center gap-1" role="radiogroup" aria-label="Tu calificación">
    {[1, 2, 3, 4, 5].map((n) => (
      <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'}`}
        onClick={() => onChange(value === n ? 0 : n)} className="p-0.5">
        <Star size={24} weight={n <= value ? 'fill' : 'regular'} className={n <= value ? 'text-gold' : 'text-dim hover:text-gold/60'} />
      </button>
    ))}
    {value > 0 && <button type="button" onClick={() => onChange(0)} className="ml-2 text-xs text-muted hover:text-chalk">Quitar</button>}
  </div>
)

/**
 * Opiniones (películas/series, con estrellas opcionales) y comentarios (listas).
 * target: 'movie:603' | 'tv:1396' | 'list:<id>'
 */
export default function Comments({ target, title = 'Opiniones de la comunidad' }) {
  const withRating = !target.startsWith('list:')
  const auth = useAuth()
  const me = useMe()
  const [state, setState] = useState({ loading: true, error: '', comments: [], summary: null, hasMore: false, mine: null, likes: null })
  const [text, setText] = useState('')
  const [rating, setRating] = useState(0)
  const [sending, setSending] = useState(false)
  const [formError, setFormError] = useState('')
  const [reporting, setReporting] = useState(null)
  const [reason, setReason] = useState('')

  const load = useCallback(async ({ more = false } = {}) => {
    const before = more ? state.comments.at(-1)?.createdAt : undefined
    const r = await social.comments(target, before)
    if (!r.ok) { setState((s) => ({ ...s, loading: false, error: errorText(r.error) })); return }
    setState((s) => ({
      loading: false, error: '', summary: r.data.summary, hasMore: r.data.hasMore, mine: r.data.viewer.comment, likes: r.data.likes,
      comments: more ? [...s.comments, ...r.data.comments] : r.data.comments,
    }))
    seedReactions([
      ...(r.data.likes ? [[target, r.data.likes]] : []),
      ...r.data.comments.map((c) => [`c:${c.id}`, { count: c.likes || 0, liked: !!c.liked }]),
    ])
    if (!more && r.data.viewer.comment && withRating) { setText(r.data.viewer.comment.text); setRating(r.data.viewer.comment.rating || 0) }
  }, [target, state.comments, withRating])

  useEffect(() => { setState({ loading: true, error: '', comments: [], summary: null, hasMore: false, mine: null, likes: null }); setText(''); setRating(0) }, [target])
  useEffect(() => { load() }, [target, auth.status]) // eslint-disable-line react-hooks/exhaustive-deps

  const hasProfile = !!me.data?.profile
  const trimmed = text.trim()

  const submit = async (e) => {
    e.preventDefault()
    if (sending || trimmed.length < 2) return
    if (!(await ensureAccount())) return
    setSending(true); setFormError('')
    const r = await social.postComment({ target, text: trimmed, rating: withRating && rating ? rating : undefined })
    setSending(false)
    if (!r.ok) return setFormError(errorText(r.error))
    if (!withRating) setText('')
    showToast({ icon: '💬', title: r.data.updated ? 'Opinión actualizada' : 'Gracias por opinar', ttl: 3000, tone: 'green' })
    load()
  }

  const remove = async (c) => {
    if (!window.confirm('¿Borrar este comentario?')) return
    const r = await social.deleteComment(c.id)
    if (r.ok) {
      if (c.mine && withRating) { setText(''); setRating(0) }
      load()
    } else showToast({ icon: '⚠️', title: errorText(r.error), ttl: 3500, tone: 'blue' })
  }

  const sendReport = async (e) => {
    e.preventDefault()
    if (!(await ensureAccount())) return
    const r = await social.reportComment(reporting, reason)
    setReporting(null); setReason('')
    showToast(r.ok ? { icon: '🚩', title: 'Gracias por avisar', text: 'Revisamos los reportes.', ttl: 4000 } : { icon: '⚠️', title: errorText(r.error), ttl: 3500, tone: 'blue' })
  }

  const { summary } = state
  return (
    <section aria-label={title} className="mt-16">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <ChatCircleText size={20} className="text-gold" />
        <h2 className="font-display font-bold text-xl text-chalk mr-auto">{title}</h2>
        {state.likes && <HeartButton k={target} label="esta película o serie" />}
        {summary && summary.count > 0 && (
          <span className="flex items-center gap-2 text-sm text-muted">
            {withRating && summary.avg ? <><Stars value={summary.avg} /><strong className="text-chalk">{summary.avg}</strong> · </> : null}
            {summary.count} {summary.count === 1 ? (withRating ? 'opinión' : 'comentario') : (withRating ? 'opiniones' : 'comentarios')}
          </span>
        )}
      </div>

      {/* Escribir */}
      {auth.status === 'in' && !hasProfile && me.loaded ? (
        <p className="mb-6 p-4 rounded-2xl bg-card border border-white/[0.06] text-sm text-muted">
          Para opinar, primero elegí tu @usuario. <Link to="/perfil" className="text-gold hover:underline">Crear mi perfil</Link>
        </p>
      ) : (
        <form onSubmit={submit} className="mb-8 p-4 rounded-2xl bg-card border border-white/[0.06] space-y-3">
          {withRating && <StarPicker value={rating} onChange={setRating} />}
          <label className="block">
            <span className="sr-only">Tu {withRating ? 'opinión' : 'comentario'}</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={LIMITS.comment} rows={3}
              placeholder={withRating ? (state.mine ? 'Editá tu opinión…' : '¿Qué te pareció? Sin spoilers, por favor.') : 'Escribí un comentario…'}
              className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-chalk text-sm placeholder:text-muted/50 focus:outline-none focus:border-gold/50 transition-colors" />
          </label>
          {formError && <p role="alert" className="text-red-300 text-xs">{formError}</p>}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={sending || trimmed.length < 2}
              className="px-6 py-2 rounded-full bg-gold text-void font-bold text-sm hover:bg-gold-hi disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {sending ? 'Enviando…' : state.mine && withRating ? 'Actualizar opinión' : 'Publicar'}
            </button>
            {auth.status !== 'in' && <span className="text-muted text-xs">Hace falta una cuenta gratis para publicar.</span>}
            <span className="ml-auto text-muted/60 text-xs font-mono">{text.length}/{LIMITS.comment}</span>
          </div>
        </form>
      )}

      {/* Lista */}
      {state.loading ? <div className="skeleton h-24 rounded-2xl" />
        : state.error ? <p role="alert" className="text-sm text-red-200">{state.error}</p>
        : state.comments.length === 0 ? <p className="text-muted text-sm">Todavía no hay {withRating ? 'opiniones' : 'comentarios'}. ¡Sé la primera persona!</p>
        : (
          <ul className="space-y-3">
            {state.comments.map((c) => (
              <li key={c.id} className="p-4 rounded-2xl bg-card border border-white/[0.06]">
                <div className="flex items-center gap-3">
                  {c.author ? <Avatar name={c.author.name} size={32} /> : <Avatar name="?" size={32} />}
                  <div className="min-w-0 mr-auto">
                    {c.author
                      ? <Link to={`/u/${c.author.handle}`} className="text-sm font-semibold text-chalk hover:text-gold">{c.author.name} <span className="text-muted font-normal">@{c.author.handle}</span></Link>
                      : <span className="text-sm text-muted">Usuario eliminado</span>}
                    <p className="text-muted/70 text-[11px]">{ago(c.createdAt)}{c.edited ? ' · editado' : ''}</p>
                  </div>
                  {c.rating ? <Stars value={c.rating} /> : null}
                </div>
                <p className="mt-3 text-sm text-chalk/90 leading-relaxed whitespace-pre-line break-words">{c.text}</p>
                <div className="mt-3 flex items-center gap-4 text-xs">
                  <HeartButton k={`c:${c.id}`} label={withRating ? 'esta opinión' : 'este comentario'} compact />
                  {c.canDelete && <button onClick={() => remove(c)} className="inline-flex items-center gap-1 text-muted hover:text-red-300"><Trash size={13} /> Borrar</button>}
                  {!c.mine && <button onClick={() => { setReporting(reporting === c.id ? null : c.id); setReason('') }} className="inline-flex items-center gap-1 text-muted hover:text-chalk"><Flag size={13} /> Reportar</button>}
                </div>
                {reporting === c.id && (
                  <form onSubmit={sendReport} className="mt-3 flex flex-wrap gap-2">
                    <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={LIMITS.report} placeholder="¿Qué problema tiene? (opcional)"
                      className="flex-1 min-w-[12rem] bg-surface border border-white/10 rounded-full px-4 py-1.5 text-chalk text-xs focus:outline-none focus:border-gold/40" />
                    <button className="px-4 py-1.5 rounded-full bg-gold text-void text-xs font-bold hover:bg-gold-hi">Enviar</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      {state.hasMore && (
        <button onClick={() => load({ more: true })} className="mt-4 px-5 py-2 rounded-full glass border border-white/10 text-muted text-sm hover:text-chalk">Ver más</button>
      )}
    </section>
  )
}
