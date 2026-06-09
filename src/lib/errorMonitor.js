// ─────────────────────────────────────────────────────────────────────────
// Error monitor liviano sin deps.
// - Captura window.error, unhandledrejection y errores explícitos via track().
// - Mantiene los últimos N en memoria + localStorage (rotación).
// - Expone subscribe() para que la UI muestre una barra cuando hay errores.
// ─────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'repelis:errors:v1'
const MAX_ERRORS = 20

let _listeners = new Set()
let _errors = []

const persist = () => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_errors)) } catch {}
}

const hydrate = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) _errors = JSON.parse(raw) || []
  } catch {}
}

const notify = () => { _listeners.forEach((fn) => { try { fn(_errors) } catch {} }) }

export const track = (scope, error, meta = {}) => {
  const entry = {
    scope,
    message: String(error?.message ?? error),
    stack:   error?.stack ? String(error.stack).split('\n').slice(0, 5).join('\n') : null,
    meta,
    ts: Date.now(),
  }
  _errors = [entry, ..._errors].slice(0, MAX_ERRORS)
  persist()
  notify()

  if (typeof console !== 'undefined') {
    console.warn(`[${scope}]`, entry.message, meta)
  }
}

export const subscribe = (fn) => {
  _listeners.add(fn)
  fn(_errors)
  return () => _listeners.delete(fn)
}

export const clearErrors = () => {
  _errors = []
  persist()
  notify()
}

export const getErrors = () => [..._errors]

export const installGlobalHandlers = () => {
  if (typeof window === 'undefined') return
  hydrate()

  window.addEventListener('error', (e) => {
    track('window.error', e.error || e.message, { filename: e.filename, line: e.lineno })
  })

  window.addEventListener('unhandledrejection', (e) => {
    track('promise.rejection', e.reason, {})
  })
}
