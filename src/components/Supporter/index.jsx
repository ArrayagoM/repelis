import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Heart } from '@phosphor-icons/react'
import { useDonations, isSupporter, shouldThank, recordThanks, getDonations } from '../../lib/donations'
import { showToast } from '../../lib/toast'

/** Corazón dorado en la barra para quienes apoyan el proyecto. */
export function SupporterBadge({ className = '' }) {
  const d = useDonations()
  if (!isSupporter(d)) return null
  return (
    <Link to="/mi-lista" title="Sos Supporter de Life High. ¡Gracias!" aria-label="Supporter de Life High"
      className={`items-center justify-center w-8 h-8 rounded-full bg-gold/20 border border-gold/50 text-gold shadow-[0_0_14px_rgba(232,160,32,0.35)] ${className}`}>
      <Heart size={14} weight="fill" />
    </Link>
  )
}

/** Un agradecimiento por mes a quienes apoyan (una sola vez). No renderiza nada. */
export function SupporterWatcher() {
  useEffect(() => {
    const t = setTimeout(() => {
      if (!shouldThank(getDonations())) return
      recordThanks()
      showToast({ icon: '💛', title: 'Gracias por apoyar Life High', text: 'Gracias a gente como vos, el sitio sigue gratis y sin publicidad.', ttl: 9000 })
    }, 6000)
    return () => clearTimeout(t)
  }, [])
  return null
}
