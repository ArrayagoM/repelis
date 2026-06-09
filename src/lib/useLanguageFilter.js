import { useState, useEffect, useMemo } from 'react'
import { getLanguageMode, subscribeLanguageMode, filterResultsByMode } from './languageMode'

/**
 * Hook que aplica el filtro de idioma activo a una lista de resultados.
 * Re-renderiza automáticamente cuando el usuario cambia el modo.
 */
export const useLanguageFilter = (results = []) => {
  const [mode, setMode] = useState(getLanguageMode())
  useEffect(() => subscribeLanguageMode(setMode), [])
  return useMemo(() => filterResultsByMode(results, mode), [results, mode])
}

/**
 * Hook que devuelve el modo activo (reactivo).
 */
export const useCurrentLanguageMode = () => {
  const [mode, setMode] = useState(getLanguageMode())
  useEffect(() => subscribeLanguageMode(setMode), [])
  return mode
}
