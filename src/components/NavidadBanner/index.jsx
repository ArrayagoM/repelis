import { Link } from 'react-router-dom'
import { TreeEvergreen, ArrowRight } from '@phosphor-icons/react'
import { christmasCountdown, isChristmasSeason } from '../../lib/seasons'
import Snow from '../Snow'
import { tt } from '../../lib/i18n'

/** Cartel de Navidad para el inicio. Solo aparece en temporada navideña (15 de noviembre al 6 de enero). */
export default function NavidadBanner() {
  if (!isChristmasSeason()) return null
  return (
    <div className="mx-auto max-w-7xl px-6 md:px-12">
      <Link to="/navidad"
        className="group relative flex flex-wrap items-center gap-4 overflow-hidden rounded-3xl border border-emerald-400/30 bg-gradient-to-r from-emerald-950/80 via-red-950/40 to-void p-5 sm:p-6 hover:border-emerald-300/60 transition-colors">
        <Snow />
        <span aria-hidden="true" className="absolute -left-10 -top-10 w-40 h-40 rounded-full bg-emerald-500/20 blur-3xl" />
        <span aria-hidden="true" className="absolute -right-10 -bottom-12 w-44 h-44 rounded-full bg-red-600/20 blur-3xl" />
        <span className="relative w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-300/30 flex items-center justify-center text-emerald-300 flex-shrink-0">
          <TreeEvergreen size={26} weight="fill" />
        </span>
        <span className="relative mr-auto min-w-0">
          <span className="block text-emerald-300 text-[11px] font-semibold uppercase tracking-widest">{christmasCountdown()}</span>
          <span className="block font-display font-extrabold text-xl sm:text-2xl text-chalk leading-tight">{tt("Navidad en Life High")}</span>
          <span className="block text-muted text-sm mt-0.5">{tt("Clásicos de diciembre, comedias, animación y series para ver en familia. Armá tu maratón navideño.")}</span>
        </span>
        <span className="relative inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-600 text-white font-bold text-sm group-hover:bg-red-500 transition-colors">
          {tt("Entrar")} <ArrowRight size={14} weight="bold" />
        </span>
      </Link>
    </div>
  )
}
