// ─────────────────────────────────────────────────────────────────────────
// Donaciones sin ser molestos:
//  · el pedido aparece DESPUÉS de ver algo, nunca antes de reproducir
//  · máximo 1 vez por semana (1 por mes si lo descartó 3 veces)
//  · quien dice "Ya doné" es Supporter: no vuelve a ver pedidos y recibe un agradecimiento mensual
//
// "Ya doné" funciona por confianza: no hay forma de verificar un aporte de Cafecito/Mercado Pago
// desde el navegador, y lo único que se desbloquea es quitar los pedidos y una insignia.
// ─────────────────────────────────────────────────────────────────────────
import { useSyncExternalStore } from 'react'

const KEY = 'lifehigh:donations:v1'
const DAY = 86400000

export const MIN_WATCH_SECONDS = 20 * 60        // "vio algo": 20 min en la sesión
export const PROMPT_EVERY_MS = 7 * DAY
export const PROMPT_EVERY_MS_ANNOYED = 30 * DAY
export const ANNOYED_AFTER = 3                  // descartes seguidos

const empty = () => ({ supporterSince: null, lastPromptAt: 0, dismissals: 0, lastThanksMonth: '' })

const read = () => {
  try { return { ...empty(), ...(JSON.parse(localStorage.getItem(KEY) || 'null') || {}) } } catch { return empty() }
}

let state = read()
const listeners = new Set()
const commit = (next) => {
  state = next
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* sin storage */ }
  listeners.forEach((fn) => fn())
}

export const getDonations = () => state
export const subscribeDonations = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }
export const useDonations = () => useSyncExternalStore(subscribeDonations, getDonations, getDonations)
export const reloadDonations = () => { state = read(); listeners.forEach((fn) => fn()) }

export const isSupporter = (s = state) => !!s.supporterSince

export const markSupporter = () => commit({ ...state, supporterSince: state.supporterSince || Date.now(), dismissals: 0 })
export const unmarkSupporter = () => commit({ ...state, supporterSince: null })
/** Al iniciar sesión: conserva la fecha de Supporter más antigua entre el dispositivo y la cuenta. */
export const adoptSupporterSince = (ts) => {
  const t = Number(ts)
  if (!Number.isFinite(t) || t <= 0) return
  if (!state.supporterSince || t < state.supporterSince) commit({ ...state, supporterSince: t, dismissals: 0 })
}

/** ¿Mostramos el pedido tras esta sesión de reproducción? Puro. */
export const shouldShowPrompt = ({ seconds, state: s = state, now = Date.now() }) => {
  if (isSupporter(s)) return false
  if (seconds < MIN_WATCH_SECONDS) return false
  const every = s.dismissals >= ANNOYED_AFTER ? PROMPT_EVERY_MS_ANNOYED : PROMPT_EVERY_MS
  return now - (s.lastPromptAt || 0) >= every
}

export const recordPromptShown = () => commit({ ...state, lastPromptAt: Date.now() })
export const recordPromptDismissed = () => commit({ ...state, lastPromptAt: Date.now(), dismissals: state.dismissals + 1 })
/** Tocó "Donar": cuenta como atendido (no insistimos pronto) y reinicia los descartes. */
export const recordPromptDonate = () => commit({ ...state, lastPromptAt: Date.now(), dismissals: 0 })

// ─── Agradecimiento mensual ─────────────────────────────────────────────
export const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
export const shouldThank = (s = state, d = new Date()) => isSupporter(s) && s.lastThanksMonth !== monthKey(d)
export const recordThanks = (d = new Date()) => commit({ ...state, lastThanksMonth: monthKey(d) })

// ─── Meta del mes (public/donation-goal.json) ───────────────────────────
/**
 * Formato:
 * { "month": "2026-10", "currency": "USD", "goal": 30, "raised": 12,
 *   "costs": [ { "label": "Dominio lifehigh.site", "amount": 2 }, ... ] }
 * Devuelve null si el archivo no sirve o no hay meta (en ese caso la UI no muestra nada).
 */
export const parseGoal = (raw) => {
  if (!raw || typeof raw !== 'object') return null
  const goal = Number(raw.goal)
  if (!Number.isFinite(goal) || goal <= 0) return null
  const raised = Math.max(0, Number(raw.raised) || 0)
  const costs = (Array.isArray(raw.costs) ? raw.costs : [])
    .filter((c) => c && c.label && Number.isFinite(Number(c.amount)) && Number(c.amount) > 0)
    .map((c) => ({ label: String(c.label), amount: Number(c.amount), note: c.note ? String(c.note) : '' }))
  return {
    month: String(raw.month || ''),
    currency: String(raw.currency || 'USD').toUpperCase(),
    goal,
    raised,
    costs,
    percent: Math.min(100, Math.round((raised / goal) * 100)),
  }
}

export const formatMoney = (amount, currency = 'USD') => {
  try { return new Intl.NumberFormat('es-AR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount) } catch { return `${currency} ${amount}` }
}

export const loadGoal = async () => {
  try {
    const res = await fetch('/donation-goal.json', { cache: 'no-store' })
    if (!res.ok) return null
    // Con el rewrite SPA, un archivo inexistente devuelve index.html: parseGoal lo descarta
    return parseGoal(await res.json())
  } catch { return null }
}
