import { describe, it, expect } from 'vitest'
import {
  emptyLibrary, normalizeLibrary, mergeLibraries, isLibraryEmpty, libraryFingerprint,
  LIST_MAX, TOMB_TTL_MS,
} from '../libraryMerge'

const NOW = 1_800_000_000_000
const item = (id, over = {}) => ({ id, type: 'movie', title: `T${id}`, poster: '/p.jpg', date: '2020-01-01', genres: [28], addedAt: 1000, ...over })
const hist = (id, over = {}) => ({ id, type: 'movie', title: `T${id}`, runtimeMin: 100, watchedSec: 600, updatedAt: 1000, ...over })
const lib = (over = {}) => ({ ...emptyLibrary(), ...over })

describe('normalizeLibrary', () => {
  it('siempre devuelve una biblioteca válida', () => {
    for (const bad of [null, undefined, 42, 'x', [], { list: 'no' }]) {
      const n = normalizeLibrary(bad)
      expect(n.list).toEqual([])
      expect(n.v).toBe(1)
    }
  })
  it('descarta ítems inválidos y duplicados', () => {
    const n = normalizeLibrary({ list: [item(1), item(1), { id: 'x', type: 'movie' }, { id: 5, type: 'otra' }, null, item(2)] })
    expect(n.list.map((x) => x.id)).toEqual([1, 2])
  })
  it('respeta los límites de tamaño', () => {
    const many = Array.from({ length: LIST_MAX + 50 }, (_, i) => item(i + 1))
    expect(normalizeLibrary({ list: many }).list).toHaveLength(LIST_MAX)
  })
  it('no deja pasar campos desconocidos ni textos enormes', () => {
    const n = normalizeLibrary({ list: [{ ...item(1), title: 'x'.repeat(5000), evil: '<script>', __proto__: { polluted: 1 } }], injected: 1 })
    expect(n.list[0].title).toHaveLength(200)
    expect(n.list[0].evil).toBeUndefined()
    expect(n.injected).toBeUndefined()
    expect({}.polluted).toBeUndefined()
  })
  it('valida fechas y claves', () => {
    const n = normalizeLibrary({ days: ['2026-10-05', 'basura', '2026-10-05'], seen: { 'movie:1': 1, '<x>': 1 }, genres: { 28: 2, abc: 1 } })
    expect(n.days).toEqual(['2026-10-05'])
    expect(Object.keys(n.seen)).toEqual(['movie:1'])
    expect(n.genres).toEqual({ 28: 2 })
  })
  it('acota números absurdos', () => {
    expect(normalizeLibrary({ minutes: 9e15 }).minutes).toBe(10_000_000)
    expect(normalizeLibrary({ minutes: -5 }).minutes).toBe(0)
    expect(normalizeLibrary({ minutes: 'abc' }).minutes).toBe(0)
  })
  it('es idempotente', () => {
    const once = normalizeLibrary({ list: [item(1)], history: [hist(2)], minutes: 5 })
    expect(normalizeLibrary(once)).toEqual(once)
  })
})

describe('mergeLibraries — Mi lista', () => {
  it('une lo que cada dispositivo agregó', () => {
    const out = mergeLibraries(lib({ list: [item(1)] }), lib({ list: [item(2)] }), { now: NOW })
    expect(out.list.map((x) => x.id).sort()).toEqual([1, 2])
  })
  it('conserva la fecha original de agregado', () => {
    const out = mergeLibraries(lib({ list: [item(1, { addedAt: 500 })] }), lib({ list: [item(1, { addedAt: 900 })] }), { now: NOW })
    expect(out.list).toHaveLength(1)
    expect(out.list[0].addedAt).toBe(500)
  })
  it('lo que borrás en un dispositivo no reaparece desde el otro', () => {
    const deviceA = lib({ list: [], tombs: { 'list:movie:1': NOW - 1000 } })
    const deviceB = lib({ list: [item(1, { addedAt: NOW - 50_000 })] })
    expect(mergeLibraries(deviceA, deviceB, { now: NOW }).list).toEqual([])
  })
  it('si lo volvés a agregar después de borrarlo, vuelve', () => {
    const deviceA = lib({ tombs: { 'list:movie:1': NOW - 50_000 } })
    const deviceB = lib({ list: [item(1, { addedAt: NOW - 1000 })] })
    expect(mergeLibraries(deviceA, deviceB, { now: NOW }).list.map((x) => x.id)).toEqual([1])
  })
  it('ordena lo más nuevo primero', () => {
    const out = mergeLibraries(lib({ list: [item(1, { addedAt: 100 })] }), lib({ list: [item(2, { addedAt: 200 })] }), { now: NOW })
    expect(out.list.map((x) => x.id)).toEqual([2, 1])
  })
})

