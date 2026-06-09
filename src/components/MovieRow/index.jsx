import { useRef } from 'react'
import { motion } from 'framer-motion'
import { CaretRight, ArrowRight } from '@phosphor-icons/react'
import MovieCard, { MovieCardSkeleton } from '../MovieCard'
import { getDeviceCaps } from '../../lib/deviceCaps'

const _LOW_END = typeof window !== 'undefined' && getDeviceCaps().lowEnd
const ROW_LIMIT = _LOW_END ? 8 : 20

export default function MovieRow({ title, badge, movies = [], loading = false, onViewAll, mediaType = 'movie', badgeColor }) {
  const trackRef = useRef(null)
  const visible = movies.slice(0, ROW_LIMIT)

  const scroll = (dir) => {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: dir === 'right' ? el.clientWidth * 0.75 : -el.clientWidth * 0.75, behavior: 'smooth' })
  }

  const badgeStyle = badgeColor === 'blue'
    ? 'bg-blue-500/10 border-blue-500/20 text-blue-300'
    : badgeColor === 'red'
    ? 'bg-red-500/10 border-red-500/20 text-red-300'
    : badgeColor === 'purple'
    ? 'bg-purple-500/10 border-purple-500/20 text-purple-300'
    : 'bg-gold/10 border-gold/20 text-gold'

  return (
    <motion.section
      initial={_LOW_END ? false : { opacity: 0 }}
      whileInView={_LOW_END ? undefined : { opacity: 1 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={_LOW_END ? { duration: 0 } : { duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="relative"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 md:px-12 mb-5">
        <div className="flex items-center gap-3">
          {badge && (
            <span className={`px-2.5 py-0.5 rounded-full border text-[10px] uppercase tracking-widest font-semibold ${badgeStyle}`}>
              {badge}
            </span>
          )}
          <h2 className="font-display font-bold text-xl sm:text-2xl text-chalk tracking-tight">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {onViewAll && (
            <button onClick={onViewAll}
              className="hidden sm:flex items-center gap-1.5 text-sm text-muted hover:text-gold transition-colors group">
              Ver todo
              <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
          <button onClick={() => scroll('left')}
            className="hidden md:flex w-8 h-8 rounded-full glass border border-white/10 items-center justify-center text-muted hover:text-gold hover:border-gold/30 transition-all rotate-180">
            <CaretRight size={14} weight="bold" />
          </button>
          <button onClick={() => scroll('right')}
            className="hidden md:flex w-8 h-8 rounded-full glass border border-white/10 items-center justify-center text-muted hover:text-gold hover:border-gold/30 transition-all">
            <CaretRight size={14} weight="bold" />
          </button>
        </div>
      </div>

      {/* Track */}
      <div ref={trackRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide px-6 md:px-12 pb-4"
        style={{ scrollSnapType: 'x mandatory' }}>
        {loading
          ? Array.from({ length: _LOW_END ? 4 : 10 }).map((_, i) => (
              <div key={i} style={{ scrollSnapAlign: 'start' }}><MovieCardSkeleton /></div>
            ))
          : visible.map((movie, i) => (
              <div key={movie.id} style={{ scrollSnapAlign: 'start' }}>
                <MovieCard movie={movie} index={i} mediaType={mediaType} />
              </div>
            ))
        }
      </div>

      {/* Right fade */}
      <div className="pointer-events-none absolute top-0 right-0 h-full w-24 bg-gradient-to-l from-void to-transparent" />
    </motion.section>
  )
}
