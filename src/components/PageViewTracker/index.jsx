import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { trackPageView } from '../../lib/visitTracker'

/**
 * Dispara un page view en cada cambio de ruta.
 * No renderiza nada. La 1ª navegación de la sesión registra al visitante
 * (país, dispositivo, SO, referrer); las siguientes solo suman página vista.
 */
export default function PageViewTracker() {
  const location = useLocation()
  useEffect(() => {
    trackPageView(location.pathname)
  }, [location.pathname])
  return null
}
