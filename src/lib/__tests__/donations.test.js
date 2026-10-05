import { describe, it, expect, beforeEach } from 'vitest'
import {
  reloadDonations, getDonations, isSupporter, markSupporter, unmarkSupporter, shouldShowPrompt,
  recordPromptShown, recordPromptDismissed, recordPromptDonate, shouldThank, recordThanks, monthKey, parseGoal,
  MIN_WATCH_SECONDS, PROMPT_EVERY_MS, PROMPT_EVERY_MS_ANNOYED, ANNOYED_AFTER,
} from '../donations'

beforeEach(() => { localStorage.clear(); reloadDonations() })

describe('shouldShowPrompt', () => {
  const now = 1_000_000_000_000
  const base = { lastPromptAt: 0, dismissals: 0, supporterSince: null, lastThanksMonth: '' }

  it('no pide si casi no vio nada', () => {
    expect(shouldShowPrompt({ seconds: MIN_WATCH_SECONDS - 1, state: base, now })).toBe(false)
  })
  it('pide después de ver lo suficiente', () => {
    expect(shouldShowPrompt({ seconds: MIN_WATCH_SECONDS, state: base, now })).toBe(true)
  })
  it('no insiste antes de una semana', () => {
    const s = { ...base, lastPromptAt: now - PROMPT_EVERY_MS + 1000 }
    expect(shouldShowPrompt({ seconds: 99999, state: s, now })).toBe(false)
    expect(shouldShowPrompt({ seconds: 99999, state: { ...base, lastPromptAt: now - PROMPT_EVERY_MS }, now })).toBe(true)
  })
  it('si lo descartó varias veces, espera un mes', () => {
    const s = { ...base, dismissals: ANNOYED_AFTER, lastPromptAt: now - PROMPT_EVERY_MS - 1 }
    expect(shouldShowPrompt({ seconds: 99999, state: s, now })).toBe(false)
    expect(shouldShowPrompt({ seconds: 99999, state: { ...s, lastPromptAt: now - PROMPT_EVERY_MS_ANNOYED }, now })).toBe(true)
  })
  it('nunca a un Supporter', () => {
    expect(shouldShowPrompt({ seconds: 99999, state: { ...base, supporterSince: 1 }, now })).toBe(false)
  })
})

describe('estado persistente', () => {
  it('Supporter se activa, persiste y se puede quitar', () => {
    expect(isSupporter()).toBe(false)
    markSupporter()
    reloadDonations()
    expect(isSupporter()).toBe(true)
    unmarkSupporter()
    expect(isSupporter()).toBe(false)
  })
  it('descartar suma, donar reinicia', () => {
    recordPromptDismissed(); recordPromptDismissed()
    expect(getDonations().dismissals).toBe(2)
    recordPromptDonate()
    expect(getDonations().dismissals).toBe(0)
    expect(getDonations().lastPromptAt).toBeGreaterThan(0)
  })
  it('mostrar el pedido registra la fecha', () => {
    recordPromptShown()
    expect(getDonations().lastPromptAt).toBeGreaterThan(0)
  })
})

describe('agradecimiento mensual', () => {
  it('una vez por mes y solo a Supporters', () => {
    const oct = new Date(2026, 9, 5)
    expect(shouldThank(getDonations(), oct)).toBe(false)
    markSupporter()
    expect(shouldThank(getDonations(), oct)).toBe(true)
    recordThanks(oct)
    expect(shouldThank(getDonations(), oct)).toBe(false)
    expect(shouldThank(getDonations(), new Date(2026, 10, 1))).toBe(true)
    expect(monthKey(oct)).toBe('2026-10')
  })
})

describe('parseGoal', () => {
  it('calcula el porcentaje y limpia los gastos', () => {
    const g = parseGoal({ month: '2026-10', currency: 'usd', goal: 40, raised: 10, costs: [{ label: 'Dominio', amount: 2 }, { label: '', amount: 5 }, { label: 'Malo', amount: 'x' }] })
    expect(g).toMatchObject({ currency: 'USD', goal: 40, raised: 10, percent: 25 })
    expect(g.costs).toEqual([{ label: 'Dominio', amount: 2, note: '' }])
  })
  it('el porcentaje no pasa de 100', () => {
    expect(parseGoal({ goal: 10, raised: 50 }).percent).toBe(100)
  })
  it('sin meta válida devuelve null (la UI no muestra nada)', () => {
    expect(parseGoal(null)).toBeNull()
    expect(parseGoal({ goal: 0 })).toBeNull()
    expect(parseGoal({ goal: 'abc' })).toBeNull()
    expect(parseGoal('<!doctype html>')).toBeNull()
  })
})
