import { useMemo } from 'react'
import { useDispatch } from 'react-redux'
import PosterStrip from '../PosterStrip'
import { openPlayer } from '../../store/slices/playerSlice'
import { useLibrary, continueWatching, progressOf, removeHistory, toggleList, toggleReminder } from '../../lib/library'
import { dateLabel } from '../../lib/reminders'

const detailPath = (x) => `/${x.type === 'tv' ? 'tv' : 'movie'}/${x.id}`

/** "Continuar viendo": películas a medias y el siguiente episodio de tus series. */
export function ContinueRow() {
  const lib = useLibrary()
  const dispatch = useDispatch()
  const entries = useMemo(() => continueWatching(lib), [lib])

  const items = entries.map((h) => {
    const isTV = h.type === 'tv'
    const season = h.next ? h.nextSeason : h.season
    const episode = h.next ? h.nextEpisode : h.episode
    const left = Math.max(0, Math.round(((h.runtimeMin || 0) * 60 - h.watchedSec) / 60))
    return {
      key: `${h.type}:${h.id}`,
      poster: h.poster,
      title: h.title,
      sub: isTV
        ? `T${season} E${episode}${h.next ? ' · siguiente' : left ? ` · quedan ~${left} min` : ''}`
        : (left ? `Quedan ~${left} min` : 'Seguir viendo'),
      progress: h.next ? 0 : progressOf(h),
      chip: h.next ? 'Siguiente' : undefined,
      chipTone: 'blue',
      playIcon: true,
      onClick: () => dispatch(openPlayer({
        movieId: h.id,
        title: isTV ? `${h.title} — T${season} E${episode}` : h.title,
        mediaType: h.type,
        season,
        episode,
        totalSeasons: h.totalSeasons || 1,
        item: { id: h.id, type: h.type, title: h.title, poster: h.poster, backdrop: h.backdrop, date: h.date, genres: h.genres || [], totalSeasons: h.totalSeasons },
        runtimeMin: h.runtimeMin,
      })),
      onRemove: () => removeHistory(h.type, h.id),
    }
  })

  return <PosterStrip id="continuar" title="Continuar viendo" badge="Seguí donde dejaste" items={items} />
}

/** "Mi lista" (Home: solo si hay algo guardado). */
export function MyListRow({ limit = 20, onViewAll }) {
  const lib = useLibrary()
  const items = lib.list.slice(0, limit).map((x) => ({
    key: `${x.type}:${x.id}`,
    poster: x.poster,
    title: x.title,
    sub: x.date?.slice(0, 4) || '',
    to: detailPath(x),
    onRemove: () => toggleList(x),
  }))
  return <PosterStrip id="mi-lista" title="Mi lista" badge="Guardadas" items={items} onViewAll={onViewAll} />
}

/** "Te avisamos": estrenos que pediste recordar. */
export function RemindersRow() {
  const lib = useLibrary()
  const items = [...lib.reminders]
    .sort((a, b) => (a.date || '9').localeCompare(b.date || '9'))
    .map((r) => ({
      key: `${r.type}:${r.id}`,
      poster: r.poster,
      title: r.title,
      sub: r.notified ? 'Ya se estrenó' : dateLabel(r.date),
      chip: r.notified ? 'Ya salió' : 'Avisame',
      chipTone: r.notified ? 'green' : 'blue',
      to: detailPath(r),
      onRemove: () => toggleReminder(r),
    }))
  return <PosterStrip id="avisos" title="Te avisamos cuando salgan" badge="Estrenos" badgeTone="blue" items={items} />
}
