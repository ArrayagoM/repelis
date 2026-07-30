import { describe, it, expect } from 'vitest'
import { parseUA, referrerHost } from '../_lib/ua.js'

describe('parseUA', () => {
  it('Android Chrome mobile', () => {
    const r = parseUA('Mozilla/5.0 (Linux; Android 13; Pixel) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36')
    expect(r.device).toBe('mobile')
    expect(r.os).toBe('Android')
    expect(r.browser).toBe('Chrome')
  })

  it('iPhone Safari', () => {
    const r = parseUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605 Version/17.0 Mobile/15E Safari/604.1')
    expect(r.device).toBe('mobile')
    expect(r.os).toBe('iOS')
    expect(r.browser).toBe('Safari')
  })

  it('iPad = tablet', () => {
    const r = parseUA('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605 Version/17.0 Safari/604.1')
    expect(r.device).toBe('tablet')
  })

  it('Windows desktop Chrome', () => {
    const r = parseUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36')
    expect(r.device).toBe('desktop')
    expect(r.os).toBe('Windows')
    expect(r.browser).toBe('Chrome')
  })

  it('Edge detectado antes que Chrome', () => {
    const r = parseUA('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120 Safari/537.36 Edg/120')
    expect(r.browser).toBe('Edge')
  })

  it('Samsung Internet', () => {
    const r = parseUA('Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 SamsungBrowser/23 Chrome/115 Mobile Safari/537.36')
    expect(r.browser).toBe('Samsung Internet')
    expect(r.device).toBe('mobile')
  })

  it('UA vacío = defaults', () => {
    const r = parseUA('')
    expect(r.device).toBe('desktop')
    expect(r.os).toBe('Otro')
    expect(r.browser).toBe('Otro')
  })

  it('Android TV / proyector = tablet-ish, no mobile', () => {
    const r = parseUA('Mozilla/5.0 (Linux; Android 9; SmartTV) AppleWebKit/537.36 Chrome/80 Safari/537.36')
    expect(r.os).toBe('Android')
  })
})

describe('referrerHost', () => {
  it('extrae host y saca www', () => {
    expect(referrerHost('https://www.google.com/search?q=x')).toBe('google.com')
  })

  it('descarta el propio dominio (navegación interna)', () => {
    expect(referrerHost('https://repelis.vercel.app/movie/1', 'repelis.vercel.app')).toBe(null)
  })

  it('vacío = null', () => {
    expect(referrerHost('')).toBe(null)
    expect(referrerHost(null)).toBe(null)
  })

  it('facebook', () => {
    expect(referrerHost('https://m.facebook.com/')).toBe('m.facebook.com')
  })
})
