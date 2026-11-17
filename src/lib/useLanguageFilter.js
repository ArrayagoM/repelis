import { useState, useEffect, useMemo } from 'react'
import { getLanguageMode, subscribeLanguageMode, filterResultsByMode } from './languageMode'

/**
 * Hook que aplica el filtro de idioma activo a una lista de resultados.
 * Re-renderiza automáticamente cuando el usuario cambia el modo.
 */
export const useLanguageFilter = (results = [], options) => {
  const lenient = !!options?.lenient
  const [mode, setMode] = useState(getLanguageMode())
  useEffect(() => subscribeLanguageMode(setMode), [])
  return useMemo(() => filterResultsByMode(results, mode, { lenient }), [results, mode, lenient])
}

/**
 * Hook que devuelve el modo activo (reactivo).
 */
export const useCurrentLanguageMode = () => {
  const [mode, setMode] = useState(getLanguageMode())
  useEffect(() => subscribeLanguageMode(setMode), [])
  return mode
}
