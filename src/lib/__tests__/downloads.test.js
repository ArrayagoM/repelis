import { describe, it, expect } from 'vitest'
import { DOWNLOADS, detectPlatform, recommendedFor, downloadsFor, RELEASE_BASE } from '../downloads'

describe('downloads', () => {
  it('ids únicos y urls https estables', () => {
    const ids = DOWNLOADS.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const d of DOWNLOADS) {
      expect(d.url).toMatch(/^https:\/\/github\.com\/ArrayagoM\/repelis\/releases\/download\//)
      expect(d.url.endsWith(d.file)).toBe(true)
    }
  })

  it('cubre Android, TV, iOS, Windows, Mac y Linux', () => {
    const platforms = new Set(DOWNLOADS.map((d) => d.platform))
    for (const p of ['android', 'tv', 'ios', 'windows', 'mac', 'linux']) expect(platforms.has(p)).toBe(true)
  })

  it('los nombres coinciden con los que publica el workflow', () => {
    const files = DOWNLOADS.filter((d) => d.url.startsWith(RELEASE_BASE)).map((d) => d.file).sort()
    expect(files).toEqual([
      'LifeHigh-Setup-windows-x64.exe',
      'LifeHigh-linux-x86_64.AppImage',
      'LifeHigh-mac-arm64.dmg',
      'LifeHigh-mac-x64.dmg',
      'lifehigh-android-tv.apk',
      'lifehigh-android.apk',
      'lifehigh-ios.ipa',
    ])
  })

  describe('detectPlatform', () => {
    it('Android celular', () => {
      expect(detectPlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36')).toBe('android')
    })
    it('proyector o TV box Android sin pantalla táctil', () => {
      expect(detectPlatform('Mozilla/5.0 (Linux; Android 9; Projector) AppleWebKit/537.36 Chrome/120 Safari/537.36', 0)).toBe('tv')
      expect(detectPlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36', 5)).toBe('android')
    })
    it('Android TV / Fire TV', () => {
      expect(detectPlatform('Mozilla/5.0 (Linux; Android 11; AFTMM Build/RS) AppleWebKit/537.36 Chrome/114 Safari/537.36')).toBe('tv')
      expect(detectPlatform('Mozilla/5.0 (Linux; Android 12; BRAVIA 4K GB) AppleWebKit/537.36 Chrome/120 Safari/537.36')).toBe('tv')
    })
    it('iPhone, iPad y iPadOS que se hace pasar por Mac', () => {
      expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15')).toBe('ios')
      expect(detectPlatform('Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15')).toBe('ios')
      expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 5)).toBe('ios')
    })
    it('Windows, Mac y Linux', () => {
      expect(detectPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124')).toBe('windows')
      expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 0)).toBe('mac')
      expect(detectPlatform('Mozilla/5.0 (X11; Linux x86_64) Chrome/124')).toBe('linux')
    })
    it('Smart TV Samsung/LG y desconocidos', () => {
      expect(detectPlatform('Mozilla/5.0 (SMART-TV; Linux; Tizen 7.0) AppleWebKit/537.36')).toBe('smarttv')
      expect(detectPlatform('Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36')).toBe('smarttv')
      expect(detectPlatform('')).toBe('other')
    })
  })

  it('recomendación por plataforma', () => {
    expect(recommendedFor('android').id).toBe('android')
    expect(recommendedFor('tv').id).toBe('android-tv')
    expect(recommendedFor('mac').id).toBe('mac-arm')
    expect(recommendedFor('smarttv')).toBeNull()
    expect(downloadsFor('mac')).toHaveLength(2)
  })
})
