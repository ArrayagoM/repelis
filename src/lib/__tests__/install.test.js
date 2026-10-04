import { describe, it, expect, beforeEach } from 'vitest'
import {
  inAppBrowserName, iosBrowser, shouldShowBanner, dismissInstallBanner, dismissedRecently, requestInstall,
} from '../install'

const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const IPHONE_INSTAGRAM = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.20.114'
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1'

describe('install', () => {
  beforeEach(() => localStorage.clear())

  it('detecta navegadores embebidos donde iOS no ofrece instalar', () => {
    expect(inAppBrowserName(IPHONE_INSTAGRAM)).toBe('Instagram')
    expect(inAppBrowserName('Mozilla/5.0 (iPhone) [FBAN/FBIOS;FBAV/450.0]')).toBe('Facebook')
    expect(inAppBrowserName('Mozilla/5.0 (Linux; Android 14) musical_ly_2023 TikTok')).toBe('TikTok')
    expect(inAppBrowserName(IPHONE_SAFARI)).toBeNull()
  })

  it('distingue Safari de Chrome en iOS', () => {
    expect(iosBrowser(IPHONE_SAFARI)).toBe('safari')
    expect(iosBrowser(IPHONE_CHROME)).toBe('chrome')
  })

  it('el aviso solo aparece en celular/tablet sin la app instalada ni descartado', () => {
    const base = { standalone: false, installed: false, dismissed: false }
    expect(shouldShowBanner({ ...base, platform: 'ios' })).toBe(true)
    expect(shouldShowBanner({ ...base, platform: 'android' })).toBe(true)
    expect(shouldShowBanner({ ...base, platform: 'windows' })).toBe(false)
    expect(shouldShowBanner({ ...base, platform: 'tv' })).toBe(false)
    expect(shouldShowBanner({ ...base, platform: 'ios', standalone: true })).toBe(false)
    expect(shouldShowBanner({ ...base, platform: 'ios', installed: true })).toBe(false)
    expect(shouldShowBanner({ ...base, platform: 'ios', dismissed: true })).toBe(false)
  })

  it('descartar el aviso se recuerda 7 días', () => {
    expect(dismissedRecently()).toBe(false)
    dismissInstallBanner()
    expect(dismissedRecently()).toBe(true)
    expect(dismissedRecently(Date.now() + 8 * 86400000)).toBe(false)
  })

  it('sin instalación directa y fuera de iOS devuelve unavailable', async () => {
    expect(await requestInstall()).toBe('unavailable')
  })
})
