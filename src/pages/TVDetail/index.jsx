import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play, Star, Clock, CalendarBlank, ArrowLeft,
  Globe, FilmSlate, Users, TelevisionSimple,
} from '@phosphor-icons/react'
import { fetchTVDetail, fetchTVSeason } from '../../store/slices/moviesSlice'
import { openPlayer } from '../../store/slices/playerSlice'
import { IMG_ORIGINAL, IMG_W500 } from '../../api/tmdb'
import MovieRow from '../../components/MovieRow'
import PlayerPrefetch from '../../components/PlayerPrefetch'
import ShareButtons from '../../components/ShareButtons'
import CafecitoButton from '../../components/CafecitoButton'
import LanguagesInfo from '../../components/LanguagesInfo'
import { useSEO, useTVSchema } from '../../lib/useSEO'

export default function TVDetail() {
  const { id }     = useParams()
  const dispatch   = useDispatch()
  const navigate   = useNavigate()
  const { data, credits, videos, similar, loading, error, mediaType } = useSelector((s) => s.movies.detail)
  const seasons = useSelector((s) => s.movies.seasons)

  const [selectedSeason,  setSelectedSeason]  = useState(1)
  const [selectedEpisode, setSelectedEpisode] = useState(null)

  useEffect(() => {
    dispatch(fetchTVDetail(id))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [id, dispatch])

  // Cargar temporada 1 por defecto cuando carga el show
  useEffect(() => {
    if (data && mediaType === 'tv') {
      dispatch(fetchTVSeason({ id, season: selectedSeason }))
    }
  }, [data, id, selectedSeason, dispatch])

  const handleSeasonChange = (s) => {
    setSelectedSeason(s)
    setSelectedEpisode(null)
  }

  const handlePlayEpisode = (episode) => {
    dispatch(openPlayer({
      movieId:      Number(id),
      title:        `${data.name} — T${selectedSeason} E${episode.episode_number}: ${episode.name}`,
      mediaType:    'tv',
      season:       selectedSeason,
      episode:      episode.episode_number,
      totalSeasons: data.number_of_seasons || 1,
    }))
  }

  const handlePlayShow = () => {
    dispatch(openPlayer({
      movieId:      Number(id),
      title:        data.name,
      mediaType:    'tv',
      season:       1,
      episode:      1,
      totalSeasons: data.number_of_seasons || 1,
    }))
  }

  // SEO dinámico
  useSEO(data ? {
    title: `Ver ${data.name} (${data.first_air_date?.slice(0, 4) || ''}) online`,
    description: data.overview?.slice(0, 160) || `${data.name} — Serie completa: temporadas, episodios, reparto. Catálogo de Life High.`,
    image: data.poster_path ? `https://image.tmdb.org/t/p/w780${data.poster_path}` : null,
    type: 'video.tv_show',
    keywords: `${data.name}, ver ${data.name} online, ${data.name} serie completa, ${data.name} español latino`,
  } : { title: 'Cargando serie' })
  useTVSchema(data)

  if (loading || (!data && !error)) return <DetailSkeleton />
  if (error)  return <ErrorState error={error} onBack={() => navigate(-1)} />
  if (!data || mediaType !== 'tv') return null

  const backdropUrl = data.backdrop_path ? `${IMG_ORIGINAL}${data.backdrop_path}` : null
  const posterUrl   = data.poster_path   ? `${IMG_W500}${data.poster_path}`   : null
  const trailer     = videos?.results?.find((v) => v.type === 'Trailer' && v.site === 'YouTube')
  const cast        = credits?.cast?.slice(0, 14) ?? []
  const genres      = data.genres ?? []
  const rating      = data.vote_average?.toFixed(1) ?? '–'
  const year        = data.first_air_date?.slice(0, 4) ?? ''
  const totalSeasons = data.number_of_seasons || 1
  const seasonKey   = `${id}_${selectedSeason}`
  const seasonData  = seasons[seasonKey]
  const episodes    = seasonData?.episodes ?? []

  return (
    <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }} className="min-h-screen bg-void">

      {/* Calienta el top servidor con T1E1 (lo más probable de reproducir primero) */}
      <PlayerPrefetch id={Number(id)} mediaType="tv" season={selectedSeason} episode={selectedEpisode || 1} />

      {/* Hero backdrop */}
      <div className="relative w-full h-[55vh] sm:h-[65vh] overflow-hidden">
        {backdropUrl && <img src={backdropUrl} alt="" className="w-full h-full object-cover object-top" />}
        <div className="absolute inset-0 bg-gradient-to-r from-void via-void/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-void via-void/40 to-void/50" />
        <motion.button initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
          onClick={() => navigate(-1)}
          className="absolute top-24 left-6 md:left-12 flex items-center gap-2 text-chalk/70 hover:text-gold transition-colors group">
          <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-sm font-medium">Volver</span>
        </motion.button>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 -mt-48 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8 items-start">

          {/* Poster */}
          <motion.div initial={{ opacity: 0, y: 32, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="hidden md:block">
            <div className="rounded-2xl overflow-hidden border border-white/10 shadow-[0_24px_64px_rgba(0,0,0,0.8)]">
              {posterUrl
                ? <img src={posterUrl} alt={data.name} className="w-full" />
                : <div className="aspect-[2/3] bg-surface flex items-center justify-center"><FilmSlate size={48} className="text-dim" /></div>
              }
            </div>
          </motion.div>

          {/* Info */}
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }} className="space-y-6 pt-2 md:pt-8">

            {/* Genres */}
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-medium flex items-center gap-1.5">
                <TelevisionSimple size={11} weight="fill" />
                Serie
              </span>
              {genres.map((g) => (
                <span key={g.id} className="px-3 py-1 rounded-full bg-surface border border-dim/50 text-muted text-xs font-medium">
                  {g.name}
                </span>
              ))}
            </div>

            {/* Title */}
            <h1 className="font-display font-extrabold text-3xl sm:text-4xl xl:text-5xl leading-tight tracking-tight text-chalk">
              {data.name}
            </h1>

            {data.tagline && <p className="text-gold/70 italic text-base">"{data.tagline}"</p>}

            {/* Botón Cafecito justo debajo del título */}
            <div className="pt-1">
              <CafecitoButton />
            </div>

            {/* Meta */}
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
              {data.number_of_seasons && (
                <div className="flex items-center gap-1.5 text-muted">
                  <TelevisionSimple size={14} />
                  <span className="font-mono">{data.number_of_seasons} temp.</span>
                </div>
              )}
              {data.number_of_episodes && (
                <div className="flex items-center gap-1.5 text-muted">
                  <Clock size={14} />
                  <span className="font-mono">{data.number_of_episodes} eps.</span>
                </div>
              )}
            </div>

            {/* Idiomas disponibles */}
            <LanguagesInfo
              originalLanguage={data.original_language}
              spokenLanguages={data.spoken_languages}
            />

            {data.overview && (
              <p className="text-chalk/80 text-base leading-relaxed max-w-[65ch]">{data.overview}</p>
            )}

            {/* CTAs */}
            <div className="flex flex-wrap gap-3">
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={handlePlayShow}
                className="group flex items-center gap-3 px-7 py-3.5 rounded-full bg-gold hover:bg-gold-hi text-void font-bold text-sm shadow-[0_4px_24px_rgba(232,160,32,0.35)] transition-all duration-300">
                <span className="w-7 h-7 rounded-full bg-void/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Play size={14} weight="fill" />
                </span>
                Reproducir desde T1E1
              </motion.button>
              {trailer && (
                <a href={`https://www.youtube.com/watch?v=${trailer.key}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-6 py-3.5 rounded-full glass border border-white/10 text-chalk font-medium text-sm hover:border-gold/30 hover:text-gold transition-all duration-300">
                  Ver trailer
                </a>
              )}

              <ShareButtons title={data.name} description={data.tagline || ''} />
            </div>
          </motion.div>
        </div>

        {/* ── Episodios ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          transition={{ duration: 0.5 }} className="mt-16">

          {/* Header temporadas */}
          <div className="flex items-center gap-4 mb-6 flex-wrap">
            <h2 className="font-display font-bold text-xl text-chalk">Episodios</h2>
            <div className="flex gap-2 flex-wrap">
              {Array.from({ length: totalSeasons }, (_, i) => i + 1).map((s) => (
                <button key={s} onClick={() => handleSeasonChange(s)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                    selectedSeason === s
                      ? 'bg-gold text-void'
                      : 'glass border border-white/10 text-muted hover:text-chalk hover:border-gold/30'
                  }`}>
                  Temporada {s}
                </button>
              ))}
            </div>
          </div>

          {/* Lista de episodios */}
          {seasonData?.loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton h-24 rounded-xl" />
              ))}
            </div>
          ) : episodes.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {episodes.map((ep, i) => (
                <motion.div key={ep.id}
                  initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ delay: i * 0.03, duration: 0.35 }}
                  onClick={() => handlePlayEpisode(ep)}
                  className="group flex gap-3 p-3 rounded-xl glass border border-white/[0.06] hover:border-gold/25 hover:bg-white/[0.04] cursor-pointer transition-all duration-200"
                >
                  {/* Thumb */}
                  <div className="relative flex-shrink-0 w-28 aspect-video rounded-lg overflow-hidden bg-surface">
                    {ep.still_path
                      ? <img src={`${IMG_W500}${ep.still_path}`} alt={ep.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                      : <div className="w-full h-full flex items-center justify-center"><TelevisionSimple size={20} className="text-dim" /></div>
                    }
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-void/40">
                      <div className="w-8 h-8 rounded-full bg-gold flex items-center justify-center">
                        <Play size={12} weight="fill" className="text-void ml-0.5" />
                      </div>
                    </div>
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0 py-0.5">
                    <p className="text-[11px] font-mono text-muted/60 mb-0.5">
                      E{ep.episode_number}
                    </p>
                    <p className="text-sm font-semibold text-chalk group-hover:text-gold transition-colors line-clamp-2 leading-tight">
                      {ep.name}
                    </p>
                    {ep.runtime && (
                      <p className="text-[11px] text-muted/50 font-mono mt-1">{ep.runtime} min</p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-muted text-sm">No hay episodios disponibles para esta temporada.</p>
          )}
        </motion.section>

        {/* Cast */}
        {cast.length > 0 && (
          <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ duration: 0.5 }} className="mt-16">
            <div className="flex items-center gap-3 mb-6">
              <Users size={20} className="text-gold" />
              <h2 className="font-display font-bold text-xl text-chalk">Reparto principal</h2>
            </div>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-3">
              {cast.map((person, i) => (
                <motion.div key={person.id} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ delay: i * 0.04, duration: 0.4 }}
                  className="flex-shrink-0 w-28 text-center">
                  <div className="w-20 h-20 mx-auto rounded-full overflow-hidden border-2 border-white/10 bg-surface">
                    {person.profile_path
                      ? <img src={`${IMG_W500}${person.profile_path}`} alt={person.name} className="w-full h-full object-cover" loading="lazy" />
                      : <div className="w-full h-full flex items-center justify-center">
                          <span className="text-2xl text-dim font-bold">{person.name?.charAt(0) ?? '?'}</span>
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

        {/* Similar */}
        {similar.length > 0 && (
          <div className="mt-16">
            <MovieRow title="Series similares" movies={similar} mediaType="tv" />
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
          <div className="hidden md:block"><div className="skeleton aspect-[2/3] rounded-2xl" /></div>
          <div className="space-y-5 pt-8">
            <div className="flex gap-2">{[80,96,72].map((w,i) => <div key={i} className="skeleton h-6 rounded-full" style={{width:w}} />)}</div>
            <div className="skeleton h-12 w-3/4 rounded-xl" />
            <div className="skeleton h-4 w-1/2 rounded" />
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="skeleton h-4 rounded" />)}
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
      <p className="text-chalk font-display text-xl">No se pudo cargar la serie</p>
      <p className="text-muted text-sm font-mono">{error}</p>
      <button onClick={onBack} className="px-6 py-2.5 rounded-full bg-gold text-void font-semibold text-sm hover:bg-gold-hi transition-colors">
        Volver
      </button>
    </div>
  )
}
