import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { motion } from 'framer-motion'
import { Play, Star, CalendarBlank, TelevisionSimple } from '@phosphor-icons/react'
import { IMG_W342, IMG_W500 } from '../../api/tmdb'
import { openPlayer } from '../../store/slices/playerSlice'
import { getNetworkInfo } from '../../lib/network'

// Detectamos una sola vez (no recomputamos en cada card) si la red es lenta.
// En red lenta: poster más chico (w342 vs w500) y sin tilt 3D (ahorra paint).
const _netInfo = typeof window !== 'undefined' ? getNetworkInfo() : { quality: 'unknown', saveData: false }
const LOW_END = _netInfo.quality === 'slow' || _netInfo.quality === 'moderate' || _netInfo.saveData

export default function MovieCard({ movie, index = 0, mediaType = 'movie' }) {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const cardRef  = useRef(null)
  const [tilt,    setTilt]    = useState({ x: 0, y: 0 })
  const [hovered, setHovered] = useState(false)

  const isTV = mediaType === 'tv' || movie?.media_type === 'tv' || movie?.first_air_date !== undefined

  if (!movie) return null

  const posterBase = LOW_END ? IMG_W342 : IMG_W500
  const posterUrl  = movie.poster_path ? `${posterBase}${movie.poster_path}` : null
  const rating    = movie.vote_average?.toFixed(1) ?? '–'
  const year      = (movie.release_date || movie.first_air_date)?.slice(0, 4) ?? ''
  const title     = movie.title ?? movie.name ?? 'Sin título'

  const handleMouseMove = (e) => {
    if (LOW_END) return                       // sin tilt en red lenta — ahorra paint
    const rect = cardRef.current?.getBoundingClientRect()
    if (!rect) return
    setTilt({
      x: ((e.clientY - rect.top)  / rect.height - 0.5) * -10,
      y: ((e.clientX - rect.left) / rect.width  - 0.5) *  10,
    })
  }
  const resetTilt = () => { setTilt({ x: 0, y: 0 }); setHovered(false) }

  const handlePlay = (e) => {
    e.stopPropagation()
    if (isTV) {
      navigate(`/tv/${movie.id}`)
    } else {
      dispatch(openPlayer({ movieId: movie.id, title, mediaType: 'movie' }))
    }
  }

  const handleCardClick = () => {
    if (isTV) navigate(`/tv/${movie.id}`)
    else      navigate(`/movie/${movie.id}`)
  }

  return (
    <motion.article
      ref={cardRef}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay: index * 0.045, ease: [0.16, 1, 0.3, 1] }}
      style={{
        transform: `perspective(800px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        transition: hovered ? 'transform 0.1s linear' : 'transform 0.5s cubic-bezier(0.32,0.72,0,1)',
        willChange: 'transform',
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={resetTilt}
      className="group relative flex-shrink-0 w-40 sm:w-44 md:w-48 select-none cursor-pointer"
    >
      <div className="
        relative rounded-[1.25rem] overflow-hidden border transition-all duration-500
        bg-card border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.5)]
        group-hover:border-gold/30 group-hover:shadow-[0_12px_40px_rgba(232,160,32,0.15)]
      ">
        {/* Poster */}
        <div className="relative aspect-[2/3] overflow-hidden">
          {posterUrl
            ? <img src={posterUrl} alt={title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                loading="lazy" />
            : <div className="w-full h-full bg-surface flex items-center justify-center">
                <Play size={32} className="text-dim" />
              </div>
          }

          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-void via-void/40 to-transparent opacity-60 group-hover:opacity-90 transition-opacity duration-400" />

          {/* Badge TV */}
          {isTV && (
            <div className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/80 backdrop-blur-sm">
              <TelevisionSimple size={9} weight="fill" className="text-white" />
              <span className="text-white text-[9px] font-bold">SERIE</span>
            </div>
          )}

          {/* Botón play */}
          <motion.div
            animate={{ opacity: hovered ? 1 : 0, scale: hovered ? 1 : 0.7 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <button onClick={handlePlay}
              className="w-[52px] h-[52px] rounded-full bg-gold shadow-[0_0_24px_rgba(232,160,32,0.5)]
                flex items-center justify-center hover:bg-gold-hi hover:scale-110 transition-all duration-200"
              aria-label={`${isTV ? 'Ver' : 'Reproducir'} ${title}`}
            >
              <Play size={20} weight="fill" className="text-void ml-0.5" />
            </button>
          </motion.div>

          {/* Rating */}
          <div className="absolute bottom-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-void/70 backdrop-blur-sm border border-gold/15">
            <Star size={9} weight="fill" className="text-gold" />
            <span className="text-[10px] font-mono font-medium text-chalk">{rating}</span>
          </div>
        </div>

        {/* Metadata */}
        <div className="p-3 space-y-0.5">
          <p className="font-semibold text-sm leading-tight truncate text-chalk">{title}</p>
          {year && (
            <div className="flex items-center gap-1.5 text-muted text-xs">
              <CalendarBlank size={10} />
              <span className="font-mono">{year}</span>
            </div>
          )}
        </div>
      </div>

      {/* Clic para detalle */}
      <button
        className="absolute inset-0 rounded-[1.25rem] focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        onClick={handleCardClick}
        aria-label={`Ver detalles de ${title}`}
      />
    </motion.article>
  )
}

export function MovieCardSkeleton() {
  return (
    <div className="flex-shrink-0 w-40 sm:w-44 md:w-48">
      <div className="rounded-[1.25rem] overflow-hidden border border-white/[0.04]">
        <div className="aspect-[2/3] skeleton" />
        <div className="p-3 space-y-2 bg-card">
          <div className="skeleton h-3.5 w-4/5 rounded" />
          <div className="skeleton h-2.5 w-1/2 rounded" />
        </div>
      </div>
    </div>
  )
}
