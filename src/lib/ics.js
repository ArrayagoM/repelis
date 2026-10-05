// Generador de archivos .ics (calendario) — funciona en Google Calendar, Apple Calendar, Outlook.
// Sirve para "Avisame cuando salga" y "Ver juntos": el aviso lo da el calendario del propio teléfono.

const esc = (s = '') => String(s)
  .replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')

// RFC 5545: líneas de máx. 75 octetos; las largas se pliegan con CRLF + espacio.
const fold = (line) => {
  const out = []
  let cur = ''
  let bytes = 0
  for (const ch of line) {
    const b = new TextEncoder().encode(ch).length
    if (bytes + b > 74) { out.push(cur); cur = ' ' + ch; bytes = 1 + b } else { cur += ch; bytes += b }
  }
  out.push(cur)
  return out.join('\r\n')
}

const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
const ymdhms = (d) => `${ymd(d)}T${pad(d.getHours())}${pad(d.getMinutes())}00`
const utcStamp = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`

/**
 * @param {{ uid: string, title: string, description?: string, url?: string,
 *           date?: string,      // 'YYYY-MM-DD' → evento de día completo con alarma a las 9:00
 *           start?: Date, durationMin?: number,  // evento con horario
 *           alarmMinBefore?: number }} ev
 */
export const buildIcs = (ev) => {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Life High//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${esc(ev.uid)}@lifehigh`,
    `DTSTAMP:${utcStamp(new Date())}`,
  ]

  if (ev.start instanceof Date) {
    const end = new Date(ev.start.getTime() + (ev.durationMin || 120) * 60000)
    lines.push(`DTSTART:${ymdhms(ev.start)}`, `DTEND:${ymdhms(end)}`)
  } else {
    const [y, m, d] = String(ev.date).split('-').map(Number)
    const day = new Date(y, m - 1, d)
    const next = new Date(y, m - 1, d + 1)
    lines.push(`DTSTART;VALUE=DATE:${ymd(day)}`, `DTEND;VALUE=DATE:${ymd(next)}`)
  }

  lines.push(`SUMMARY:${esc(ev.title)}`)
  const desc = [ev.description, ev.url].filter(Boolean).join('\n')
  if (desc) lines.push(`DESCRIPTION:${esc(desc)}`)
  if (ev.url) lines.push(`URL:${esc(ev.url)}`)

  lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(ev.title)}`)
  if (ev.start instanceof Date) lines.push(`TRIGGER:-PT${ev.alarmMinBefore ?? 15}M`)
  else lines.push('TRIGGER:PT9H') // día completo: 9:00 del día del estreno
  lines.push('END:VALARM', 'END:VEVENT', 'END:VCALENDAR')

  return lines.map(fold).join('\r\n') + '\r\n'
}

/** Descarga el .ics (en iOS/Android abre directo "Agregar al calendario"). */
export const downloadIcs = (filename, content) => {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
