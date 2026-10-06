// Cliente de la comunidad (perfiles, listas, likes, seguir). Ver api/_lib/socialApi.js.
import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { useAuth, whenAuthSettled } from './auth'
import { requestAccount } from './accountPrompt'
import { socialErrorMessage } from './socialRules'
import { pulseEvent } from './pulse'

const BASE = '/api/social'

const request = async (action, { method = 'GET', body, query } = {}) => {
  const qs = query ? `?${new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null)).toString()}` : ''
  try {
    const res = await fetch(`${BASE}/${action}${qs}`, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    let data = {}
    try { data = await res.json() } catch { /* sin cuerpo */ }
    return { ok: res.ok, status: res.status, data, error: res.ok ? null : (data.error || 'server_error') }
  } catch {
    return { ok: false, status: 0, data: {}, error: 'network' }
  }
}

export const errorText = (code) => (code === 'network' ? 'No pudimos conectarnos. Revisá tu internet.' : socialErrorMessage(code))

export const social = {
  feed: (kind) => request('feed', { query: { kind } }),
  profile: (handle) => request('profile', { query: { handle } }),
  me: () => request('me'),
  saveProfile: (body) => request('profile', { method: 'POST', body }),
  list: (id) => request('list', { query: { id } }),
  saveList: async (body) => {
    const r = await request('list', { method: 'POST', body })
    if (r.ok && !body.id) pulseEvent('list_created')
    return r
  },
  addToList: (id, item) => request('list-add', { method: 'POST', body: { id, item } }),
  deleteList: (id) => request('list-delete', { method: 'POST', body: { id } }),
  like: async (id, on) => {
    const r = await request('like', { method: 'POST', body: { id, on } })
    if (r.ok && on) pulseEvent('list_liked')
    return r
  },
  follow: async (handle, on) => {
    const r = await request('follow', { method: 'POST', body: { handle, on } })
    if (r.ok && on) pulseEvent('followed')
    return r
  },
  report: (id, reason) => request('report', { method: 'POST', body: { id, reason } }),
  comments: (target, before) => request('comments', { query: { target, before } }),
  postComment: async (body) => {
    const r = await request('comment', { method: 'POST', body })
    if (r.ok && !r.data.updated) pulseEvent('comment_created')
    return r
  },
  deleteComment: (id) => request('comment-delete', { method: 'POST', body: { id } }),
  reportComment: (id, reason) => request('comment-report', { method: 'POST', body: { id, reason } }),
}

// ─── Mi perfil y mis listas (cacheado, se refresca al cambiar algo) ─────
let meState = { loaded: false, loading: false, data: null }
const meListeners = new Set()
const setMe = (patch) => { meState = { ...meState, ...patch }; meListeners.forEach((fn) => fn()) }

export const refreshMe = async () => {
  setMe({ loading: true })
  const r = await social.me()
  setMe({ loading: false, loaded: true, data: r.ok ? r.data : null })
  return r
}
export const clearMe = () => setMe({ loaded: false, loading: false, data: null })
export const useMe = () => {
  const snap = useSyncExternalStore((fn) => { meListeners.add(fn); return () => meListeners.delete(fn) }, () => meState, () => meState)
  const { status } = useAuth()
  const reload = useCallback(() => refreshMe(), [])
  useEffect(() => {
    if (status === 'in' && !snap.loaded && !snap.loading) refreshMe()
    if (status === 'out' && snap.loaded) clearMe()
  }, [status, snap.loaded, snap.loading])
  return { ...snap, reload }
}

/**
 * Para botones que necesitan cuenta (like, seguir, crear): devuelve una función que
 * (1) espera a saber si hay sesión, (2) si no hay, muestra el pedido de cuenta y devuelve false.
 */
export const ensureAccount = async (title = '') => {
  const status = await whenAuthSettled()
  if (status === 'in') return true
  requestAccount({ reason: 'social', title })
  return false
}
