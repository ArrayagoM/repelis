import { useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import { Snowflake, Shuffle, ListPlus, UsersThree } from '@phosphor-icons/react'
import MovieRow from '../../components/MovieRow'
import Snow from '../../components/Snow'
import { fetchCategory } from '../../store/slices/moviesSlice'
import * as TMDB from '../../api/tmdb'
import { christmasCountdown } from '../../lib/seasons'
import { isOut } from '../../lib/releaseStatus'
import { useCurrentLanguageMode } from '../../lib/useLanguageFilter'
import { setLanguageMode, MODE_LABELS } from '../../lib/languageMode'
import { useSEO } from '../../lib/useSEO'
import { tt, isEnglish } from '../../lib/i18n'

// [clave en el store, pedido a TMDB, título, insignia, tipo, texto del atajo]
const ROWS = [
  ['xmasPopular',   TMDB.getChristmasPopular,   tt("Las más vistas de Navidad"),        tt("Populares"),  'movie', tt("Populares")],
  ['xmasRecent',    TMDB.getChristmasRecent,    tt("Lo último navideño"),               tt("Reciente"),   'movie', tt("Recientes")],
  ['xmasFamily',    TMDB.getChristmasFamily,    tt("Para ver en familia"),              tt("En familia"), 'movie', tt("Familia")],
  ['xmasComedy',    TMDB.getChristmasComedy,    tt("Para reírse en Navidad"),           tt("Comedia"),    'movie', tt("Comedia")],
  ['xmasAnimation', TMDB.getChristmasAnimation, tt("Animación navideña"),               tt("Animación"),  'movie', tt("Animación")],
  ['xmasRomance',   TMDB.getChristmasRomance,   tt("Romances de invierno"),             tt("Romance"),    'movie', tt("Romance")],
  ['xmasClassics',  TMDB.getChristmasClassics,  tt("Clásicos de todos los diciembres"), tt("Clásico"),    'movie', tt("Clásicos")],
  ['xmasSanta',     TMDB.getChristmasSanta,     tt("Papá Noel, renos y elfos"),         tt("Magia"),      'movie', tt("Papá Noel")],
  ['xmasEve',       TMDB.getChristmasEve,       tt("Nochebuena y Año Nuevo"),           tt("Fiestas"),    'movie', tt("Fiestas")],
  ['xmasAction',    TMDB.getChristmasAction,    tt("Navidad con acción"),               tt("Acción"),     'movie', tt("Acción")],
  ['xmasHorror',    TMDB.getChristmasHorror,    tt("Navidad siniestra"),                tt("Terror"),     'movie', tt("Terror")],
  ['xmasSeries',    TMDB.getChristmasSeries,    tt("Series navideñas"),                 tt("Series"),     'tv',    tt("Series")],
  ['xmasTop',       TMDB.getChristmasTop,       tt("Las mejor valoradas"),              'Top',            'movie', tt("Mejor valoradas")],
]

// Filas que no entran en "Sorprendeme" (para que la sorpresa sea apta para sentarse en familia)
const NOT_FOR_SURPRISE = new Set(['xmasHorror', 'xmasAction'])

export default function Navidad() {
  useEffect(() => { window.scrollTo(0, 0) }, [])
  useSEO({
    title: tt("Navidad · películas y series navideñas"),
    description: tt("Armá tu maratón navideño: clásicos de diciembre, comedias, animación, romances de invierno, películas para ver en familia y series de Navidad. Gratis."),
    keywords: tt("peliculas de navidad, peliculas navideñas, maraton navideño, peliculas de navidad online, series de navidad, peliculas para ver en familia"),
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
      if (type !== 'movie' || NOT_FOR_SURPRISE.has(key)) continue
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
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,0.25),transparent_55%)]" />
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(220,38,38,0.22),transparent_55%)]" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-void" />
        <Snow />
        <div className="relative max-w-7xl mx-auto">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-300/30 text-emerald-200 text-xs font-semibold uppercase tracking-widest">
            <Snowflake size={14} weight="fill" /> {christmasCountdown()}
          </span>
          <h1 className="font-display font-extrabold text-4xl sm:text-6xl text-chalk leading-[1.05] mt-4">
            {isEnglish()
              ? <><span className="text-red-500">Christmas</span> Marathon</>
              : <>{tt("Maratón de")} <span className="text-red-500">{tt("Navidad")}</span></>}
          </h1>
          <p className="text-muted mt-4 max-w-2xl leading-relaxed">
            {tt("Mantita, chocolate caliente y a elegir: los clásicos que se repiten cada diciembre, comedias para reírse en familia, animación para los chicos y romances de nieve. Si no sabés por dónde empezar, dejá que decida Papá Noel.")}
          </p>

          <div className="flex flex-wrap gap-3 mt-7">
            <button onClick={surprise} disabled={!pool.length}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-red-600 text-white font-bold text-sm hover:bg-red-500 transition-colors disabled:opacity-50 shadow-lg shadow-red-900/40">
              <Shuffle size={16} weight="bold" /> {tt("Sorprendeme con una")}
            </button>
            <Link to="/lista/nueva" state={{ tag: 'maraton', title: tt("Maratón navideño") }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full glass border border-emerald-300/25 text-chalk text-sm font-semibold hover:border-emerald-300/60 transition-colors">
              <ListPlus size={16} /> {tt("Armar mi maratón")}
            </Link>
            <Link to="/comunidad"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full glass border border-white/10 text-muted text-sm font-medium hover:text-chalk transition-colors">
              <UsersThree size={16} /> {tt("Ver maratones de la comunidad")}
            </Link>
          </div>

          {langMode !== 'all' && (
            <p className="mt-6 text-xs text-muted max-w-2xl">
              {tt("Ahora ves el modo")} <strong className="text-chalk/80">{MODE_LABELS[langMode]}</strong>{tt(", que deja afuera muchos clásicos y títulos en idioma original.")}{' '}
              <button onClick={() => setLanguageMode('all')} className="text-emerald-300 underline underline-offset-2 hover:text-emerald-200">{tt("Ver todo el catálogo navideño")}</button>
            </p>
          )}

          <nav aria-label={tt("Atajos")} className="flex flex-wrap gap-2 mt-8">
            {ROWS.map(([key, , , , , chip]) => (
              <button key={key} onClick={() => jump(key)}
                className="px-3.5 py-1.5 rounded-full border border-white/10 bg-white/[0.03] text-muted text-xs font-medium hover:text-emerald-300 hover:border-emerald-300/40 transition-colors">
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
              <MovieRow title={title} badge={badge} badgeColor="green" movies={cat.results} mediaType={type}
                loading={cat.loading && !cat.results.length} onlyReleased lenient />
            </div>
          )
        })}
        <p className="max-w-7xl mx-auto px-6 md:px-12 text-muted/60 text-xs">
          {tt("Datos provistos por TMDB. Las películas y series se eligen por palabras clave de Navidad.")}
        </p>
      </div>
    </motion.main>
  )
}
