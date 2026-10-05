import { dayLabel } from './calendar'
import { todayStr } from './library'

const pad = (n) => String(n).padStart(2, '0')
const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); return todayStr(new Date(y, m - 1, d + n)) }

/** Próximos 7 días para elegir: [{ value: 'YYYY-MM-DD', label: 'Hoy' | 'Mañana' | 'Sábado 10 de octubre' }]. */
export const dayOptions = (today = todayStr()) =>
  Array.from({ length: 7 }, (_, i) => { const value = addDays(today, i); return { value, label: dayLabel(value, today) } })

/** Día sugerido: hoy si todavía es temprano, si no mañana. */
export const defaultDay = (now = new Date()) => (now.getHours() < 20 ? todayStr(now) : addDays(todayStr(now), 1))

/** 'YYYY-MM-DD' + 'HH:MM' → Date local (o null si es inválido). */
export const parseWhen = (dateStr, timeStr) => {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr))
  const tm = /^(\d{1,2}):(\d{2})$/.exec(String(timeStr))
  if (!dm || !tm) return null
  const d = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), Number(tm[1]), Number(tm[2]))
  return Number.isNaN(d.getTime()) ? null : d
}

/** Texto para mandar por WhatsApp/Telegram. */
export const buildInviteMessage = ({ title, when, url, today = todayStr() }) => {
  const day = dayLabel(todayStr(when), today)
  const dayText = day === 'Hoy' ? 'hoy' : day === 'Mañana' ? 'mañana' : `el ${day.toLowerCase()}`
  const time = `${pad(when.getHours())}:${pad(when.getMinutes())}`
  return `🍿 ¿Vemos "${title}" juntos ${dayText} a las ${time}? Entrá desde acá y dale play a la misma hora: ${url}`
}
