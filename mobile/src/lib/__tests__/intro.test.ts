import { INTRO_HIT_MS, INTRO_TOTAL_MS, loadIntroSoundEnabled, saveIntroSoundEnabled, shouldShowIntro } from '@/lib/intro'

describe('intro', () => {
  it('se muestra una sola vez por arranque', () => {
    expect(shouldShowIntro()).toBe(true)
    expect(shouldShowIntro()).toBe(false)
  })

  it('el sonido viene activado y se puede apagar', async () => {
    expect(await loadIntroSoundEnabled()).toBe(true)
    await saveIntroSoundEnabled(false)
    expect(await loadIntroSoundEnabled()).toBe(false)
    await saveIntroSoundEnabled(true)
    expect(await loadIntroSoundEnabled()).toBe(true)
  })

  it('el golpe cae dentro de la duración total', () => {
    expect(INTRO_HIT_MS).toBeLessThan(INTRO_TOTAL_MS)
  })
})
