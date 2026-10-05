import { todayStr } from './library'

const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const parts = (s) => s.split('-').map(Number)
const addDays = (s, n) => { const [y, m, d] = parts(s); return todayStr(new Date(y, m - 1, d + n)) }

/** "Hoy", "Mañana" o "Viernes 9 de octubre". */
export const dayLabel = (dateStr, today = todayStr()) => {
  if (dateStr === today) return 'Hoy'
  if (dateStr === addDays(today, 1)) return 'Mañana'
  const [y, m, d] = parts(dateStr)
  const dow = DAYS[new Date(y, m - 1, d).getDay()]
  return `${dow[0].toUpperCase()}${dow.slice(1)} ${d} de ${MONTHS[m - 1]}`
}

/**
 * Agrupa estrenos por fecha (ascendente). Puro.
 * Dentro de cada día conserva el orden recibido (popularidad).
 * items: [{ date: 'YYYY-MM-DD', ... }]
 */
export const groupByDate = (items, today = todayStr()) => {
  const map = new Map()
  for (const it of items) {
    if (!it.date || it.date < today) continue
    if (!map.has(it.date)) map.set(it.date, [])
    map.get(it.date).push(it)
  }
  return [...map.keys()].sort().map((date) => ({ date, label: dayLabel(date, today), items: map.get(date) }))
}
