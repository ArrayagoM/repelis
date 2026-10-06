// Temporadas del año: hoy, la de Halloween ("Sesión de terror").
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
  if (n > 1) return `Faltan ${n} días para Halloween`
  if (n === 1) return 'Mañana es Halloween'
  if (n === 0) return 'Hoy es Halloween'
  return 'Halloween ya pasó, pero el terror no se va'
}
