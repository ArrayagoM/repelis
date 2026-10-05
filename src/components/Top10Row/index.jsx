import { useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CaretRight, Star } from '@phosphor-icons/react'
import { IMG_W342 } from '../../api/tmdb'
import { useLanguageFilter } from '../../lib/useLanguageFilter'
import { isOut } from '../../lib/releaseStatus'

const badgeStyles = {
  blue: 'bg-blue-500/10 border-blue-500/20 text-blue-300',
  red: 'bg-red-500/10 border-red-500/20 text-red-300',
  purple: 'bg-purple-500/10 border-purple-500/20 text-purple-300',
  gold: 'bg-gold/10 border-gold/20 text-gold',
}

/** Fila "Top 10" con el número del puesto bien grande detrás de cada póster. */
export default function Top10Row({ title, badge = 'Top 10', badgeColor = 'gold', movies = [], loading = false, mediaType = 'movie' }) {
  const trackRef = useRef(null)
  const navigate = useNavigate()
  const released = useMemo(() => movies.filter(isOut), [movies])
  const top = useLanguageFilter(released).slice(0, 10)

  if (!loading && top.length === 0 && movies.length > 0) return null

  const scroll = (dir) => {
    const el = trackRef.current
    if (el) el.scrollBy({ left: dir === 'right' ? el.clientWidth * 0.75 : -el.clientWidth * 0.75, behavior: 'smooth' })
  }

  const open = (item) => {
    const isTV = mediaType === 'tv' || item.media_type === 'tv'
    navigate(`/${isTV ? 'tv' : 'movie'}/${item.id}`)
  }

  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="relative"
      aria-label={title}
    >
      <div className="flex items-center justify-between px-6 md:px-12 mb-5">
        <div className="flex items-center gap-3">
          <span className={`px-2.5 py-0.5 rounded-full border text-[10px] uppercase tracking-widest font-semibold ${badgeStyles[badgeColor] || badgeStyles.gold}`}>
            {badge}
          </span>
          <h2 className="font-display font-bold text-xl sm:text-2xl text-chalk tracking-tight">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => scroll('left')} aria-label="Anterior"
            className="hidden md:flex w-8 h-8 rounded-full glass border border-white/10 items-center justify-center text-muted hover:text-gold hover:border-gold/30 transition-all rotate-180">
            <CaretRight size={14} weight="bold" />
          </button>
          <button onClick={() => scroll('right')} aria-label="Siguiente"
            className="hidden md:flex w-8 h-8 rounded-full glass border border-white/10 items-center justify-center text-muted hover:text-gold hover:border-gold/30 transition-all">
            <CaretRight size={14} weight="bold" />
          </button>
        </div>
      </div>

      <ol ref={trackRef} className="flex gap-2 sm:gap-4 overflow-x-auto scrollbar-hide px-6 md:px-12 pb-4 list-none m-0">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="flex-shrink-0 flex items-end">
                <div className="w-[88px] sm:w-[110px] h-[150px] sm:h-[190px]" />
                <div className="w-[110px] sm:w-[135px] aspect-[2/3] rounded-xl bg-surface animate-pulse -ml-2 sm:-ml-3" />
              </li>
            ))
          : top.map((item, i) => {
              const name = item.title ?? item.name ?? 'Sin título'
              return (
                <li key={item.id} className="flex-shrink-0" style={{ scrollSnapAlign: 'start' }}>
                  <button
                    onClick={() => open(item)}
                    aria-label={`Puesto ${i + 1}: ${name}`}
                    className="group relative flex items-end focus:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded-xl"
                  >
                    <span
                      aria-hidden="true"
                      className="font-display font-extrabold leading-[0.8] select-none tracking-tighter text-[7.5rem] sm:text-[9.5rem] transition-transform duration-300 group-hover:-translate-y-1"
                      style={{ WebkitTextStroke: '3px #E8A020', color: '#08080E', paddingBottom: '0.25rem' }}
                    >
                      {i + 1}
                    </span>
                    <span className="relative -ml-2 sm:-ml-3 block w-[110px] sm:w-[135px] aspect-[2/3] rounded-xl overflow-hidden bg-surface shadow-[0_12px_32px_rgba(0,0,0,0.6)] ring-1 ring-white/10 transition-transform duration-300 group-hover:scale-[1.04] group-hover:ring-gold/40">
                      {item.poster_path ? (
                        <img src={`${IMG_W342}${item.poster_path}`} alt={name} loading="lazy" className="w-full h-full object-cover" />
                      ) : (
                        <span className="w-full h-full flex items-center justify-center text-muted text-xs p-2 text-center">{name}</span>
                      )}
                      {item.vote_average > 0 && (
                        <span className="absolute top-1.5 right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-void/85 text-[10px] font-bold text-chalk">
                          <Star size={9} weight="fill" className="text-gold" />
                          {item.vote_average.toFixed(1)}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
      </ol>

      <div className="pointer-events-none absolute top-0 right-0 h-full w-24 bg-gradient-to-l from-void to-transparent" />
    </motion.section>
  )
}
