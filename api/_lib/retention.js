// Retención de cuentas: cuánta gente VUELVE después de registrarse. Puro (sin red) para poder probarlo.
// Un usuario "está activo" un día si ese día abrió la app con su cuenta (guardamos solo la lista de días, sin horas ni páginas).
import { dayKey } from './pulse.js'

const DAY = 86400000
export const SEEN_DAYS_KEEP = 120
export const RETURN_WINDOWS = [1, 7, 30]

/** Agrega `today` a la lista de días vistos (sin repetir, ordenada, acotada). Devuelve null si no hay nada que cambiar. */
export const withSeenDay = (user, today) => {
  if (user.lastSeenDay === today) return null
  const days = Array.isArray(user.seenDays) ? user.seenDays : []
  if (days.includes(today)) return { lastSeenDay: today, seenDays: days }
  return { lastSeenDay: today, seenDays: [...days, today].sort().slice(-SEEN_DAYS_KEEP) }
}

const dayNum = (key) => Math.floor(Date.parse(`${key}T00:00:00Z`) / DAY)
const pct = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null)

/** ¿Volvió dentro de los N días siguientes al de su registro? (cualquier día visto en (registro, registro+N]) */
const returnedWithin = (u, n) => {
  const start = dayNum(dayKey(u.createdAt))
  return (u.seenDays || []).some((d) => { const k = dayNum(d) - start; return k >= 1 && k <= n })
}
/** Ya pasaron N días completos desde el registro (si no, todavía no se puede saber si vuelve). */
const mature = (u, n, today) => dayNum(today) - dayNum(dayKey(u.createdAt)) >= n

const weekStart = (ms) => {
  const d = new Date(dayKey(ms) + 'T00:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7          // lunes = 0
  return new Date(d.getTime() - dow * DAY).toISOString().slice(0, 10)
}

/**
 * @param {{createdAt:number, seenDays?:string[]}[]} users  (sin el fundador)
 * @returns {{ activity, returned, cohorts, users }}
 */
export const computeRetention = (users, now, { weeks = 8 } = {}) => {
  const today = dayKey(now)
  const t = dayNum(today)
  const activeWithin = (u, days) => (u.seenDays || []).some((d) => { const k = t - dayNum(d); return k >= 0 && k < days })
  const dau = users.filter((u) => activeWithin(u, 1)).length
  const wau = users.filter((u) => activeWithin(u, 7)).length
  const mau = users.filter((u) => activeWithin(u, 30)).length

  const returned = RETURN_WINDOWS.map((n) => {
    const eligible = users.filter((u) => mature(u, n, today))
    const back = eligible.filter((u) => returnedWithin(u, n)).length
    return { days: n, eligible: eligible.length, returned: back, pct: pct(back, eligible.length) }
  })

  const byWeek = new Map()
  for (const u of users) {
    const w = weekStart(u.createdAt)
    if (!byWeek.has(w)) byWeek.set(w, [])
    byWeek.get(w).push(u)
  }
  const cohorts = [...byWeek.keys()].sort().slice(-weeks).reverse().map((w) => {
    const list = byWeek.get(w)
    const row = { week: w, size: list.length }
    for (const n of RETURN_WINDOWS) {
      const elig = list.filter((u) => mature(u, n, today))
      row[`d${n}`] = { eligible: elig.length, pct: pct(elig.filter((u) => returnedWithin(u, n)).length, elig.length) }
    }
    return row
  })

  return {
    activity: { dau, wau, mau, stickiness: pct(dau, mau) },
    returned, cohorts, users: users.length,
  }
}
