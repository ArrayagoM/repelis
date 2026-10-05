import { useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Hero     from '../../components/Hero'
import MovieRow from '../../components/MovieRow'
import Top10Row from '../../components/Top10Row'
import {
  fetchTrending, fetchPopular, fetchTopRated, fetchNowPlaying, fetchUpcoming, fetchClassics, fetchAnimeMovies,
  fetchTrendingTV, fetchPopularTV, fetchTopRatedTV, fetchAiringTodayTV, fetchAnime, fetchKDrama,
} from '../../store/slices/moviesSlice'
import { fetchCategory } from '../../store/slices/moviesSlice'
import * as TMDB from '../../api/tmdb'
import { fetchGenres } from '../../store/slices/genresSlice'
import { getDeviceCaps } from '../../lib/deviceCaps'
import { isOut } from '../../lib/releaseStatus'
import { useSEO, useOrgSchema } from '../../lib/useSEO'

const _LOW_END = typeof window !== 'undefined' && getDeviceCaps().lowEnd

export default function Home() {
  const dispatch = useDispatch()
  const navigate = useNavigate()

  useSEO({
    title: null, // usa el título base "Life High — Cinema sin límites"
    description: 'Life High: el catálogo más completo de películas, series, anime y K-drama. Encontrá dónde ver cualquier estreno en LATAM. Sin engaños, sin paywalls falsos.',
    keywords: 'life high, ver peliculas online, series online, anime, kdrama, estrenos 2026, peliculas latino, streaming Argentina',
  })
  useOrgSchema()

  const {
    trending, popular, topRated, nowPlaying, upcoming, classics, animeMovies,
    trendingTV, popularTV, topRatedTV, airingTodayTV, anime, kdrama,
  } = useSelector((s) => s.movies)
  const byCategory = useSelector((s) => s.movies.byCategory)
  const upcomingTV = byCategory.upcomingTV || { results: [], loading: false }
  // Próximos estrenos: los que salen antes, primero (el estreno más cercano arriba)
  const byDate = (a, b) => (a.release_date || a.first_air_date || '9999').localeCompare(b.release_date || b.first_air_date || '9999')
  const upcomingSorted   = useMemo(() => [...upcoming.results].sort(byDate), [upcoming.results])
  const upcomingTVSorted = useMemo(() => [...upcomingTV.results].sort(byDate), [upcomingTV.results])
  // El banner principal solo muestra títulos que ya se estrenaron
  const heroMovies = useMemo(() => trending.results.filter(isOut), [trending.results])
  const top10Movies = byCategory.top10Movies || { results: [], loading: false }
  const top10TV     = byCategory.top10TV     || { results: [], loading: false }
  const bestTV      = byCategory.bestTV      || { results: [], loading: false }
  const gems        = byCategory.hiddenGems  || { results: [], loading: false }
  const family      = byCategory.family      || { results: [], loading: false }

  useEffect(() => {
    // En low-end pedimos SOLO lo esencial (4 endpoints vs 13).
    // Cada endpoint = 20 películas con 20 pósters más en RAM.
    if (_LOW_END) {
      if (!trending.results.length)   dispatch(fetchTrending())
      if (!popular.results.length)    dispatch(fetchPopular())
      if (!popularTV.results.length)  dispatch(fetchPopularTV())
      if (!anime.results.length)      dispatch(fetchAnime())
      dispatch(fetchGenres())
      return
    }
    // Top 10 + recomendadas (2 páginas del Top: tras el filtro de idioma siguen quedando 10)
    dispatch(fetchCategory({ key: 'top10Movies', fetcher: TMDB.getTrendingDay, page: 1 }))
      .then(() => dispatch(fetchCategory({ key: 'top10Movies', fetcher: TMDB.getTrendingDay, page: 2 })))
    dispatch(fetchCategory({ key: 'top10TV', fetcher: TMDB.getTrendingTVDay, page: 1 }))
      .then(() => dispatch(fetchCategory({ key: 'top10TV', fetcher: TMDB.getTrendingTVDay, page: 2 })))
    dispatch(fetchCategory({ key: 'upcomingTV', fetcher: TMDB.getUpcomingTV, page: 1 }))
    dispatch(fetchCategory({ key: 'bestTV', fetcher: TMDB.getMostRecommendedTV, page: 1 }))
    dispatch(fetchCategory({ key: 'hiddenGems', fetcher: TMDB.getHiddenGems, page: 1 }))
    dispatch(fetchCategory({ key: 'family', fetcher: TMDB.getKidsMovies, page: 1 }))
    // Películas
    if (!trending.results.length)    dispatch(fetchTrending())
    if (!popular.results.length)     dispatch(fetchPopular())
    if (!topRated.results.length)    dispatch(fetchTopRated())
    if (!nowPlaying.results.length)  dispatch(fetchNowPlaying())
    if (!upcoming.results.length)    dispatch(fetchUpcoming())
    if (!classics.results.length)    dispatch(fetchClassics())
    if (!animeMovies.results.length) dispatch(fetchAnimeMovies())
    // Series
    if (!trendingTV.results.length)    dispatch(fetchTrendingTV())
    if (!popularTV.results.length)     dispatch(fetchPopularTV())
    if (!topRatedTV.results.length)    dispatch(fetchTopRatedTV())
    if (!airingTodayTV.results.length) dispatch(fetchAiringTodayTV())
    if (!anime.results.length)         dispatch(fetchAnime())
    if (!kdrama.results.length)        dispatch(fetchKDrama())
    dispatch(fetchGenres())
  }, [dispatch])

  // ─── Render low-end: SOLO 4 filas, sin dividers ni footer interno ───
  if (_LOW_END) {
    return (
      <main className="min-h-screen bg-void">
        <Hero movies={heroMovies} />
        <div className="relative z-10 -mt-4 space-y-8 pb-12">
          <MovieRow title="Tendencias" movies={trending.results}
            loading={trending.loading && !trending.results.length} />
          <MovieRow title="Películas Populares" movies={popular.results}
            loading={popular.loading && !popular.results.length}
            onViewAll={() => navigate('/populares')} />
          <MovieRow title="Series Populares" movies={popularTV.results}
            loading={popularTV.loading && !popularTV.results.length}
            mediaType="tv" onViewAll={() => navigate('/series')} />
          <MovieRow title="Anime" movies={anime.results}
            loading={anime.loading && !anime.results.length}
            mediaType="tv" onViewAll={() => navigate('/anime')} />
        </div>
      </main>
    )
  }

  return (
    <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }} className="min-h-screen bg-void">

      <Hero movies={heroMovies} />

      <div className="relative z-10 -mt-4 space-y-12 pb-24">
        <div className="mx-auto max-w-7xl px-6 md:px-12">
          <div className="h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
        </div>

        {/* ── TOP 10 ── */}
        <Top10Row title="Top 10 películas hoy" badge="Hoy" movies={top10Movies.results}
          loading={top10Movies.loading && !top10Movies.results.length} mediaType="movie" />

        {/* ── PELÍCULAS ── */}
        <MovieRow title="En Cartelera" badge="Ahora" movies={nowPlaying.results}
          loading={nowPlaying.loading && !nowPlaying.results.length} onViewAll={() => navigate('/estrenos')} />

        <MovieRow title="Tendencias" badge="Esta semana" onlyReleased movies={trending.results}
          loading={trending.loading && !trending.results.length} />

        <MovieRow title="Más Populares" onlyReleased movies={popular.results}
          loading={popular.loading && !popular.results.length} onViewAll={() => navigate('/populares')} />

        <MovieRow title="Mejor Valoradas" badge="Top" movies={topRated.results}
          loading={topRated.loading && !topRated.results.length} onViewAll={() => navigate('/top-valoradas')} />

        <MovieRow title="Próximos Estrenos" badge="Muy pronto" movies={upcomingSorted}
          loading={upcoming.loading && !upcoming.results.length} onViewAll={() => navigate('/proximos')} />

        {/* ── Divider TV ── */}
        <div className="mx-auto max-w-7xl px-6 md:px-12">
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
            <span className="text-blue-400/60 text-xs font-mono uppercase tracking-widest">Series & TV</span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
          </div>
        </div>

        {/* ── SERIES ── */}
        <Top10Row title="Top 10 series hoy" badge="Hoy" badgeColor="blue" movies={top10TV.results}
          loading={top10TV.loading && !top10TV.results.length} mediaType="tv" />

        <MovieRow title="Series que se vienen" badge="Próximamente" badgeColor="blue" movies={upcomingTVSorted}
          loading={upcomingTV.loading && !upcomingTV.results.length} mediaType="tv" onViewAll={() => navigate('/series-proximas')} />

        <MovieRow title="Series en Tendencia" badge="TV" badgeColor="blue" onlyReleased
          movies={trendingTV.results} loading={trendingTV.loading && !trendingTV.results.length}
          mediaType="tv" onViewAll={() => navigate('/series')} />

        <MovieRow title="Series Populares" onlyReleased movies={popularTV.results}
          loading={popularTV.loading && !popularTV.results.length}
          mediaType="tv" />

        <MovieRow title="Al Aire Ahora" badge="En vivo" badgeColor="blue"
          movies={airingTodayTV.results} loading={airingTodayTV.loading && !airingTodayTV.results.length}
          mediaType="tv" />

        <MovieRow title="Series más recomendables" badge="Imperdibles" badgeColor="blue"
          movies={bestTV.results} loading={bestTV.loading && !bestTV.results.length}
          mediaType="tv" />

        <MovieRow title="Mejor Valoradas — Series" badge="Top" badgeColor="blue"
          movies={topRatedTV.results} loading={topRatedTV.loading && !topRatedTV.results.length}
          mediaType="tv" />

        {/* ── Divider Anime ── */}
        <div className="mx-auto max-w-7xl px-6 md:px-12">
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />
            <span className="text-purple-400/60 text-xs font-mono uppercase tracking-widest">Anime</span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />
          </div>
        </div>

        {/* ── ANIME ── */}
        <MovieRow title="Anime — Series" badge="Anime" badgeColor="purple"
          movies={anime.results} loading={anime.loading && !anime.results.length}
          mediaType="tv" onViewAll={() => navigate('/anime')} />

        <MovieRow title="Anime — Películas" badgeColor="purple"
          movies={animeMovies.results} loading={animeMovies.loading && !animeMovies.results.length}
          mediaType="movie" />

        <MovieRow title="K-Drama" badge="Korea" badgeColor="red"
          movies={kdrama.results} loading={kdrama.loading && !kdrama.results.length}
          mediaType="tv" />

        {/* ── Divider Clásicos ── */}
        <div className="mx-auto max-w-7xl px-6 md:px-12">
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/15 to-transparent" />
            <span className="text-gold/40 text-xs font-mono uppercase tracking-widest">Clásicos</span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/15 to-transparent" />
          </div>
        </div>

        <MovieRow title="Joyas ocultas" badge="Poco conocidas"
          movies={gems.results} loading={gems.loading && !gems.results.length} />

        <MovieRow title="Para ver en familia" badge="Todos"
          movies={family.results} loading={family.loading && !family.results.length} />

        <MovieRow title="Clásicos del Cine" badge="Leyendas"
          movies={classics.results} loading={classics.loading && !classics.results.length} />

        {/* Footer */}
        <footer className="max-w-7xl mx-auto px-6 md:px-12 pt-8 border-t border-white/5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-muted text-sm">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-gold flex items-center justify-center">
                <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
                  <polygon points="3,2 10,6 3,10" fill="#08080E" />
                </svg>
              </div>
              <span className="font-display font-semibold text-chalk/80">Repe<span className="text-gold">lis</span></span>
            </div>
            <span className="font-mono text-xs">Datos provistos por <span className="text-gold">TheMovieDB</span></span>
            <span className="text-xs">© {new Date().getFullYear()} Repelis</span>
          </div>
        </footer>
      </div>
    </motion.main>
  )
}
