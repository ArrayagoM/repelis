import { useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import { Ghost, Shuffle, ListPlus, UsersThree } from '@phosphor-icons/react'
import MovieRow from '../../components/MovieRow'
import { fetchCategory } from '../../store/slices/moviesSlice'
import * as TMDB from '../../api/tmdb'
import { halloweenCountdown } from '../../lib/seasons'
import { isOut } from '../../lib/releaseStatus'
import { useCurrentLanguageMode } from '../../lib/useLanguageFilter'
import { setLanguageMode, MODE_LABELS } from '../../lib/languageMode'
import { useSEO } from '../../lib/useSEO'

// [clave en el store, pedido a TMDB, título, insignia, tipo, texto del atajo]
const ROWS = [
  ['terrorRecent',   TMDB.getHorrorRecent,   'Lo último que da miedo',       'Reciente',   'movie', 'Recientes'],
  ['terrorPopular',  TMDB.getHorrorPopular,  'Las más vistas de terror',     'Populares',  'movie', 'Populares'],
  ['terrorSeries',   TMDB.getHorrorSeries,   'Series para no dormir',        'Series',     'tv',    'Series'],
  ['terrorGhosts',   TMDB.getHorrorGhosts,   'Fantasmas y casas embrujadas', 'Sobrenatural', 'movie', 'Fantasmas'],
  ['terrorDemons',   TMDB.getHorrorDemons,   'Demonios y posesiones',        'Exorcismo',  'movie', 'Posesiones'],
  ['terrorSlasher',  TMDB.getHorrorSlasher,  'Slashers',                      'Clásico',    'movie', 'Slashers'],
  ['terrorPsych',    TMDB.getHorrorPsych,    'Terror psicológico',            'Mente',      'movie', 'Psicológico'],
  ['terrorFound',    TMDB.getHorrorFound,    'Found footage',                 'Cámara en mano', 'movie', 'Found footage'],
  ['terrorWitches',  TMDB.getHorrorWitches,  'Brujas y aquelarres',           'Brujería',   'movie', 'Brujas'],
  ['terrorZombies',  TMDB.getHorrorZombies,  'Zombies',                       'Muertos vivos', 'movie', 'Zombies'],
  ['terrorVampires', TMDB.getHorrorVampires, 'Vampiros',                      'Noche',      'movie', 'Vampiros'],
  ['terrorComedy',   TMDB.getHorrorComedy,   'Para reírse del miedo',         'Terror + comedia', 'movie', 'Con humor'],
  ['terrorClassics', TMDB.getHorrorClassics, 'Clásicos que no envejecen',     'Leyendas',   'movie', 'Clásicos'],
  ['terrorTop',      TMDB.getHorrorTop,      'Las mejor valoradas',           'Top',        'movie', 'Mejor valoradas'],
]

export default function Terror() {
  useEffect(() => { window.scrollTo(0, 0) }, [])
  useSEO({
    title: 'Sesión de terror · películas y series para Halloween',
    description: 'Armá tu maratón de Halloween: lo último y lo mejor del terror, fantasmas, slashers, posesiones, zombies y series para no dormir. Gratis.',
    keywords: 'peliculas de terror, halloween, maraton de terror, peliculas de miedo online, series de terror, slashers, peliculas de fantasmas',
  })
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const byCategory = useSelector((s) => s.movies.byCategory)
  const langMode = useCurrentLanguageMode()

  useEffect(() => {
    ROWS.forEach(([key, fetcher]) => { if (!byCategory[key]?.results?.length && !byCategory[key]?.loading) dispatch(fetchCategory({ key, fetcher, page: 1 })) })
  }, [dispatch]) // eslint-disable-line react-hooks/exhaustive-deps

  const pool = useMemo(() => {
    const seen = new Set()
    const out = []
    for (const [key, , , , type] of ROWS) {
      if (type !== 'movie') continue
      for (const m of byCategory[key]?.results || []) {
        if (!m?.id || seen.has(m.id) || !isOut(m)) continue
        seen.add(m.id); out.push(m)
      }
    }
    return out
  }, [byCategory])

  const surprise = () => {
    if (!pool.length) return
    navigate(`/movie/${pool[Math.floor(Math.random() * pool.length)].id}`)
  }
  const jump = (key) => document.getElementById(key)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-void">
      <header className="relative overflow-hidden pt-28 pb-12 px-6 md:px-12">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(220,38,38,0.28),transparent_60%)]" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-void" />
        <div className="relative max-w-7xl mx-auto">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/15 border border-red-400/30 text-red-300 text-xs font-semibold uppercase tracking-widest">
            <Ghost size={14} weight="fill" /> {halloweenCountdown()}
          </span>
          <h1 className="font-display font-extrabold text-4xl sm:text-6xl text-chalk leading-[1.05] mt-4">
            Sesión de <span className="text-red-500">terror</span>
          </h1>
          <p className="text-muted mt-4 max-w-2xl leading-relaxed">
            Apagá la luz, subí el volumen y elegí tu noche: lo último que da miedo, los clásicos que no envejecen y series para no dormir.
            Si no sabés por dónde empezar, dejá que decida el destino.
          </p>

          <div className="flex flex-wrap gap-3 mt-7">
            <button onClick={surprise} disabled={!pool.length}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-red-600 text-white font-bold text-sm hover:bg-red-500 transition-colors disabled:opacity-50 shadow-lg shadow-red-900/40">
              <Shuffle size={16} weight="bold" /> Sorprendeme con una
            </button>
            <Link to="/lista/nueva" state={{ tag: 'maraton', title: 'Maratón de terror' }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full glass border border-red-400/25 text-chalk text-sm font-semibold hover:border-red-400/60 transition-colors">
              <ListPlus size={16} /> Armar mi maratón
            </Link>
            <Link to="/comunidad"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full glass border border-white/10 text-muted text-sm font-medium hover:text-chalk transition-colors">
              <UsersThree size={16} /> Ver maratones de la comunidad
            </Link>
          </div>

          {langMode !== 'all' && (
            <p className="mt-6 text-xs text-muted max-w-2xl">
              Ahora ves el modo <strong className="text-chalk/80">{MODE_LABELS[langMode]}</strong>, que deja afuera muchos clásicos y títulos en idioma original.{' '}
              <button onClick={() => setLanguageMode('all')} className="text-red-300 underline underline-offset-2 hover:text-red-200">Ver todo el catálogo de terror</button>
            </p>
          )}

          <nav aria-label="Atajos" className="flex flex-wrap gap-2 mt-8">
            {ROWS.map(([key, , , , , chip]) => (
              <button key={key} onClick={() => jump(key)}
                className="px-3.5 py-1.5 rounded-full border border-white/10 bg-white/[0.03] text-muted text-xs font-medium hover:text-red-300 hover:border-red-400/40 transition-colors">
                {chip}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="relative z-10 space-y-12 pb-24">
        {ROWS.map(([key, , title, badge, type]) => {
          const cat = byCategory[key] || { results: [], loading: true }
          return (
            <div key={key} id={key} className="scroll-mt-24">
              <MovieRow title={title} badge={badge} badgeColor="red" movies={cat.results} mediaType={type}
                loading={cat.loading && !cat.results.length} onlyReleased />
            </div>
          )
        })}
        <p className="max-w-7xl mx-auto px-6 md:px-12 text-muted/60 text-xs">
          Datos provistos por TMDB. Las series se eligen por palabras clave de terror (TMDB no tiene un género de terror para TV).
        </p>
      </div>
    </motion.main>
  )
}
