import { useState } from 'react'
import { Heart } from '@phosphor-icons/react'
import { social, errorText, ensureAccount } from '../../lib/social'
import { useReaction, setReaction } from '../../lib/reactions'
import { showToast } from '../../lib/toast'

/**
 * Me gusta de una película/serie ('movie:603') o de un comentario ('c:<id>').
 * Pide cuenta, responde al instante y revierte si el servidor falla. Su valor se comparte con el resto de la pantalla.
 */
export default function HeartButton({ k, label, compact = false, className = '' }) {
  const { count, liked } = useReaction(k)
  const [busy, setBusy] = useState(false)

  const toggle = async () => {
    if (busy) return
    if (!(await ensureAccount())) return
    const next = !liked
    setBusy(true)
    setReaction(k, { liked: next, count: Math.max(0, count + (next ? 1 : -1)) })
    const r = await social.react(k, next)
    if (r.ok) setReaction(k, { liked: r.data.liked, count: r.data.likes })
    else {
      setReaction(k, { liked, count })
      showToast({ icon: '⚠️', title: errorText(r.error), ttl: 3500, tone: 'blue' })
    }
    setBusy(false)
  }

  return (
    <button onClick={toggle} aria-pressed={liked} aria-label={`${liked ? 'Quitar me gusta' : 'Me gusta'}: ${label}`}
      className={`inline-flex items-center gap-1.5 rounded-full border transition-colors ${compact ? 'px-2.5 py-1 text-xs' : 'px-5 py-3 text-sm font-medium'}
        ${liked ? 'bg-red-500/15 border-red-400/40 text-red-300' : 'glass border-white/10 text-muted hover:text-chalk hover:border-white/25'} ${className}`}>
      <Heart size={compact ? 13 : 16} weight={liked ? 'fill' : 'regular'} />
      <span className="font-mono">{count}</span>
      {!compact && <span>Me gusta</span>}
    </button>
  )
}
