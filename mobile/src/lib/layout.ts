import { Platform, useWindowDimensions } from 'react-native'

export interface Layout {
  width: number
  height: number
  isTV: boolean
  isTablet: boolean
  isLandscape: boolean
  /** padding horizontal del contenido */
  gutter: number
  /** columnas de las grillas de pósters */
  columns: number
  /** ancho de un póster dentro de una fila horizontal */
  rowPosterWidth: number
}

// Breakpoints puros (testeables) — celular < 600dp < tablet < TV.
export const computeLayout = (width: number, height: number, isTV: boolean): Layout => {
  const shortSide = Math.min(width, height)
  const isTablet = !isTV && shortSide >= 600
  const gutter = isTV ? 56 : isTablet ? 32 : 16

  let columns = 3
  if (width >= 1500) columns = 8
  else if (width >= 1200) columns = 7
  else if (width >= 900) columns = 6
  else if (width >= 600) columns = 5
  else if (width >= 420) columns = 4

  const rowPosterWidth = isTV ? 200 : isTablet ? 160 : Math.max(104, Math.min(140, Math.round(width * 0.3)))

  return { width, height, isTV, isTablet, isLandscape: width > height, gutter, columns, rowPosterWidth }
}

export const useLayout = (): Layout => {
  const { width, height } = useWindowDimensions()
  return computeLayout(width, height, Platform.isTV)
}
