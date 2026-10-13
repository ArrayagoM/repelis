import { useEffect } from 'react'
import HeartButton from '../HeartButton'
import { social } from '../../lib/social'
import { useAuth } from '../../lib/auth'
import { seedReactions } from '../../lib/reactions'
import { tt } from '../../lib/i18n'

/** Corazón "Me gusta" para la parte de arriba de la ficha de una película o serie. target = 'movie:603' | 'tv:1396' */
export default function TitleLike({ target, title = tt("esta película o serie") }) {
  const { status } = useAuth()
  useEffect(() => {
    if (status === 'loading') return undefined
    let cancelled = false
    social.titleLikes(target).then((r) => { if (!cancelled && r.ok) seedReactions([[target, r.data.likes]]) })
    return () => { cancelled = true }
  }, [target, status])
  return <HeartButton k={target} label={title} />
}
