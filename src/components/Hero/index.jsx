import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Info, Star } from '@phosphor-icons/react'
import { IMG_ORIGINAL, IMG_W500, IMG_W780 } from '../../api/tmdb'
import { openPlayer } from '../../store/slices/playerSlice'
import { getDeviceCaps } from '../../lib/deviceCaps'

const _caps = typeof window !== 'undefined' ? getDeviceCaps() : { lowEnd: false }
const LOW_END = _caps.lowEnd

// En low-end: solo 1 peli, sin auto-rotate, backdrop más liviano (780 vs original)
const MAX_SLIDES = LOW_END ? 1 : 8

export default function Hero({ movies = [] }) {
  const [index, setIndex] = useState(0)
  const navigate = useNavigate()
  const dispatch = useDispatch()

  // Auto-rotate every 7s (deshabilitado en low-end)
  useEffect(() => {
    if (LOW_END || movies.length < 2) return
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % Math.min(movies.length, MAX_SLIDES))
    }, 7000)
    return () => clearInterval(id)
  }, [movies.length])

  if (!movies.length) return <HeroSkeleton />

  const movie = movies[index]
  // Backdrop más liviano en low-end (780px vs original ~2000px)
  const backdropBase = LOW_END ? IMG_W780 : IMG_ORIGINAL
  const backdropUrl = movie.backdrop_path
    ? `${backdropBase}${movie.backdrop_path}`
    : null
  const posterUrl = movie.poster_path
    ? `${IMG_W500}${movie.poster_path}`
    : null

  const rating   = movie.vote_average?.toFixed(1) ?? '–'
  const year     = movie.release_date?.slice(0, 4) ?? ''
  const overview = movie.overview?.length > 180
    ? movie.overview.slice(0, 180) + '…'
    : movie.overview

  return (
    <section className={`relative w-full flex items-end overflow-hidden ${LOW_END ? 'hero-low-end' : 'min-h-[100dvh]'}`}>
      {/* ── Backdrop ── */}
      {LOW_END ? (
        // En low-end: SIN imagen backdrop. Una imagen de 780px = ~80KB en
        // RAM, y aquí ya hay 12 cards más. Color sólido + un gradient sutil.
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#1a1a2e] via-void to-[#0a0a14]" aria-hidden="true" />
      ) : (
        <AnimatePresence mode="crossfade">
          <motion.div
            key={`backdrop-${movie.id}`}
            className="absolute inset-0 z-0"
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: [0.32, 0.72, 0, 1] }}
          >
            {backdropUrl && (
              <img
                src={backdropUrl}
                alt=""
                className="w-full h-full object-cover object-center"
                style={{ willChange: 'transform' }}
              />
            )}
            {/* Multi-layer cinematic gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-void via-void/70 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-void via-void/30 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-b from-void/60 via-transparent to-transparent" />
          </motion.div>
        </AnimatePresence>
      )}

      {/* ── Content ── */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-12 pb-24 pt-32 grid grid-cols-1 md:grid-cols-2 gap-12 items-end">
        {/* Left: Text */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`text-${movie.id}`}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col gap-5"
          >
            {/* Eyebrow */}
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold text-[11px] uppercase tracking-[0.18em] font-semibold">
                Tendencia global
              </span>
              <span className="flex items-center gap-1 text-gold text-sm font-mono font-medium">
                <Star size={14} weight="fill" />
                {rating}
              </span>
              {year && (
                <span className="text-muted text-sm font-mono">{year}</span>
              )}
            </div>

            {/* Title */}
            <h1 className="font-display font-extrabold text-4xl sm:text-5xl xl:text-[3.8rem] leading-[1.05] tracking-tight text-chalk max-w-[16ch]">
              {movie.title}
            </h1>

            {/* Overview */}
            <p className="text-muted text-base leading-relaxed max-w-[52ch] hidden sm:block">
              {overview}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap gap-3 mt-2">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => dispatch(openPlayer({ movieId: movie.id, title: movie.title }))}
                className="
                  group flex items-center gap-3 px-6 py-3.5 rounded-full
                  bg-gold hover:bg-gold-hi text-void font-semibold text-[0.95rem]
                  shadow-[0_4px_24px_rgba(232,160,32,0.35)] hover:shadow-[0_4px_32px_rgba(232,160,32,0.55)]
                  transition-all duration-300
                "
              >
                <span className="w-7 h-7 rounded-full bg-void/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Play size={14} weight="fill" />
                </span>
                Reproducir
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate(`/movie/${movie.id}`)}
                className="
                  flex items-center gap-2.5 px-6 py-3.5 rounded-full
                  glass border border-white/10 text-chalk font-medium text-[0.95rem]
                  hover:border-gold/30 hover:text-gold
                  transition-all duration-300
                "
              >
                <Info size={17} weight="bold" />
                Más info
              </motion.button>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Right: Poster — oculto en low-end (1 imagen menos en RAM) */}
        {!LOW_END && (
          <AnimatePresence mode="wait">
            <motion.div
              key={`poster-${movie.id}`}
              className="hidden lg:flex justify-end items-end"
              initial={{ opacity: 0, x: 40, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            >
              {posterUrl && (
                <div className="relative w-52 xl:w-60 rounded-2xl overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.8)] border border-white/10">
                  <img src={posterUrl} alt={movie.title} className="w-full" />
                  <div className="absolute inset-0 bg-gradient-to-t from-void/50 to-transparent" />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* ── Slide indicators (ocultos en low-end porque solo hay 1 slide) ── */}
      {!LOW_END && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
          {movies.slice(0, MAX_SLIDES).map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`transition-all duration-400 rounded-full ${
                i === index
                  ? 'w-8 h-1.5 bg-gold shadow-[0_0_8px_rgba(232,160,32,0.6)]'
                  : 'w-1.5 h-1.5 bg-white/20 hover:bg-white/40'
              }`}
              aria-label={`Ir a película ${i + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function HeroSkeleton() {
  return (
    <section className="relative w-full min-h-[100dvh] flex items-end overflow-hidden">
      <div className="absolute inset-0 skeleton" />
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-12 pb-24 pt-32">
        <div className="space-y-5 max-w-xl">
          <div className="skeleton h-5 w-36 rounded-full" />
          <div className="skeleton h-14 w-96 rounded-xl" />
          <div className="skeleton h-14 w-72 rounded-xl" />
          <div className="skeleton h-4 w-80 rounded" />
          <div className="skeleton h-4 w-64 rounded" />
          <div className="flex gap-3 mt-4">
            <div className="skeleton h-12 w-36 rounded-full" />
            <div className="skeleton h-12 w-28 rounded-full" />
          </div>
        </div>
      </div>
    </section>
  )
}
