import { useEffect, useRef, useState } from 'react'

const SRC = 'https://accounts.google.com/gsi/client'
let loader = null

/** Carga el script oficial de Google Identity Services una sola vez. */
const loadGsi = () => {
  if (typeof window === 'undefined') return Promise.reject(new Error('sin ventana'))
  if (window.google?.accounts?.id) return Promise.resolve(window.google)
  if (!loader) {
    loader = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = SRC
      s.async = true
      s.defer = true
      s.onload = () => resolve(window.google)
      s.onerror = () => { loader = null; reject(new Error('gsi')) }
      document.head.appendChild(s)
    })
  }
  return loader
}

/**
 * Botón oficial "Continuar con Google". Al elegir una cuenta, Google nos da una credencial firmada
 * que el servidor verifica. `onCredential(credential)` se llama con ese texto.
 */
export default function GoogleButton({ clientId, onCredential, text = 'continue_with', label = 'Continuar con Google' }) {
  const holder = useRef(null)
  const cb = useRef(onCredential)
  cb.current = onCredential
  const [state, setState] = useState('loading')   // loading | ready | error

  useEffect(() => {
    let cancelled = false
    setState('loading')
    loadGsi().then((g) => {
      if (cancelled || !holder.current) return
      g.accounts.id.initialize({
        client_id: clientId,
        callback: (res) => { if (res?.credential) cb.current(res.credential) },
        ux_mode: 'popup',
        auto_select: false,
        cancel_on_tap_outside: true,
      })
      holder.current.innerHTML = ''
      g.accounts.id.renderButton(holder.current, {
        type: 'standard', theme: 'filled_black', size: 'large', shape: 'pill', text, locale: 'es',
        width: Math.min(320, holder.current.clientWidth || 320),
      })
      setState('ready')
    }).catch(() => { if (!cancelled) setState('error') })
    return () => { cancelled = true }
  }, [clientId, text])

  if (state === 'error') {
    return (
      <p role="status" className="text-center text-xs text-muted leading-relaxed p-3 rounded-xl bg-white/5 border border-white/10">
        No pudimos cargar el botón de Google (puede ser un bloqueador de contenido o la conexión). Podés usar tu mail y contraseña.
      </p>
    )
  }
  return (
    <div className="flex flex-col items-center gap-2">
      {/* color-scheme claro: así el iframe del botón de Google no dibuja un marco blanco sobre el fondo oscuro */}
      <div ref={holder} style={{ colorScheme: 'light' }} className="w-full flex justify-center min-h-[44px]" aria-label={label} />
      {state === 'loading' && <p className="text-muted/60 text-xs">Cargando Google…</p>}
    </div>
  )
}
