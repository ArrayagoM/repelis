import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Storefront, ArrowSquareOut, Info } from '@phosphor-icons/react'
import { getMovieWatchProviders, getTVWatchProviders, IMG_BASE } from '../../api/tmdb'
import { track } from '../../lib/errorMonitor'

// Países LATAM en orden de prioridad
const REGIONS = ['AR', 'MX', 'CO', 'CL', 'PE', 'UY', 'ES', 'US']

const PROVIDER_DEEP_LINKS = {
  'Netflix':     'https://www.netflix.com/search?q=',
  'Amazon Prime Video': 'https://www.primevideo.com/search/ref=atv_nb_sr?phrase=',
  'Disney Plus': 'https://www.disneyplus.com/search?q=',
  'HBO Max':     'https://www.max.com/search?q=',
  'Max':         'https://www.max.com/search?q=',
  'Apple TV Plus':'https://tv.apple.com/search?term=',
  'Apple TV':    'https://tv.apple.com/search?term=',
  'Paramount Plus':'https://www.paramountplus.com/shows/?search=',
  'Crunchyroll': 'https://www.crunchyroll.com/search?q=',
  'Mubi':        'https://mubi.com/films?q=',
}

/**
 * Muestra dónde se puede ver la peli/serie LEGALMENTE.
 * Honestidad: si los embed gratis no la tienen, esta es la alternativa
 * legal real. TMDB devuelve datos verificados de JustWatch.
 */
export default function WatchProviders({ id, mediaType = 'movie', title = '' }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    let cancelled = false
    const fetcher = mediaType === 'tv' ? getTVWatchProviders : getMovieWatchProviders

    fetcher(id)
      .then((res) => {
        if (cancelled) return
        const results = res.data?.results || {}
        // Buscar el primer país con datos en nuestra prioridad LATAM
        let best = null
        let usedRegion = null
        for (const r of REGIONS) {
          if (results[r] && (results[r].flatrate || results[r].rent || results[r].buy)) {
            best = results[r]
            usedRegion = r
            break
          }
        }
        setData(best ? { ...best, region: usedRegion } : null)
      })
      .catch((err) => {
        track('watch-providers', err, { id, mediaType })
        if (!cancelled) setData(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [id, mediaType])

  if (loading) return null
  if (!data) return null

  const allProviders = [
    ...(data.flatrate || []).map((p) => ({ ...p, tier: 'sub' })),
    ...(data.rent     || []).map((p) => ({ ...p, tier: 'rent' })),
    ...(data.buy      || []).map((p) => ({ ...p, tier: 'buy' })),
  ]

  // Dedup: si el mismo provider aparece en sub + rent + buy, sub gana
  const seen = new Set()
  const dedupped = allProviders.filter((p) => {
    if (seen.has(p.provider_id)) return false
    seen.add(p.provider_id)
    return true
  })

  if (dedupped.length === 0) return null

  const openProvider = (p) => {
    const deepBase = PROVIDER_DEEP_LINKS[p.provider_name]
    if (deepBase && title) {
      window.open(`${deepBase}${encodeURIComponent(title)}`, '_blank', 'noopener,noreferrer')
    } else {
      window.open(data.link, '_blank', 'noopener,noreferrer')
    }
  }

  const tierLabel = (tier) =>
    tier === 'sub' ? 'Incluido en suscripción' :
    tier === 'rent' ? 'Alquiler' : 'Compra'

  const tierColor = (tier) =>
    tier === 'sub'  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' :
    tier === 'rent' ? 'bg-amber-500/10  border-amber-500/30  text-amber-300' :
                      'bg-purple-500/10 border-purple-500/30 text-purple-300'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-muted/70 text-xs uppercase tracking-widest font-semibold flex items-center gap-2">
          <Storefront size={12} weight="fill" className="text-gold" />
          Ver también legalmente
        </p>
        <span className="text-muted/40 text-[10px] font-mono">{data.region}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {dedupped.map((p) => (
          <button
            key={p.provider_id}
            onClick={() => openProvider(p)}
            className="group flex items-center gap-2 px-3 py-2 rounded-xl bg-surface border border-white/10 hover:border-gold/30 transition-all"
            title={`${p.provider_name} — ${tierLabel(p.tier)}`}
          >
            <img
              src={`${IMG_BASE}/original${p.logo_path}`}
              alt={p.provider_name}
              className="w-7 h-7 rounded-md object-cover flex-shrink-0"
              loading="lazy"
            />
            <div className="text-left min-w-0">
              <p className="text-chalk text-xs font-semibold leading-tight truncate max-w-[120px]">
                {p.provider_name}
              </p>
              <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded-full border text-[9px] font-mono leading-none ${tierColor(p.tier)}`}>
                {tierLabel(p.tier)}
              </span>
            </div>
            <ArrowSquareOut size={11} weight="bold"
              className="text-muted/40 group-hover:text-gold transition-colors flex-shrink-0" />
          </button>
        ))}
      </div>

      <p className="text-muted/45 text-[10px] leading-relaxed flex items-start gap-1.5 max-w-[60ch]">
        <Info size={10} weight="fill" className="text-gold/50 flex-shrink-0 mt-0.5" />
        <span>
          Datos verificados por <strong className="text-chalk/60">TMDB / JustWatch</strong>. Si los servidores gratis de Life High no la tienen, estas son las opciones legales con audio garantizado en español.
        </span>
      </p>
    </motion.div>
  )
}
