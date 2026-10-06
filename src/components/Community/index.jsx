import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, UserPlus, UserMinus, ListBullets, FilmSlate } from '@phosphor-icons/react'
import { IMG_W342 } from '../../api/tmdb'
import { TAG_LABELS } from '../../lib/socialRules'
import { social, ensureAccount } from '../../lib/social'
import { showToast } from '../../lib/toast'

export function Avatar({ name = '', size = 40, className = '' }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase()
  return (
    <span aria-hidden="true" style={{ width: size, height: size, fontSize: size * 0.42 }}
      className={`inline-flex items-center justify-center rounded-full bg-gradient-to-br from-gold to-gold-lo text-void font-display font-extrabold flex-shrink-0 ${className}`}>
      {initial}
    </span>
  )
}

/** Collage de pósters de una lista (hasta 4). */
export function Cover({ posters = [], className = '' }) {
  const shown = posters.slice(0, 4)
  if (!shown.length) {
    return <div className={`flex items-center justify-center bg-surface text-dim ${className}`}><FilmSlate size={32} /></div>
  }
  return (
    <div className={`grid gap-px bg-black overflow-hidden ${shown.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} ${className}`}>
      {shown.slice(0, shown.length >= 4 ? 4 : shown.length >= 2 ? 2 : 1).map((p, i) => (
        <img key={`${p}-${i}`} src={`${IMG_W342}${p}`} alt="" loading="lazy" className="w-full h-full object-cover" />
      ))}
    </div>
  )
}

export function LikeButton({ list, onChange, compact = false }) {
  const [state, setState] = useState({ liked: !!list.liked, likes: list.likes || 0, busy: false })
  // Si la lista cambia desde afuera (otra pestaña del feed), nos resincronizamos
  const sig = `${list.id}:${list.liked}:${list.likes}`
  const [lastSig, setLastSig] = useState(sig)
  if (sig !== lastSig) { setLastSig(sig); setState({ liked: !!list.liked, likes: list.likes || 0, busy: false }) }

  const toggle = async (e) => {
    e.preventDefault(); e.stopPropagation()
    if (state.busy) return
    if (!(await ensureAccount(list.title))) return
    const next = !state.liked
    setState((s) => ({ liked: next, likes: Math.max(0, s.likes + (next ? 1 : -1)), busy: true }))        // optimista
    const r = await social.like(list.id, next)
    if (r.ok) { setState({ liked: r.data.liked, likes: r.data.likes, busy: false }); onChange?.(r.data) }
    else { setState((s) => ({ liked: !next, likes: Math.max(0, s.likes + (next ? -1 : 1)), busy: false })); showToast({ icon: '⚠️', title: 'No pudimos guardar tu like', ttl: 3500, tone: 'blue' }) }
  }

  return (
    <button onClick={toggle} aria-pressed={state.liked} aria-label={state.liked ? 'Quitar me gusta' : 'Me gusta'}
      className={`inline-flex items-center gap-1.5 rounded-full border transition-colors ${compact ? 'px-2.5 py-1 text-xs' : 'px-4 py-2 text-sm'}
        ${state.liked ? 'bg-red-500/15 border-red-400/40 text-red-300' : 'glass border-white/10 text-muted hover:text-chalk hover:border-white/25'}`}>
      <Heart size={compact ? 13 : 16} weight={state.liked ? 'fill' : 'regular'} />
      <span className="font-mono">{state.likes}</span>
    </button>
  )
}

export function FollowButton({ handle, following: initial, onChange }) {
  const [following, setFollowing] = useState(!!initial)
  const [busy, setBusy] = useState(false)
  const toggle = async () => {
    if (busy) return
    if (!(await ensureAccount())) return
    setBusy(true)
    const r = await social.follow(handle, !following)
    setBusy(false)
    if (r.ok) { setFollowing(r.data.following); onChange?.(r.data) }
  }
  return (
    <button onClick={toggle} disabled={busy}
      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors disabled:opacity-60
        ${following ? 'glass border border-white/15 text-chalk hover:border-red-400/40 hover:text-red-300' : 'bg-gold text-void hover:bg-gold-hi'}`}>
      {following ? <><UserMinus size={16} weight="bold" /> Siguiendo</> : <><UserPlus size={16} weight="bold" /> Seguir</>}
    </button>
  )
}

/** Tarjeta de lista para feeds y perfiles. */
export function ListCard({ list }) {
  return (
    <article className="group rounded-2xl bg-card border border-white/[0.06] overflow-hidden hover:border-gold/30 transition-colors flex flex-col">
      <Link to={`/lista/${list.id}`} className="block" aria-label={`Abrir la lista ${list.title}`}>
        <div className="relative aspect-[16/10] bg-black overflow-hidden">
          <Cover posters={list.cover} className="w-full h-full group-hover:scale-[1.03] transition-transform duration-500" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
          <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-void/80 border border-white/15 text-[10px] font-semibold uppercase tracking-wide text-gold">
            {TAG_LABELS[list.tag] || 'Lista'}
          </span>
          <span className="absolute bottom-2.5 left-2.5 flex items-center gap-1 text-[11px] text-chalk/90 font-mono">
            <ListBullets size={12} /> {list.itemsCount} títulos
          </span>
        </div>
        <div className="p-3.5 pb-1">
          <h3 className="font-display font-bold text-chalk text-base leading-snug line-clamp-2">{list.title}</h3>
          {list.description && <p className="text-muted text-xs mt-1 line-clamp-2 leading-relaxed">{list.description}</p>}
        </div>
      </Link>
      <div className="mt-auto flex items-center justify-between gap-2 p-3.5 pt-2.5">
        {list.owner ? (
          <Link to={`/u/${list.owner.handle}`} className="flex items-center gap-2 min-w-0 text-xs text-muted hover:text-gold transition-colors">
            <Avatar name={list.owner.name} size={22} />
            <span className="truncate">@{list.owner.handle}</span>
          </Link>
        ) : <span />}
        <LikeButton list={list} compact />
      </div>
    </article>
  )
}

export const ListGrid = ({ lists }) => (
  <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
    {lists.map((l) => <ListCard key={l.id} list={l} />)}
  </div>
)

export const EmptyState = ({ title, children, action }) => (
  <div className="max-w-md mx-auto text-center py-14 px-6">
    <div className="w-14 h-14 mx-auto rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center mb-4"><ListBullets size={26} className="text-gold" /></div>
    <p className="text-chalk font-display font-bold text-lg">{title}</p>
    <p className="text-muted text-sm mt-2 leading-relaxed">{children}</p>
    {action}
  </div>
)
