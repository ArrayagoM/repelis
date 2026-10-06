import { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import PosterStrip from '../PosterStrip'
import { openPlayer } from '../../store/slices/playerSlice'
import { getLibrary, useLibrary } from '../../lib/library'
import { usePersonal } from '../../lib/auth'
import { loadNewEpisodes } from '../../lib/newEpisodes'
import { dateLabel } from '../../lib/reminders'
import { showToast } from '../../lib/toast'

const TOASTED_KEY = 'lifehigh:epToasted:v1'
const wasToasted = (k) => { try { return (JSON.parse(localStorage.getItem(TOASTED_KEY) || '[]')).includes(k) } catch { return false } }
const markToasted = (k) => {
  try {
    const arr = JSON.parse(localStorage.getItem(TOASTED_KEY) || '[]')
    localStorage.setItem(TOASTED_KEY, JSON.stringify([...arr, k].slice(-60)))
  } catch { /* sin storage */ }
}

/** Hook: series seguidas con episodio nuevo o por salir. */
export const useNewEpisodes = () => {
  const lib = useLibrary()
  const personal = usePersonal()
  const [items, setItems] = useState([])
  // Solo reconsultamos cuando cambian las series seguidas (no con cada tick de progreso)
  const sig = [...lib.history, ...lib.list].filter((x) => x.type === 'tv').map((x) => x.id).sort().join(',')

  useEffect(() => {
    if (!personal) { setItems([]); return undefined }
    let cancelled = false
    loadNewEpisodes(getLibrary()).then((r) => { if (!cancelled) setItems(r) })
    return () => { cancelled = true }
  }, [sig, personal])

  return items
}

/** Fila "Nuevos capítulos" (Home). No aparece si no hay novedades. */
export function NewEpisodesRow() {
  const dispatch = useDispatch()
  const found = useNewEpisodes()

  const items = found.map(({ show, info }) => {
    const code = `T${info.season} E${info.episode}`
    const isNew = info.kind === 'new'
    return {
      key: `${show.id}:${info.season}:${info.episode}`,
      poster: show.poster,
      title: show.title,
      sub: isNew ? (info.daysAgo === 0 ? `${code} · salió hoy` : `${code} · hace ${info.daysAgo} d`) : `${code} · ${dateLabel(info.date)}`,
      chip: isNew ? 'Nuevo' : 'Pronto',
      chipTone: isNew ? 'green' : 'blue',
      playIcon: isNew,
      to: isNew ? undefined : `/tv/${show.id}`,
      onClick: isNew ? () => dispatch(openPlayer({
        movieId: show.id,
        title: `${show.title} — ${code}`,
        mediaType: 'tv',
        season: info.season,
        episode: info.episode,
        totalSeasons: show.totalSeasons || info.season,
        item: { id: show.id, type: 'tv', title: show.title, poster: show.poster, backdrop: show.backdrop, date: show.date, genres: show.genres || [], totalSeasons: show.totalSeasons, rating: show.rating, votes: show.votes, pop: show.pop },
      })) : undefined,
    }
  })

  return <PosterStrip id="nuevos-capitulos" title="Nuevos capítulos" badge="De tus series" badgeTone="green" items={items} />
}

/** Aviso global (una sola vez por episodio) cuando una serie que seguís estrenó capítulo. No renderiza nada. */
export function NewEpisodesWatcher() {
  const found = useNewEpisodes()
  useEffect(() => {
    for (const { show, info } of found) {
      if (info.kind !== 'new' || info.daysAgo > 2) continue
      const k = `${show.id}:${info.season}:${info.episode}`
      if (wasToasted(k)) continue
      markToasted(k)
      showToast({
        icon: '📺', title: `Capítulo nuevo de ${show.title}`, text: `T${info.season} E${info.episode}`,
        actionLabel: 'Ver serie', to: `/tv/${show.id}`, ttl: 10000, tone: 'green',
      })
    }
  }, [found])
  return null
}
