import { useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { Ticket, MapPin, ArrowSquareOut } from '@phosphor-icons/react'
import {
  COUNTRIES, chainsFor, detectCountry, setStoredCountry, subscribeCountry, theaterStatus,
} from '../../lib/cinemas'
import { dateLabel } from '../../lib/reminders'

const useCountry = () => useSyncExternalStore(subscribeCountry, detectCountry, () => null)

/** Botones a los sitios OFICIALES de las cadenas del país + selector de país. */
export function CinemaChains({ className = '' }) {
  const country = useCountry()
  const chains = chainsFor(country)

  return (
    <div className={className}>
      {chains.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {chains.map((c) => (
            <a key={c.id} href={c.url} target="_blank" rel="noopener noreferrer"
              className="group flex items-center gap-2 px-4 py-2.5 rounded-full bg-gold/10 border border-gold/30 text-gold text-sm font-semibold hover:bg-gold/20 transition-colors">
              {c.name}
              <ArrowSquareOut size={12} className="opacity-60 group-hover:opacity-100" />
            </a>
          ))}
          <Link to="/cines-cerca"
            className="flex items-center gap-2 px-4 py-2.5 rounded-full glass border border-white/10 text-chalk text-sm font-medium hover:border-gold/30 hover:text-gold transition-colors">
            <MapPin size={14} weight="fill" /> Cines cerca de vos
          </Link>
        </div>
      ) : (
        <p className="text-muted text-sm">Elegí tu país para ver los cines.</p>
      )}

      <label className="flex items-center gap-2 mt-3 text-[11px] text-muted">
        País
        <select value={country || ''} onChange={(e) => setStoredCountry(e.target.value)} aria-label="País para los cines"
          className="bg-surface border border-white/10 rounded-lg px-2 py-1 text-chalk text-xs focus:outline-none focus:border-gold/40">
          {!country && <option value="">Elegir…</option>}
          {Object.entries(COUNTRIES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select>
      </label>
    </div>
  )
}

const FINE_PRINT = 'Te llevamos al sitio oficial de cada cine: ahí elegís función y pagás. Life High no vende entradas ni cobra comisión; solo recibe donaciones voluntarias.'

/** Tarjeta "Verla en el cine" para la ficha de una película en cartelera o en preventa. */
export default function CinemaTickets({ movie }) {
  const status = theaterStatus(movie)
  if (!status) return null

  return (
    <aside aria-label="Verla en el cine"
      className="max-w-xl p-4 rounded-2xl bg-gradient-to-br from-gold/10 to-transparent border border-gold/25">
      <p className="flex items-center gap-2 text-chalk font-display font-bold text-base">
        <Ticket size={20} weight="fill" className="text-gold" />
        Verla en el cine
        <span className="px-2 py-0.5 rounded-full bg-gold text-void text-[10px] font-bold uppercase tracking-wide">
          {status === 'presale' ? 'Preventa' : 'En cartelera'}
        </span>
      </p>
      <p className="text-muted text-sm leading-relaxed mt-1.5 mb-3">
        {status === 'presale'
          ? `Se estrena el ${dateLabel(movie.release_date || movie.date)}. Ya podés ir viendo la preventa en los cines.`
          : 'La pantalla grande es otra experiencia. Comprá tu entrada directo en el sitio oficial del cine.'}
      </p>
      <CinemaChains />
      <p className="text-muted/60 text-[11px] leading-relaxed mt-3">{FINE_PRINT}</p>
    </aside>
  )
}

/** Banda para la Home, debajo de "En Cartelera". */
export function CinemaBanner() {
  return (
    <section aria-label="Entradas de cine" className="px-6 md:px-12 -mt-4">
      <div className="max-w-7xl mx-auto p-5 rounded-2xl bg-gradient-to-r from-gold/10 via-transparent to-transparent border border-gold/20">
        <p className="flex items-center gap-2 text-chalk font-display font-bold text-lg">
          <Ticket size={22} weight="fill" className="text-gold" />
          ¿Preferís verla en el cine?
        </p>
        <p className="text-muted text-sm mt-1 mb-3">Comprá tu entrada en el sitio oficial de tu cine:</p>
        <CinemaChains />
        <p className="text-muted/60 text-[11px] leading-relaxed mt-3 max-w-2xl">{FINE_PRINT}</p>
      </div>
    </section>
  )
}
