import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CalendarBlank, TelevisionSimple, FilmSlate } from '@phosphor-icons/react'
import { getCalendarMovies, getCalendarTV, IMG_W342 } from '../../api/tmdb'
import { groupByDate } from '../../lib/calendar'
import { toLibItem } from '../../lib/library'
import ReminderButton from '../../components/ReminderButton'
import { useSEO } from '../../lib/useSEO'

const FILTERS = [['all', 'Todo'], ['movie', 'Películas'], ['tv', 'Series']]
const PAGES_MOVIES = 3
const PAGES_TV = 2

export default function Calendario() {
  useSEO({
    title: 'Calendario de estrenos',
    description: 'Todos los estrenos de películas y series de las próximas semanas, día por día. Pedí que te avisemos cuando salgan.',
  })
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    let cancelled = false
    const pages = (fn, n) => Array.from({ length: n }, (_, i) => fn(i + 1).then((r) => r.data.results).catch(() => []))
    Promise.all([...pages(getCalendarMovies, PAGES_MOVIES), ...pages(getCalendarTV, PAGES_TV)])
      .then((chunks) => {
        if (cancelled) return
        const movies = chunks.slice(0, PAGES_MOVIES).flat().map((r) => ({ raw: r, type: 'movie' }))
        const shows = chunks.slice(PAGES_MOVIES).flat().map((r) => ({ raw: r, type: 'tv' }))
        const seen = new Set()
        const all = [...movies, ...shows]
          .filter(({ raw, type }) => { const k = `${type}:${raw.id}`; if (seen.has(k)) return false; seen.add(k); return true })
          .map(({ raw, type }) => ({ ...toLibItem(raw, type), key: `${type}:${raw.id}` }))
        if (!all.length) setError(true)
        setItems(all)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const groups = useMemo(
    () => groupByDate(items.filter((i) => filter === 'all' || i.type === filter)),
    [items, filter],
  )

  return (
    <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-void pt-28 pb-24">
      <div className="max-w-4xl mx-auto px-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="w-10 h-10 rounded-full bg-blue-500/15 border border-blue-400/30 flex items-center justify-center">
            <CalendarBlank size={20} weight="fill" className="text-blue-300" />
          </span>
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-chalk">Calendario de estrenos</h1>
        </div>
        <p className="text-muted text-sm leading-relaxed max-w-xl">
          Lo que se estrena en las próximas 6 semanas, día por día. Tocá la campana para que te avisemos cuando salga.
        </p>

        <div className="flex gap-2 mt-6 mb-8" role="tablist">
          {FILTERS.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={filter === id} onClick={() => setFilter(id)}
              className={`px-4 py-1.5 rounded-full border text-sm font-medium transition-colors ${filter === id ? 'bg-gold text-void border-gold' : 'glass border-white/10 text-muted hover:text-chalk'}`}>
              {label}
            </button>
          ))}
        </div>

        {loading && <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}</div>}
        {!loading && error && <p className="text-muted text-sm">No pudimos cargar el calendario. Probá de nuevo en un rato.</p>}
        {!loading && !error && groups.length === 0 && <p className="text-muted text-sm">No hay estrenos en esta categoría.</p>}

        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.date} aria-label={g.label}>
              <h2 className="sticky top-16 z-10 py-2 bg-void/90 backdrop-blur font-display font-bold text-lg text-gold border-b border-white/5">
                {g.label}
              </h2>
              <ul className="divide-y divide-white/5">
                {g.items.map((it) => (
                  <li key={it.key} className="flex items-center gap-4 py-3">
                    <Link to={`/${it.type === 'tv' ? 'tv' : 'movie'}/${it.id}`} className="flex items-center gap-4 flex-1 min-w-0 group">
                      <div className="w-12 h-[4.5rem] rounded-lg overflow-hidden bg-surface flex-shrink-0 border border-white/10">
                        {it.poster
                          ? <img src={`${IMG_W342}${it.poster}`} alt="" loading="lazy" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-dim"><FilmSlate size={18} /></div>}
                      </div>
                      <div className="min-w-0">
                        <p className="text-chalk font-semibold text-sm truncate group-hover:text-gold transition-colors">{it.title}</p>
                        <p className="text-muted text-xs mt-0.5 flex items-center gap-1">
                          {it.type === 'tv' ? <><TelevisionSimple size={11} /> Serie · estreno</> : <><FilmSlate size={11} /> Película</>}
                        </p>
                      </div>
                    </Link>
                    <ReminderButton item={it} variant="compact" />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </motion.main>
  )
}
