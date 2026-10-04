import { computeLayout } from '@/lib/layout'

describe('computeLayout', () => {
  it('celular vertical: 3 columnas, no tablet', () => {
    const l = computeLayout(390, 844, false)
    expect(l.columns).toBe(3)
    expect(l.isTablet).toBe(false)
    expect(l.gutter).toBe(16)
  })

  it('celular horizontal sigue siendo celular (lado corto < 600)', () => {
    const l = computeLayout(844, 390, false)
    expect(l.isTablet).toBe(false)
    expect(l.isLandscape).toBe(true)
  })

  it('tablet / iPad: 5-6 columnas y gutter mayor', () => {
    const portrait = computeLayout(820, 1180, false)
    expect(portrait.isTablet).toBe(true)
    expect(portrait.columns).toBe(5)
    expect(computeLayout(1180, 820, false).columns).toBe(6)
    expect(portrait.gutter).toBe(32)
  })

  it('TV: póster grande, gutter 56 y más columnas', () => {
    const l = computeLayout(1920, 1080, true)
    expect(l.isTV).toBe(true)
    expect(l.isTablet).toBe(false)
    expect(l.rowPosterWidth).toBe(200)
    expect(l.gutter).toBe(56)
    expect(l.columns).toBe(8)
  })
})
