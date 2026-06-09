import { useEffect, useState } from 'react'
import { Globe, CheckCircle, Question } from '@phosphor-icons/react'
import { getMovieReleaseDates } from '../../api/tmdb'
import { track } from '../../lib/errorMonitor'

// Países LATAM más relevantes (orden = importancia)
const LATAM_COUNTRIES = [
  { iso: 'MX', name: 'México',     flag: '🇲🇽' },
  { iso: 'AR', name: 'Argentina',  flag: '🇦🇷' },
  { iso: 'CO', name: 'Colombia',   flag: '🇨🇴' },
  { iso: 'CL', name: 'Chile',      flag: '🇨🇱' },
  { iso: 'PE', name: 'Perú',       flag: '🇵🇪' },
  { iso: 'VE', name: 'Venezuela',  flag: '🇻🇪' },
  { iso: 'UY', name: 'Uruguay',    flag: '🇺🇾' },
  { iso: 'BO', name: 'Bolivia',    flag: '🇧🇴' },
  { iso: 'EC', name: 'Ecuador',    flag: '🇪🇨' },
  { iso: 'ES', name: 'España',     flag: '🇪🇸' },
]

/**
 * Muestra disponibilidad real de doblaje basada en release_dates de TMDB.
 *
 * Heurística: si una peli tiene release oficial en México, Argentina, Colombia,
 * etc., es MUY probable que esté doblada al español (por contrato de
 * distribución). No es 100% garantía pero es la señal más confiable disponible
 * sin scrapear sitios de doblaje.
 */
export default function DubInfo({ movieId, originalLanguage }) {
  const [releases, setReleases] = useState(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (!movieId) return
    setLoading(true)
    let cancelled = false
    getMovieReleaseDates(movieId)
      .then((res) => {
        if (cancelled) return
        const all = res.data?.results || []
        const found = all
          .filter((r) => LATAM_COUNTRIES.some((c) => c.iso === r.iso_3166_1))
          .map((r) => LATAM_COUNTRIES.find((c) => c.iso === r.iso_3166_1))
          .filter(Boolean)
        setReleases(found)
      })
      .catch((err) => {
        track('dub-info', err, { movieId })
        if (!cancelled) setReleases([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [movieId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted/50 text-xs">
        <Globe size={12} />
        Verificando estrenos LATAM...
      </div>
    )
  }

  if (!releases || releases.length === 0) {
    // Sin estrenos LATAM confirmados — honesto
    return (
      <div className="flex items-start gap-2 text-muted/60 text-xs leading-relaxed max-w-[58ch]">
        <Question size={12} weight="bold" className="text-amber-400/70 flex-shrink-0 mt-0.5" />
        <span>
          Sin estreno oficial confirmado en países LATAM por TMDB.
          {originalLanguage === 'es'
            ? ' Es una producción en español originalmente.'
            : ' El doblaje al español puede o no estar disponible — depende del servidor.'}
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
        <CheckCircle size={14} weight="fill" />
        Estrenada oficialmente en {releases.length} país{releases.length !== 1 ? 'es' : ''} LATAM
        <span className="text-muted/50 font-mono text-[10px]">(alto chance de doblaje)</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {releases.slice(0, 10).map((c) => (
          <span
            key={c.iso}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/8 border border-emerald-500/20 text-emerald-300/90 text-[10px] font-mono"
            title={c.name}
          >
            <span className="text-xs leading-none">{c.flag}</span>
            {c.iso}
          </span>
        ))}
      </div>
    </div>
  )
}
