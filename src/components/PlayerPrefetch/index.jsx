import { useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { getOrderedSources, buildUrl, DEFAULT_ALLOW } from '../../lib/playerSources'
import { getNetworkInfo } from '../../lib/network'

/**
 * Calienta el top servidor mientras el usuario está en la página de detalle.
 *
 * Por qué reduce el time-to-play (TTP):
 *  - DNS lookup, TCP handshake, TLS handshake → resueltos antes del clic.
 *  - HTML del player y assets estáticos → quedan en HTTP cache.
 *  - El reproductor real abre con cache caliente, arranca casi instantáneo.
 *
 * Salvaguardas:
 *  - Si saveData está activo (el usuario quiere ahorrar datos) → no prefetchea.
 *  - Espera 350ms tras montarse (no compite con el render del detalle).
 *  - El iframe es invisible, sin foco, sin pointer-events. Autoplay queda
 *    bloqueado por el browser (no hay user-gesture aún), así que no hace ruido.
 */
export default function PlayerPrefetch({
  id,
  mediaType = 'movie',
  season = 1,
  episode = 1,
  enabled = true,
}) {
  // Si el modal está abierto, NO prefetchamos — sería un segundo iframe del
  // mismo video decodificándose en paralelo, lo que mata FPS de reproducción.
  const isPlayerOpen = useSelector((s) => s.player.isOpen)

  const [armed, setArmed] = useState(false)
  const sourceRef = useRef(null)

  useEffect(() => {
    if (!enabled || !id || isPlayerOpen) {
      setArmed(false)
      return
    }
    const { saveData } = getNetworkInfo()
    if (saveData) {
      setArmed(false)
      return
    }
    sourceRef.current = getOrderedSources()[0]
    const t = setTimeout(() => setArmed(true), 350)
    return () => {
      clearTimeout(t)
      setArmed(false)
    }
  }, [enabled, id, mediaType, season, episode, isPlayerOpen])

  if (!armed || !id || !sourceRef.current || isPlayerOpen) return null

  const top = sourceRef.current
  const url = buildUrl(top, { mediaType, id, season, episode })
  if (!url) return null

  return (
    <iframe
      key={`prefetch-${id}-${mediaType}-${season}-${episode}`}
      src={url}
      title="player-prefetch"
      aria-hidden="true"
      tabIndex={-1}
      allow={top.allowAttr || DEFAULT_ALLOW}
      referrerPolicy="no-referrer"
      loading="eager"
      {...(top.sandbox ? { sandbox: top.sandbox } : {})}
      style={{
        position: 'fixed',
        bottom: 0,
        right: 0,
        width: 1,
        height: 1,
        border: 0,
        opacity: 0,
        pointerEvents: 'none',
        zIndex: -1,
        visibility: 'hidden',
      }}
    />
  )
}
