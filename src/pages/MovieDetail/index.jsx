import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import {
  Play, Star, Clock, CalendarBlank,
  ArrowLeft, Globe, FilmSlate, Users,
} from '@phosphor-icons/react'
import { fetchMovieDetail, clearDetail } from '../../store/slices/moviesSlice'
import { openPlayer } from '../../store/slices/playerSlice'
import { IMG_ORIGINAL, IMG_W500 } from '../../api/tmdb'
import MovieRow from '../../components/MovieRow'
import PlayerPrefetch from '../../components/PlayerPrefetch'
import ShareButtons from '../../components/ShareButtons'
import CafecitoButton from '../../components/CafecitoButton'
import LanguagesInfo from '../../components/LanguagesInfo'
import DubInfo from '../../components/DubInfo'
import WatchProviders from '../../components/WatchProviders'
import { isUpcoming, daysUntilRelease } from '../../lib/releaseStatus'
import { useSEO, useMovieSchema } from '../../lib/useSEO'

export default function MovieDetail() {
  const { id }     = useParams()
  const dispatch   = useDispatch()
  const navigate   = useNavigate()
  const { data, credits, videos, similar, loading, error } = useSelector((s) => s.movies.detail)

  useEffect(() => {
    dispatch(fetchMovieDetail(id))
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return () => dispatch(clearDetail())
  }, [id, dispatch])

  // SEO dinámico — los hooks deben llamarse SIEMPRE en mismo orden
  useSEO(data ? {
    title: `Ver ${data.title} (${data.release_date?.slice(0, 4) || ''}) online`,
    description: data.overview?.slice(0, 160) || `${data.title} — Ficha completa, reparto, dónde verla online. Catálogo de Life High.`,
    image: data.poster_path ? `https://image.tmdb.org/t/p/w780${data.poster_path}` : null,
    type: 'video.movie',
    keywords: `${data.title}, ver ${data.title} online, ${data.title} español latino, ${data.title} pelicula completa`,
  } : { title: 'Cargando película' })
  useMovieSchema(data)

  if (loading) return <DetailSkeleton />
  if (error)   return <ErrorState error={error} onBack={() => navigate(-1)} />
  if (!data)   return null

  const backdropUrl = data.backdrop_path ? `${IMG_ORIGINAL}${data.backdrop_path}` : null
  const posterUrl   = data.poster_path   ? `${IMG_W500}${data.poster_path}`   : null

  const trailer = videos?.results?.find(
    (v) => v.type === 'Trailer' && v.site === 'YouTube'
  )
  const cast   = credits?.cast?.slice(0, 14) ?? []
  const genres = data.genres ?? []

  const runtime = data.runtime
    ? `${Math.floor(data.runtime / 60)}h ${data.runtime % 60}m`
    : null

  const rating = data.vote_average?.toFixed(1) ?? '–'
  const year   = data.release_date?.slice(0, 4) ?? ''
  const movieUpcoming = isUpcoming(data)
  const movieDaysLeft = daysUntilRelease(data)

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen bg-void"
    >
      {/* Calienta el top servidor mientras el usuario lee la sinopsis */}
      <PlayerPrefetch id={data.id} mediaType="movie" />

      {/* ── Backdrop hero ── */}
      <div className="relative w-full h-[55vh] sm:h-[65vh] overflow-hidden">
        {backdropUrl && (
          <img
            src={backdropUrl}
            alt=""
            className="w-full h-full object-cover object-top"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-void via-void/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-void via-void/40 to-void/50" />

        {/* Back button */}
        <motion.button
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          onClick={() => navigate(-1)}
          className="absolute top-24 left-6 md:left-12 flex items-center gap-2 text-chalk/70 hover:text-gold transition-colors duration-200 group"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform duration-200" />
          <span className="text-sm font-medium">Volver</span>
        </motion.button>
      </div>

      {/* ── Main content ── */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 -mt-48 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8 items-start">
          {/* ── Poster ── */}
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="hidden md:block"
          >
            <div className="rounded-2xl overflow-hidden border border-white/10 shadow-[0_24px_64px_rgba(0,0,0,0.8)]">
              {posterUrl
                ? <img src={posterUrl} alt={data.title} className="w-full" />
                : <div className="aspect-[2/3] bg-surface flex items-center justify-center"><FilmSlate size={48} className="text-dim" /></div>
              }
            </div>
          </motion.div>

          {/* ── Info ── */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6 pt-2 md:pt-8"
          >
            {/* Genres */}
            <div className="flex flex-wrap gap-2">
              {genres.map((g) => (
                <span key={g.id} className="px-3 py-1 rounded-full bg-surface border border-dim/50 text-muted text-xs font-medium">
                  {g.name}
                </span>
              ))}
            </div>

            {/* Title */}
            <h1 className="font-display font-extrabold text-3xl sm:text-4xl xl:text-5xl leading-tight tracking-tight text-chalk">
              {data.title}
            </h1>

            {/* Tagline */}
            {data.tagline && (
              <p className="text-gold/70 italic text-base">"{data.tagline}"</p>
            )}

            {/* Botón Cafecito justo debajo del título */}
            <div className="pt-1">
              <CafecitoButton />
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-gold">
                <Star size={16} weight="fill" />
                <span className="font-mono font-semibold text-lg">{rating}</span>
                <span className="text-muted text-xs">/ 10</span>
              </div>
              {year && (
                <div className="flex items-center gap-1.5 text-muted">
                  <CalendarBlank size={14} />
                  <span className="font-mono">{year}</span>
                </div>
              )}
              {runtime && (
                <div className="flex items-center gap-1.5 text-muted">
                  <Clock size={14} />
                  <span className="font-mono">{runtime}</span>
                </div>
              )}
            </div>

            {/* Idiomas disponibles */}
            <LanguagesInfo
              originalLanguage={data.original_language}
              spokenLanguages={data.spoken_languages}
            />

            {/* Doblaje LATAM real (basado en release_dates de TMDB) */}
            <DubInfo originalLanguage={data.original_language} />

            {/* Plataformas legales donde está la peli */}
            <WatchProviders id={data.id} mediaType="movie" title={data.title} />

            {/* Overview */}
            {data.overview && (
              <p className="text-chalk/80 text-base leading-relaxed max-w-[65ch]">
                {data.overview}
              </p>
            )}

            {/* Aviso si la peli aún no se estrenó */}
            {movieUpcoming && (
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-start gap-2.5 max-w-xl">
                <CalendarBlank size={16} weight="fill" className="text-blue-300 flex-shrink-0 mt-0.5" />
                <p className="text-blue-100/85 text-xs leading-relaxed">
                  <strong className="text-blue-200">Aún no disponible.</strong> Esta película se estrena
                  {movieDaysLeft != null ? ` en ${movieDaysLeft} día${movieDaysLeft !== 1 ? 's' : ''}` : ' próximamente'}.
                  Todavía no está en los servidores de streaming. Podés ver el tráiler mientras tanto.
                </p>
              </div>
            )}

            {/* CTA Buttons */}
            <div className="flex flex-wrap gap-3">
              <motion.button
                whileHover={{ scale: movieUpcoming ? 1 : 1.03 }}
                whileTap={{ scale: movieUpcoming ? 1 : 0.97 }}
                onClick={() => { if (!movieUpcoming) dispatch(openPlayer({ movieId: data.id, title: data.title })) }}
                disabled={movieUpcoming}
                className={`
                  group flex items-center gap-3 px-7 py-3.5 rounded-full font-bold text-sm transition-all duration-300
                  ${movieUpcoming
                    ? 'bg-white/5 border border-white/10 text-muted cursor-not-allowed'
                    : 'bg-gold hover:bg-gold-hi text-void shadow-[0_4px_24px_rgba(232,160,32,0.35)] hover:shadow-[0_4px_36px_rgba(232,160,32,0.55)]'}
                `}
              >
                <span className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform duration-300 ${movieUpcoming ? 'bg-white/5' : 'bg-void/20 group-hover:scale-110'}`}>
                  {movieUpcoming ? <CalendarBlank size={14} weight="fill" /> : <Play size={14} weight="fill" />}
                </span>
                {movieUpcoming ? 'Próximamente' : 'Reproducir ahora'}
              </motion.button>

              {trailer && (
                <a
                  href={`https://www.youtube.com/watch?v=${trailer.key}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="
                    flex items-center gap-2.5 px-6 py-3.5 rounded-full
                    glass border border-white/10 text-chalk font-medium text-sm
                    hover:border-gold/30 hover:text-gold
                    transition-all duration-300
                  "
                >
                  Ver trailer
                </a>
              )}

              <ShareButtons title={data.title} description={data.tagline || ''} />
            </div>
          </motion.div>
        </div>

        {/* ── Cast ── */}
        {cast.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mt-16"
          >
            <div className="flex items-center gap-3 mb-6">
              <Users size={20} className="text-gold" />
              <h2 className="font-display font-bold text-xl text-chalk">Reparto principal</h2>
            </div>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-3">
              {cast.map((person, i) => (
                <motion.div
                  key={person.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.04, duration: 0.4 }}
                  className="flex-shrink-0 w-28 text-center"
                >
                  <div className="w-20 h-20 mx-auto rounded-full overflow-hidden border-2 border-white/10 bg-surface">
                    {person.profile_path
                      ? <img
                          src={`${IMG_W500}${person.profile_path}`}
                          alt={person.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      : <div className="w-full h-full flex items-center justify-center">
                          <span className="text-2xl text-dim font-bold">
                            {person.name?.charAt(0) ?? '?'}
                          </span>
                        </div>
                    }
                  </div>
                  <p className="mt-2 text-xs text-chalk font-medium leading-tight truncate px-1">{person.name}</p>
                  <p className="text-[10px] text-muted truncate px-1">{person.character}</p>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* ── Similar Movies ── */}
        {similar.length > 0 && (
          <div className="mt-16">
            <MovieRow
              title="Películas similares"
              movies={similar}
            />
          </div>
        )}
      </div>
    </motion.main>
  )
}

function DetailSkeleton() {
  return (
    <div className="min-h-screen bg-void">
      <div className="skeleton w-full h-[55vh]" />
      <div className="max-w-7xl mx-auto px-6 md:px-12 -mt-48 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8">
          <div className="hidden md:block">
            <div className="skeleton aspect-[2/3] rounded-2xl" />
          </div>
          <div className="space-y-5 pt-8">
            <div className="flex gap-2">
              {[80, 96, 72].map((w, i) => (
                <div key={i} className={`skeleton h-6 rounded-full`} style={{ width: w }} />
              ))}
            </div>
            <div className="skeleton h-12 w-3/4 rounded-xl" />
            <div className="skeleton h-4 w-1/2 rounded" />
            <div className="space-y-2">
              <div className="skeleton h-4 w-full rounded" />
              <div className="skeleton h-4 w-5/6 rounded" />
              <div className="skeleton h-4 w-4/5 rounded" />
            </div>
            <div className="flex gap-3">
              <div className="skeleton h-12 w-44 rounded-full" />
              <div className="skeleton h-12 w-32 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ErrorState({ error, onBack }) {
  return (
    <div className="min-h-screen bg-void flex flex-col items-center justify-center gap-4 px-6">
      <FilmSlate size={48} className="text-dim" />
      <p className="text-chalk font-display text-xl">No se pudo cargar la película</p>
      <p className="text-muted text-sm font-mono">{error}</p>
      <button onClick={onBack} className="px-6 py-2.5 rounded-full bg-gold text-void font-semibold text-sm hover:bg-gold-hi transition-colors">
        Volver
      </button>
    </div>
  )
}
