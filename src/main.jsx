import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { store } from './store'
import App from './App'
import { installGlobalHandlers } from './lib/errorMonitor'
import { getDeviceCaps } from './lib/deviceCaps'
import './index.css'

// 1) Captura de errores globales (window.error + unhandledrejection)
installGlobalHandlers()

// Bandera de capacidad temprana (antes del primer render del App)
const _CAPS = getDeviceCaps()
if (_CAPS.lowEnd && typeof document !== 'undefined') {
  document.documentElement.classList.add('low-end')
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
)

// 2) Service Worker — solo en producción para no interferir con HMR de Vite
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Si falla, no es bloqueante — la app sigue funcionando.
    })
  })
}

// 3) Speed test en background, después del first paint, sin bloquear
//    Lo hacemos con 'requestIdleCallback' (o fallback) para no competir
//    con el render inicial.
const scheduleSpeedTest = (cb) => {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(cb, { timeout: 5000 })
  else setTimeout(cb, 2500)
}

// El tracking de visitas/páginas lo maneja <PageViewTracker/> montado en App
// (dispara en cada cambio de ruta, incluida la carga inicial, para TODOS los
// dispositivos incluidos low-end/proyectores).

// En low-end: NO ejecutamos el speed test. Son 12 HTTP requests al startup
// que tiran la memoria al techo en TVs/proyectores. El orden por defecto de
// SOURCES (LATAM-first) es suficiente.
if (!_CAPS.lowEnd) {
  scheduleSpeedTest(() => {
    import('./lib/speedTest').then(({ measureSources }) => {
      measureSources().catch(() => {})
    })
    import('./lib/serverHealth').then(({ pingAll }) => {
      pingAll().catch(() => {})
    })
    // Geolocalización IP del cliente (sin permisos, cacheado 24h).
    // El usuario admin ve su propia ciudad real en el mapa del admin.
    import('./lib/clientGeo').then(({ getClientGeo }) => {
      getClientGeo().catch(() => {})
    })
  })
}
