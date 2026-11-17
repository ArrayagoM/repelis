import { tt } from './i18n'
// Temporadas del año: Halloween ("Sesión de terror") y Navidad ("Navidad en Life High").
// Funciones puras (reciben la fecha) para poder probarlas.

/** Del 25 de septiembre al 2 de noviembre (ambos incluidos). */
export const isHalloweenSeason = (d = new Date()) => {
  const m = d.getMonth(), day = d.getDate()
  return (m === 8 && day >= 25) || m === 9 || (m === 10 && day <= 2)
}

/** Días que faltan para el 31 de octubre (0 = hoy es Halloween, negativo = ya pasó este año). */
export const daysToHalloween = (d = new Date()) => {
  const today = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  const target = Date.UTC(d.getFullYear(), 9, 31)
  return Math.round((target - today) / 86400000)
}

export const halloweenCountdown = (d = new Date()) => {
  const n = daysToHalloween(d)
  if (n > 1) return tt("Faltan {n} días para Halloween", { n: n })
  if (n === 1) return tt("Mañana es Halloween")
  if (n === 0) return tt("Hoy es Halloween")
  return tt("Halloween ya pasó, pero el terror no se va")
}

/** Del 15 de noviembre al 6 de enero (Reyes), ambos incluidos. */
export const isChristmasSeason = (d = new Date()) => {
  const m = d.getMonth(), day = d.getDate()
  return (m === 10 && day >= 15) || m === 11 || (m === 0 && day <= 6)
}

/** Días que faltan para el 25 de diciembre (0 = hoy es Navidad, negativo = ya pasó). En enero cuenta desde la Navidad anterior. */
export const daysToChristmas = (d = new Date()) => {
  const today = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  const year = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear()
  return Math.round((Date.UTC(year, 11, 25) - today) / 86400000)
}

export const christmasCountdown = (d = new Date()) => {
  const n = daysToChristmas(d)
  if (n > 1) return tt("Faltan {n} días para Navidad", { n: n })
  if (n === 1) return tt("Mañana es Navidad")
  if (n === 0) return tt("Hoy es Navidad")
  return tt("Felices fiestas")
}
