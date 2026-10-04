import type { MediaItem } from '@/api/types'

// Misma lógica que src/lib/languageMode.js de la web.
//   strict → solo producciones originales en español
//   broad  → cine hispano + estrenos populares con doblaje LATAM probable
//   all    → catálogo completo
export type LanguageMode = 'strict' | 'broad' | 'all'

export const LANGUAGE_MODES: LanguageMode[] = ['strict', 'broad', 'all']
export const DEFAULT_MODE: LanguageMode = 'broad'

export const MODE_LABELS: Record<LanguageMode, string> = {
  strict: 'Solo hispano',
  broad: 'Doblado LATAM',
  all: 'Todo el catálogo',
}

export const MODE_DESCRIPTIONS: Record<LanguageMode, string> = {
  strict: 'Solo películas y series producidas originalmente en español. Catálogo más chico pero 100% en español.',
  broad: 'Cine hispano + estrenos populares con doblaje LATAM probable. Recomendado.',
  all: 'Catálogo completo en idioma original. El audio depende del servidor de reproducción.',
}

const LATAM_COUNTRIES = 'MX|AR|CO|CL|PE|VE|UY|EC|BO|PY|ES'
const LATAM_SET = new Set(LATAM_COUNTRIES.split('|'))

export const isLanguageMode = (v: unknown): v is LanguageMode =>
  typeof v === 'string' && (LANGUAGE_MODES as string[]).includes(v)

export const getDiscoverParamsForMode = (mode: LanguageMode): Record<string, string> => {
  if (mode === 'strict') return { with_original_language: 'es' }
  if (mode === 'broad') return { with_origin_country: LATAM_COUNTRIES }
  return {}
}

export const filterResultsByMode = <T extends MediaItem>(results: T[], mode: LanguageMode): T[] => {
  if (mode === 'all' || results.length === 0) return results
  if (mode === 'strict') return results.filter((r) => r.original_language === 'es')
  return results.filter((r) => {
    if (r.original_language === 'es') return true
    if (r.origin_country?.some((c) => LATAM_SET.has(c))) return true
    return (r.popularity ?? 0) > 50 && r.original_language === 'en'
  })
}
