import { Platform } from 'react-native'
import { getItem, setItem } from '@/lib/storage'
import { SITE_URL } from '@/lib/site'

// "Latido" anónimo de estadísticas (mismo protocolo que la web, src/lib/pulse.js):
//  · el id de visitante es aleatorio y CAMBIA CADA DÍA;
//  · no viaja mail, IP ni nombre: de la cuenta solo "es miembro: sí/no";
//  · el tiempo de visualización lo calcula el servidor entre latidos.

const SID_KEY = 'lifehigh:sid:v1'

export type PulsePlatform = 'android-app' | 'ios-app' | 'tv' | 'web'

export const detectPlatform = (): PulsePlatform => {
  if (Platform.OS === 'web') return 'web'
  if ((Platform as { isTV?: boolean }).isTV) return 'tv'
  return Platform.OS === 'ios' ? 'ios-app' : 'android-app'
}

export const randomId = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  let out = ''
  for (let i = 0; i < 24; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

const localDay = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`

let memorySid: { day: string; id: string } | null = null
/** Id de visitante de HOY. */
export const getSid = async (now = new Date()): Promise<string> => {
  const today = localDay(now)
  if (memorySid?.day === today) return memorySid.id
  try {
    const saved = JSON.parse((await getItem(SID_KEY)) || 'null')
    if (saved?.day === today && typeof saved.id === 'string') { memorySid = saved; return saved.id }
  } catch { /* se genera uno nuevo */ }
  memorySid = { day: today, id: randomId() }
  await setItem(SID_KEY, JSON.stringify(memorySid))
  return memorySid.id
}

/** Ruta de la app → categoría (nunca se manda la ruta completa). */
export const pageGroup = (pathname = '/'): string | null => {
  const p = String(pathname).split(/[?#]/)[0] || '/'
  if (p === '/' || p === '/index') return 'home'
  if (p.startsWith('/title/')) return p.includes('/tv/') ? 'tv' : 'movie'
  if (p.startsWith('/player/')) return p.includes('/tv/') ? 'tv' : 'movie'
  if (p === '/search') return 'search'
  if (p === '/more') return 'cuenta'
  return 'catalog'                                  // películas, series…
}

export interface Watching { key: string; title: string }
let watching: Watching | null = null
const watchers = new Set<(w: Watching | null) => void>()
export const setWatching = (w: Watching | null) => {
  const same = (!w && !watching) || (!!w && !!watching && w.key === watching.key)
  watching = w
  if (!same) watchers.forEach((fn) => fn(watching))
}
export const subscribeWatching = (fn: (w: Watching | null) => void) => { watchers.add(fn); return () => { watchers.delete(fn) } }
export const getWatching = () => watching

const post = (payload: object) =>
  fetch(`${SITE_URL}/api/pulse`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })

let enabled = true
/** Manda un latido. Si el servidor pide dejar de medir (estadísticas apagadas), se corta hasta reiniciar la app. */
export const sendHeartbeat = async (page: string | null, member: boolean, nav = false): Promise<void> => {
  if (!enabled || !page) return
  try {
    const w = getWatching()
    const res = await post({ k: 'hb', sid: await getSid(), page, nav, member, plat: detectPlatform(), ...(w ? { w } : {}) })
    if (res.status === 204 || res.status === 503 || res.status === 404) enabled = false
  } catch { /* sin conexión: no pasa nada */ }
}
