import { describe, it, expect, beforeEach } from 'vitest'
import { shouldPlayIntro, isBotUA, introSeen, markIntroSeen } from '../intro'

const base = { pathname: '/', standalone: false, reducedMotion: false, seen: false, bot: false, lowEnd: false }

describe('intro', () => {
  beforeEach(() => sessionStorage.clear())

  it('se muestra al abrir la home la primera vez', () => {
    expect(shouldPlayIntro(base)).toBe(true)
  })

  it('no se muestra en páginas internas del sitio web (SEO / enlaces directos)...', () => {
    expect(shouldPlayIntro({ ...base, pathname: '/movie/27205' })).toBe(false)
  })

  it('...pero sí en cualquier ruta si es la app instalada', () => {
    expect(shouldPlayIntro({ ...base, pathname: '/movie/27205', standalone: true })).toBe(true)
  })

  it('se omite si ya se vio, con reducir movimiento, bots o gama baja', () => {
    expect(shouldPlayIntro({ ...base, seen: true })).toBe(false)
    expect(shouldPlayIntro({ ...base, reducedMotion: true })).toBe(false)
    expect(shouldPlayIntro({ ...base, bot: true })).toBe(false)
    expect(shouldPlayIntro({ ...base, lowEnd: true })).toBe(false)
  })

  it('recuerda la sesión', () => {
    expect(introSeen()).toBe(false)
    markIntroSeen()
    expect(introSeen()).toBe(true)
  })

  it('detecta buscadores', () => {
    expect(isBotUA('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(true)
    expect(isBotUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Safari/604.1')).toBe(false)
  })
})
