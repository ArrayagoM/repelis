import { Link } from 'react-router-dom'
import { Ghost, ArrowRight } from '@phosphor-icons/react'
import { halloweenCountdown, isHalloweenSeason } from '../../lib/seasons'

/** Cartel de la Sesión de terror para el inicio. Solo aparece en temporada de Halloween. */
export default function TerrorBanner() {
  if (!isHalloweenSeason()) return null
  return (
    <div className="mx-auto max-w-7xl px-6 md:px-12">
      <Link to="/terror"
        className="group relative flex flex-wrap items-center gap-4 overflow-hidden rounded-3xl border border-red-500/30 bg-gradient-to-r from-red-950/70 via-void to-void p-5 sm:p-6 hover:border-red-400/60 transition-colors">
        <span aria-hidden="true" className="absolute -left-10 -top-10 w-40 h-40 rounded-full bg-red-600/25 blur-3xl" />
        <span className="relative w-12 h-12 rounded-2xl bg-red-500/15 border border-red-400/30 flex items-center justify-center text-red-300 flex-shrink-0">
          <Ghost size={26} weight="fill" />
        </span>
        <span className="relative mr-auto min-w-0">
          <span className="block text-red-300 text-[11px] font-semibold uppercase tracking-widest">{halloweenCountdown()}</span>
          <span className="block font-display font-extrabold text-xl sm:text-2xl text-chalk leading-tight">Sesión de terror</span>
          <span className="block text-muted text-sm mt-0.5">Lo último, los clásicos y series para no dormir. Armá tu maratón de Halloween.</span>
        </span>
        <span className="relative inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-600 text-white font-bold text-sm group-hover:bg-red-500 transition-colors">
          Entrar <ArrowRight size={14} weight="bold" />
        </span>
      </Link>
    </div>
  )
}
