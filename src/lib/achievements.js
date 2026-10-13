import { todayStr } from './library'
import { tt } from './i18n'

const dayNum = (s) => { const [y, m, d] = s.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000) }

/**
 * Racha de días viendo algo. Puro.
 * La racha sigue viva si viste hoy o ayer (todavía tenés hasta el final del día para sumar hoy).
 */
export const computeStreak = (days = [], today = todayStr()) => {
  if (!days.length) return { current: 0, best: 0, activeToday: false }
  const nums = [...new Set(days.map(dayNum))].sort((a, b) => a - b)
  let best = 1
  let run = 1
  for (let i = 1; i < nums.length; i++) {
    run = nums[i] === nums[i - 1] + 1 ? run + 1 : 1
    if (run > best) best = run
  }
  const t = dayNum(today)
  const last = nums[nums.length - 1]
  const activeToday = last === t
  let current = 0
  if (last === t || last === t - 1) {
    current = 1
    for (let i = nums.length - 2; i >= 0 && nums[i] === nums[i + 1] - 1; i--) current += 1
  }
  return { current, best, activeToday }
}

const maxInOneDay = (daily = {}) => Math.max(0, ...Object.values(daily).map((v) => v.length))

// value() devuelve el progreso actual; done = value >= target
const DEFS = [
  { id: 'first',     icon: '🎬', title: tt("Primera función"),   desc: tt("Mirá tu primer título"),                  target: 1,   value: (l) => Object.keys(l.seen).length },
  { id: 'cinefilo',  icon: '🍿', title: tt("Cinéfilo"),          desc: tt("Mirá 10 títulos distintos"),              target: 10,  value: (l) => Object.keys(l.seen).length },
  { id: 'devorador', icon: '🏆', title: 'Devorador',         desc: tt("Mirá 50 títulos distintos"),              target: 50,  value: (l) => Object.keys(l.seen).length },
  { id: 'racha3',    icon: '🔥', title: tt("En racha"),          desc: tt("3 días seguidos viendo algo"),            target: 3,   value: (l, c) => c.streak.best },
  { id: 'racha7',    icon: '⚡', title: tt("Semana completa"),   desc: tt("7 días seguidos viendo algo"),            target: 7,   value: (l, c) => c.streak.best },
  { id: 'racha30',   icon: '👑', title: 'Imparable',         desc: tt("30 días seguidos viendo algo"),           target: 30,  value: (l, c) => c.streak.best },
  { id: 'maraton',   icon: '🛋️', title: 'Maratonista',       desc: tt("3 episodios o películas en un mismo día"), target: 3,   value: (l) => maxInOneDay(l.daily) },
  { id: 'explorador',icon: '🧭', title: 'Explorador',        desc: tt("Mirá títulos de 5 géneros distintos"),    target: 5,   value: (l) => Object.keys(l.genres).length },
  { id: 'horas10',   icon: '⏱️', title: tt("10 horas de cine"),  desc: tt("Sumá 10 horas reproducidas"),             target: 600, value: (l) => Math.floor(l.minutes), unit: 'min' },
  { id: 'coleccion', icon: '📚', title: 'Coleccionista',     desc: tt("Guardá 10 títulos en Mi lista"),          target: 10,  value: (l) => l.list.length },
  { id: 'aviso',     icon: '🔔', title: tt("Estreno asegurado"), desc: tt("Pedí un aviso de estreno"),               target: 1,   value: (l) => l.reminders.length },
]

export const computeAchievements = (lib, today = todayStr()) => {
  const ctx = { streak: computeStreak(lib.days, today) }
  return DEFS.map((d) => {
    const value = Math.min(d.value(lib, ctx), d.target)
    return { id: d.id, icon: d.icon, title: d.title, desc: d.desc, target: d.target, unit: d.unit, value, done: value >= d.target }
  })
}

/** IDs desbloqueados que todavía no le mostramos al usuario. */
export const newlyUnlocked = (lib, today = todayStr()) =>
  computeAchievements(lib, today).filter((a) => a.done && !lib.achSeen.includes(a.id))
