import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { store } from './store'
import App from './App'
import { installGlobalHandlers } from './lib/errorMonitor'
import './index.css'

// 1) Captura de errores globales (window.error + unhandledrejection)
installGlobalHandlers()

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

scheduleSpeedTest(() => {
  // Import dinámico para no inflar el initial bundle
  import('./lib/speedTest').then(({ measureSources }) => {
    measureSources().catch(() => {})
  })
})
