import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import { ArrowLeft } from '@phosphor-icons/react'
import {
  fetchPopular, fetchTopRated, fetchNowPlaying, fetchUpcoming, fetchTrending, fetchClassics, fetchAnimeMovies,
  fetchTrendingTV, fetchPopularTV, fetchTopRatedTV, fetchAiringTodayTV, fetchOnTheAirTV,
  fetchAnime, fetchKDrama,
} from '../../store/slices/moviesSlice'
import MovieCard, { MovieCardSkeleton } from '../../components/MovieCard'

const CATALOG_CONFIG = {
  // ── Movies ──────────────────────────────────────────────────────────────
  populares: {
    title:     'Más Populares',
    badge:     'Popular',
    badgeColor:'gold',
    selector:  (s) => s.movies.popular,
    fetchFn:   fetchPopular,
    mediaType: 'movie',
  },
  'top-valoradas': {
    title:     'Top Valoradas',
    badge:     'Top IMDb',
    badgeColor:'gold',
    selector:  (s) => s.movies.topRated,
    fetchFn:   fetchTopRated,
    mediaType: 'movie',
  },
  estrenos: {
    title:     'En Cartelera',
    badge:     'Ahora',
    badgeColor:'green',
    selector:  (s) => s.movies.nowPlaying,
    fetchFn:   fetchNowPlaying,
    mediaType: 'movie',
  },
  proximos: {
    title:     'Próximos Estrenos',
    badge:     'Próximamente',
    badgeColor:'blue',
    selector:  (s) => s.movies.upcoming,
    fetchFn:   fetchUpcoming,
    mediaType: 'movie',
  },
  tendencias: {
    title:     'Tendencias',
    badge:     'Trending',
    badgeColor:'red',
    selector:  (s) => s.movies.trending,
    fetchFn:   fetchTrending,
    mediaType: 'movie',
  },
  clasicos: {
    title:     'Clásicos del Cine',
    badge:     'Clásico',
    badgeColor:'amber',
    selector:  (s) => s.movies.classics,
    fetchFn:   fetchClassics,
    mediaType: 'movie',
  },
  // ── Series / TV ─────────────────────────────────────────────────────────
  series: {
    title:     'Series Populares',
    badge:     'Series',
    badgeColor:'blue',
    selector:  (s) => s.movies.popularTV,
    fetchFn:   fetchPopularTV,
    mediaType: 'tv',
  },
  'series-trending': {
    title:     'Series en Tendencia',
    badge:     'Trending',
    badgeColor:'red',
    selector:  (s) => s.movies.trendingTV,
    fetchFn:   fetchTrendingTV,
    mediaType: 'tv',
  },
  'series-top': {
    title:     'Series Mejor Valoradas',
    badge:     'Top Series',
    badgeColor:'gold',
    selector:  (s) => s.movies.topRatedTV,
    fetchFn:   fetchTopRatedTV,
    mediaType: 'tv',
  },
  'en-emision': {
    title:     'En Emisión Hoy',
    badge:     'En Vivo',
    badgeColor:'green',
    selector:  (s) => s.movies.airingTodayTV,
    fetchFn:   fetchAiringTodayTV,
    mediaType: 'tv',
  },
  'en-antena': {
    title:     'En Antena',
    badge:     'En Antena',
    badgeColor:'blue',
    selector:  (s) => s.movies.onTheAirTV,
    fetchFn:   fetchOnTheAirTV,
    mediaType: 'tv',
  },
  // ── Anime ────────────────────────────────────────────────────────────────
  anime: {
    title:     'Anime',
    badge:     'Anime',
    badgeColor:'purple',
    selector:  (s) => s.movies.anime,
    fetchFn:   fetchAnime,
    mediaType: 'tv',
  },
  'anime-peliculas': {
    title:     'Películas de Anime',
    badge:     'Anime Film',
    badgeColor:'purple',
    selector:  (s) => s.movies.animeMovies,
    fetchFn:   fetchAnimeMovies,
    mediaType: 'movie',
  },
  // ── K-Drama ──────────────────────────────────────────────────────────────
  kdrama: {
    title:     'K-Dramas',
    badge:     'K-Drama',
    badgeColor:'pink',
    selector:  (s) => s.movies.kdrama,
    fetchFn:   fetchKDrama,
    mediaType: 'tv',
  },
}

const BADGE_COLORS = {
  gold:   'bg-gold/10 border-gold/20 text-gold',
  green:  'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  blue:   'bg-sky-500/10 border-sky-500/20 text-sky-400',
  red:    'bg-rose-500/10 border-rose-500/20 text-rose-400',
  amber:  'bg-amber-500/10 border-amber-500/20 text-amber-400',
  purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
  pink:   'bg-pink-500/10 border-pink-500/20 text-pink-400',
}

export default function Catalog({ type }) {
  const config   = CATALOG_CONFIG[type] ?? CATALOG_CONFIG.populares
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const data     = useSelector(config.selector)

  useEffect(() => {
    if (!data.results.length) dispatch(config.fetchFn(1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [type])

  const loadMore = () => {
    if (data.page < data.totalPages) {
      dispatch(config.fetchFn(data.page + 1))
    }
  }

  const badgeClass = BADGE_COLORS[config.badgeColor] || BADGE_COLORS.gold

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen bg-void pt-28 pb-24"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12">

        {/* ── Header ── */}
        <div className="flex items-center gap-4 mb-10">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full glass border border-white/10 flex items-center justify-center text-muted hover:text-gold hover:border-gold/30 transition-all duration-200"
            aria-label="Volver"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <span className={`inline-block px-2.5 py-0.5 rounded-full border text-[10px] uppercase tracking-widest font-semibold ${badgeClass}`}>
              {config.badge}
            </span>
            <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-chalk tracking-tight mt-1">
              {config.title}
            </h1>
            {data.totalPages > 0 && (
              <p className="text-muted text-sm mt-1">
                Página {data.page} de {data.totalPages}
              </p>
            )}
          </div>
        </div>

        {/* ── Grid ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {data.results.map((item, i) => (
            <MovieCard
              key={`${item.id}-${i}`}
              movie={item}
              index={i % 12}
              mediaType={config.mediaType}
            />
          ))}
          {data.loading && !data.results.length &&
            Array.from({ length: 18 }).map((_, i) => <MovieCardSkeleton key={i} />)
          }
        </div>

        {/* Loading overlay for pagination */}
        {data.loading && data.results.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 mt-5">
            {Array.from({ length: 6 }).map((_, i) => <MovieCardSkeleton key={`more-${i}`} />)}
          </div>
        )}

        {/* ── Load more ── */}
        {data.results.length > 0 && data.page < data.totalPages && (
          <div className="flex justify-center mt-12">
            <button
              onClick={loadMore}
              disabled={data.loading}
              className="px-8 py-3 rounded-full glass border border-white/10 text-chalk font-medium hover:border-gold/30 hover:text-gold transition-all duration-200 disabled:opacity-50"
            >
              {data.loading ? 'Cargando…' : 'Cargar más'}
            </button>
          </div>
        )}

        {/* Empty state */}
        {!data.loading && data.results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <p className="text-chalk font-display font-semibold text-xl">Cargando contenido…</p>
            <p className="text-muted text-sm">Esto puede tomar unos segundos</p>
          </div>
        )}
      </div>
    </motion.main>
  )
}