describe('mergeLibraries — historial', () => {
  it('gana lo último que viste', () => {
    const out = mergeLibraries(
      lib({ history: [hist(1, { watchedSec: 100, updatedAt: 100 })] }),
      lib({ history: [hist(1, { watchedSec: 900, updatedAt: 200 })] }),
      { now: NOW },
    )
    expect(out.history).toHaveLength(1)
    expect(out.history[0].watchedSec).toBe(900)
  })
  it('respeta el borrado del historial', () => {
    const out = mergeLibraries(lib({ tombs: { 'hist:movie:1': 500 } }), lib({ history: [hist(1, { updatedAt: 100 })] }), { now: NOW })
    expect(out.history).toEqual([])
  })
})

describe('mergeLibraries — recordatorios y estadísticas', () => {
  it('"notified" se mantiene si cualquiera ya avisó', () => {
    const a = lib({ reminders: [item(1, { notified: false })] })
    const b = lib({ reminders: [item(1, { notified: true })] })
    expect(mergeLibraries(a, b, { now: NOW }).reminders[0].notified).toBe(true)
  })
  it('une días, vistos y logros; géneros y minutos toman el mayor', () => {
    const a = lib({ days: ['2026-10-01', '2026-10-02'], seen: { 'movie:1': 1 }, genres: { 28: 3 }, minutes: 100, achSeen: ['first'] })
    const b = lib({ days: ['2026-10-02', '2026-10-03'], seen: { 'tv:2': 1 }, genres: { 28: 1, 18: 2 }, minutes: 250, achSeen: ['racha3'] })
    const out = mergeLibraries(a, b, { now: NOW })
    expect(out.days).toEqual(['2026-10-01', '2026-10-02', '2026-10-03'])
    expect(Object.keys(out.seen).sort()).toEqual(['movie:1', 'tv:2'])
    expect(out.genres).toEqual({ 28: 3, 18: 2 })
    expect(out.minutes).toBe(250)
    expect(out.achSeen.sort()).toEqual(['first', 'racha3'])
  })
  it('descarta tumbas viejas', () => {
    const out = mergeLibraries(lib({ tombs: { 'list:movie:1': NOW - TOMB_TTL_MS - 1, 'list:movie:2': NOW - 1000 } }), lib(), { now: NOW })
    expect(Object.keys(out.tombs)).toEqual(['list:movie:2'])
  })
})

describe('mergeLibraries — propiedades', () => {
  const a = lib({
    list: [item(1, { addedAt: 100 }), item(2, { addedAt: 300 })],
    history: [hist(3, { updatedAt: 400 })],
    reminders: [item(4, { addedAt: 50 })],
    days: ['2026-10-01'], minutes: 10, tombs: { 'list:movie:9': NOW - 10 },
  })
  const b = lib({
    list: [item(2, { addedAt: 200 }), item(5, { addedAt: 250 })],
    history: [hist(3, { updatedAt: 300, watchedSec: 5 }), hist(6, { updatedAt: 100 })],
    reminders: [item(4, { addedAt: 60, notified: true })],
    days: ['2026-10-02'], minutes: 40, tombs: { 'hist:movie:6': NOW - 20 },
  })

  it('conmutativa: el orden de los dispositivos no importa', () => {
    expect(mergeLibraries(a, b, { now: NOW })).toEqual(mergeLibraries(b, a, { now: NOW }))
  })
  it('idempotente: sincronizar dos veces no cambia nada', () => {
    const m = mergeLibraries(a, b, { now: NOW })
    expect(mergeLibraries(m, m, { now: NOW })).toEqual(m)
    expect(mergeLibraries(m, a, { now: NOW })).toEqual(m)
  })
  it('asociativa con un tercer dispositivo', () => {
    const c = lib({ list: [item(7, { addedAt: 10 })], days: ['2026-10-03'] })
    const left = mergeLibraries(mergeLibraries(a, b, { now: NOW }), c, { now: NOW })
    const right = mergeLibraries(a, mergeLibraries(b, c, { now: NOW }), { now: NOW })
    expect(left).toEqual(right)
  })
  it('no muta los argumentos', () => {
    const snapshot = JSON.stringify([a, b])
    mergeLibraries(a, b, { now: NOW })
    expect(JSON.stringify([a, b])).toBe(snapshot)
  })
  it('fusionar con vacío no pierde nada', () => {
    expect(mergeLibraries(a, emptyLibrary(), { now: NOW })).toEqual(mergeLibraries(a, a, { now: NOW }))
  })
})

describe('utilidades', () => {
  it('isLibraryEmpty', () => {
    expect(isLibraryEmpty(emptyLibrary())).toBe(true)
    expect(isLibraryEmpty(null)).toBe(true)
    expect(isLibraryEmpty(lib({ list: [item(1)] }))).toBe(false)
    expect(isLibraryEmpty(lib({ days: ['2026-10-01'] }))).toBe(false)
  })
  it('libraryFingerprint no depende del orden de las claves', () => {
    const x = lib({ seen: { 'movie:1': 1, 'tv:2': 1 }, genres: { 28: 1, 18: 2 } })
    const y = lib({ seen: { 'tv:2': 1, 'movie:1': 1 }, genres: { 18: 2, 28: 1 } })
    expect(libraryFingerprint(x)).toBe(libraryFingerprint(y))
    expect(libraryFingerprint(x)).not.toBe(libraryFingerprint(lib()))
  })
})
