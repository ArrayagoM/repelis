import { getItem, setItem } from '@/lib/storage'

// Misma línea de tiempo que la intro web: el golpe grave del sonido cae en 1000 ms.
export const INTRO_HIT_MS = 1000
export const INTRO_TOTAL_MS = 3100
export const INTRO_FADE_OUT_MS = 450

const SOUND_KEY = 'repelis:introSound:v1'

export const loadIntroSoundEnabled = async (): Promise<boolean> => (await getItem(SOUND_KEY)) !== '0'
export const saveIntroSoundEnabled = (enabled: boolean) => setItem(SOUND_KEY, enabled ? '1' : '0')

// La intro se muestra una sola vez por arranque de la app (no al volver de segundo plano).
let shown = false
export const shouldShowIntro = (): boolean => {
  if (shown) return false
  shown = true
  return true
}
