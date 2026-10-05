import { useEffect } from 'react'
import { getLibrary, updateReminders } from '../../lib/library'
import { reminderActions, systemNotify, dateLabel } from '../../lib/reminders'
import { showToast } from '../../lib/toast'
import { getMovieDetail, getTVDetail } from '../../api/tmdb'

const MAX_REFRESH = 10
const path = (r) => `/${r.type === 'tv' ? 'tv' : 'movie'}/${r.id}`

/**
 * Al abrir la app: actualiza las fechas de estreno (TMDB las mueve seguido) y avisa
 * de lo que ya salió o sale mañana. No renderiza nada.
 */
export default function ReminderWatcher() {
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const pending = getLibrary().reminders.filter((r) => !r.notified).slice(0, MAX_REFRESH)
      if (!pending.length) return

      // 1) Fechas al día
      const fresh = await Promise.all(pending.map(async (r) => {
        try {
          const { data } = await (r.type === 'tv' ? getTVDetail(r.id) : getMovieDetail(r.id))
          return { key: `${r.type}:${r.id}`, date: data.release_date || data.first_air_date || r.date, poster: data.poster_path || r.poster }
        } catch { return null }
      }))
      if (cancelled) return
      const byKey = Object.fromEntries(fresh.filter(Boolean).map((f) => [f.key, f]))
      updateReminders((list) => list.map((r) => {
        const f = byKey[`${r.type}:${r.id}`]
        // Si la fecha cambió, volvemos a avisar con la nueva
        return f && f.date !== r.date ? { ...r, date: f.date, poster: f.poster, notified: false, notifiedSoon: false } : r
      }))

      // 2) Qué avisar
      const { released, soon } = reminderActions(getLibrary().reminders)
      for (const r of released) {
        showToast({ icon: '🎬', title: `¡Ya se estrenó ${r.title}!`, text: 'Lo guardaste para que te avisemos.', actionLabel: 'Ver ahora', to: path(r), ttl: 12000 })
        systemNotify(`¡Ya se estrenó ${r.title}!`, 'Abrí Life High para verla.', path(r))
      }
      for (const r of soon) {
        showToast({ icon: '⏰', title: `Mañana se estrena ${r.title}`, text: dateLabel(r.date), actionLabel: 'Ver ficha', to: path(r), ttl: 9000, tone: 'blue' })
        systemNotify(`Mañana se estrena ${r.title}`, 'Te lo recordamos desde Life High.', path(r))
      }
      if (released.length || soon.length) {
        const doneR = new Set(released.map((r) => `${r.type}:${r.id}`))
        const doneS = new Set(soon.map((r) => `${r.type}:${r.id}`))
        updateReminders((list) => list.map((r) => {
          const k = `${r.type}:${r.id}`
          return doneR.has(k) ? { ...r, notified: true } : doneS.has(k) ? { ...r, notifiedSoon: true } : r
        }))
      }
    }
    const t = setTimeout(run, 4000)   // no compite con la carga inicial
    return () => { cancelled = true; clearTimeout(t) }
  }, [])
  return null
}
