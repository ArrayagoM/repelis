import { useEffect, useRef } from 'react'
import { View } from 'react-native'

interface Props {
  url: string
  onLoaded: () => void
  onPlaying: () => void
  onFailed: () => void
}

// Variante web (vista previa en navegador): iframe directo, mismo comportamiento que la web.
export function EmbedPlayer({ url, onLoaded, onPlaying }: Props) {
  const ref = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const d = e.data as { event?: string; type?: string } | string | undefined
      if (!d) return
      const ev = typeof d === 'string' ? d : d.event || d.type
      if (ev === 'play' || ev === 'playing' || ev === 'started' || ev === 'PLAYER_EVENT') onPlaying()
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [onPlaying])

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <iframe
        ref={ref}
        src={url}
        title="Reproductor"
        allow="autoplay *; fullscreen *; picture-in-picture *; encrypted-media *"
        allowFullScreen
        referrerPolicy="no-referrer"
        onLoad={onLoaded}
        style={{ border: 0, width: '100%', height: '100%', position: 'absolute', inset: 0 }}
      />
    </View>
  )
}
