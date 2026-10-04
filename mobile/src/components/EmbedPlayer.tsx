import { useMemo } from 'react'
import { StyleSheet } from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'
import { PARENT_ORIGIN, buildEmbedHtml } from '@/lib/playerSources'

interface Props {
  url: string
  onLoaded: () => void
  onPlaying: () => void
  onFailed: () => void
}

// Reproductor nativo (Android / iOS / TV): el embed corre en un iframe dentro de un WebView,
// igual que en la web, con el origen padre y los permisos de pantalla completa.
export function EmbedPlayer({ url, onLoaded, onPlaying, onFailed }: Props) {
  const html = useMemo(() => buildEmbedHtml(url), [url])

  const onMessage = (e: WebViewMessageEvent) => {
    const msg = e.nativeEvent.data
    if (msg === 'loaded') onLoaded()
    else if (msg === 'playing') onPlaying()
  }

  return (
    <WebView
      source={{ html, baseUrl: PARENT_ORIGIN }}
      style={styles.web}
      originWhitelist={['*']}
      javaScriptEnabled
      domStorageEnabled
      thirdPartyCookiesEnabled
      allowsFullscreenVideo
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      mixedContentMode="always"
      onMessage={onMessage}
      onError={onFailed}
      onHttpError={onFailed}
      // El wrapper es la página de nivel superior: cualquier navegación de nivel superior es un anuncio/popup → se bloquea.
      onShouldStartLoadWithRequest={(req) => {
        if (req.isTopFrame === false) return true
        return req.url.startsWith('about:') || req.url.startsWith('data:') || req.url.startsWith(PARENT_ORIGIN)
      }}
    />
  )
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: '#000' },
})
