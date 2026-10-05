import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { CaretRight, Play, X } from '@phosphor-icons/react'
import { IMG_W342 } from '../../api/tmdb'

const CHIP_TONES = {
  gold:  'bg-gold text-void',
  blue:  'bg-blue-500/85 text-white',
  green: 'bg-emerald-500/85 text-white',
  red:   'bg-red-500/85 text-white',
}

/**
 * Fila horizontal de pósters para listas PERSONALES (Continuar viendo, Mi lista,
 * Recomendadas…). No aplica el filtro de idioma: es lo que el usuario eligió.
 *
 * items: [{ key, poster, title, sub?, progress?, chip?, chipTone?, to?, onClick?, onRemove?, playIcon? }]
 */
export default function PosterStrip({ title, badge, badgeTone = 'gold', items = [], onViewAll, empty = null, id }) {
  const trackRef = useRef(null)
  const navigate = useNavigate()

  if (!items.length && !empty) return null

  const scroll = (dir) => {
    const el = trackRef.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.75, behavior: 'smooth' })
  }

  const badgeStyle = badgeTone === 'blue'
    ? 'bg-blue-500/10 border-blue-500/20 text-blue-300'
    : badgeTone === 'green'
    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
    : 'bg-gold/10 border-gold/20 text-gold'

  return (
    <section id={id} className="relative">
      <div className="flex items-center justify-between px-6 md:px-12 mb-5">
        <div className="flex items-center gap-3 min-w-0">
          {badge && (
            <span className={`px-2.5 py-0.5 rounded-full border text-[10px] uppercase tracking-widest font-semibold flex-shrink-0 ${badgeStyle}`}>
              {badge}
            </span>
          )}
          <h2 className="font-display font-bold text-xl sm:text-2xl text-chalk tracking-tight truncate">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {onViewAll && (
            <button onClick={onViewAll} className="hidden sm:block text-sm text-muted hover:text-gold transition-colors">
              Ver todo
            </button>
          )}
          <button onClick={() => scroll(-1)} aria-label="Anterior"
            className="hidden md:flex w-8 h-8 rounded-full glass border border-white/10 items-center justify-center text-muted hover:text-gold hover:border-gold/30 transition-all rotate-180">
            <CaretRight size={14} weight="bold" />
          </button>
          <button onClick={() => scroll(1)} aria-label="Siguiente"
            className="hidden md:flex w-8 h-8 rounded-full glass border border-white/10 items-center justify-center text-muted hover:text-gold hover:border-gold/30 transition-all">
            <CaretRight size={14} weight="bold" />
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="px-6 md:px-12">{empty}</div>
      ) : (
        <div ref={trackRef} className="flex gap-4 overflow-x-auto scrollbar-hide px-6 md:px-12 pb-4"
          style={{ scrollSnapType: 'x mandatory' }}>
          {items.map((it) => (
            <article key={it.key} style={{ scrollSnapAlign: 'start' }}
              className="group relative flex-shrink-0 w-40 sm:w-44 md:w-48">
              <div className="relative rounded-[1.25rem] overflow-hidden border border-white/[0.06] bg-card shadow-[0_8px_32px_rgba(0,0,0,0.5)] group-hover:border-gold/30 transition-colors duration-300">
                <div className="relative aspect-[2/3] bg-surface">
                  {it.poster
                    ? <img src={`${IMG_W342}${it.poster}`} alt={it.title} loading="lazy" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-dim"><Play size={28} /></div>}
                  <div className="absolute inset-0 bg-gradient-to-t from-void via-void/20 to-transparent opacity-70" />
                  {it.chip && (
                    <span className={`absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${CHIP_TONES[it.chipTone] || CHIP_TONES.gold}`}>
                      {it.chip}
                    </span>
                  )}
                  {it.playIcon && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="w-12 h-12 rounded-full bg-gold/95 flex items-center justify-center shadow-[0_0_24px_rgba(232,160,32,0.5)]">
                        <Play size={20} weight="fill" className="text-void ml-0.5" />
                      </span>
                    </span>
                  )}
                  {typeof it.progress === 'number' && (
                    <div className="absolute left-0 right-0 bottom-0 h-1.5 bg-white/15" role="progressbar"
                      aria-valuenow={Math.round(it.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                      <div className="h-full bg-gold" style={{ width: `${Math.max(3, Math.round(it.progress * 100))}%` }} />
                    </div>
                  )}
                </div>
                <div className="p-3 space-y-0.5">
                  <p className="font-semibold text-sm leading-tight truncate text-chalk">{it.title}</p>
                  {it.sub && <p className="text-muted text-xs font-mono truncate">{it.sub}</p>}
                </div>
              </div>

              <button
                className="absolute inset-0 rounded-[1.25rem] focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                onClick={() => { if (it.onClick) it.onClick(); else if (it.to) navigate(it.to) }}
                aria-label={it.playIcon ? `Continuar ${it.title}` : `Ver ${it.title}`}
              />
              {it.onRemove && (
                <button
                  onClick={(e) => { e.stopPropagation(); it.onRemove() }}
                  aria-label={`Quitar ${it.title}`}
                  title="Quitar"
                  className="absolute z-20 top-2 right-2 w-7 h-7 rounded-full bg-void/80 border border-white/15 text-muted hover:text-chalk hover:bg-red-500/30 hover:border-red-500/40 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-all"
                >
                  <X size={12} weight="bold" />
                </button>
              )}
            </article>
          ))}
        </div>
      )}
      <div className="pointer-events-none absolute top-0 right-0 h-full w-24 bg-gradient-to-l from-void to-transparent" />
    </section>
  )
}
