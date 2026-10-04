import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getItem, setItem } from '@/lib/storage'
import { DEFAULT_MODE, isLanguageMode, type LanguageMode } from '@/lib/languageMode'

const STORAGE_KEY = 'repelis:langMode:v1'

interface Ctx {
  mode: LanguageMode
  setMode: (m: LanguageMode) => void
}

const LanguageContext = createContext<Ctx>({ mode: DEFAULT_MODE, setMode: () => {} })

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<LanguageMode>(DEFAULT_MODE)

  useEffect(() => {
    getItem(STORAGE_KEY).then((v) => {
      if (isLanguageMode(v)) setModeState(v)
    })
  }, [])

  const setMode = useCallback((m: LanguageMode) => {
    setModeState(m)
    setItem(STORAGE_KEY, m)
  }, [])

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export const useLanguageMode = () => useContext(LanguageContext)
