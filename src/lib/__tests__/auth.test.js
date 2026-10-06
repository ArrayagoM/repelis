import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  initAuth, register, login, logout, getAuth, syncNow, deleteAccount, forgotPassword, errorMessage, __resetAuth,
} from '../auth'
import { getLibrary, reloadLibrary, toggleList, toLibItem, isInList } from '../library'
import { reloadDonations, getDonations } from '../donations'

const movie = (id, title) => toLibItem({ id, title, poster_path: '/p.jpg', release_date: '2020-01-01', genre_ids: [28] }, 'movie')
const user = { id: '1', email: 'ana@mail.com', name: 'Ana', emailVerified: false, supporterSince: null }
const serverItem = (id, title) => ({ id, type: 'movie', title, poster: null, backdrop: null, date: '2020-01-01', genres: [], addedAt: 1000 })

let calls
let routes

const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

beforeEach(() => {
  localStorage.clear()
  reloadLibrary()
  reloadDonations()
  __resetAuth()
  calls = []
  routes = {}
  vi.stubGlobal('fetch', vi.fn(async (url, opts = {}) => {
    const path = String(url).replace('/api/auth/', '')
    const method = opts.method || 'GET'
    calls.push({ path, method, body: opts.body ? JSON.parse(opts.body) : undefined, credentials: opts.credentials })
    const handler = routes[`${method} ${path}`]
    if (!handler) return reply(404, { error: 'not_found' })
    return typeof handler === 'function' ? handler(opts.body ? JSON.parse(opts.body) : undefined) : handler
  }))
})

describe('arranque', () => {
  it('sin servicio de cuentas queda "unavailable" y no pide la sesión', async () => {
    routes['GET status'] = reply(200, { enabled: false, mail: false })
    await initAuth()
    expect(getAuth().status).toBe('unavailable')
    expect(calls.map((c) => c.path)).toEqual(['status'])
  })
  it('si falla la red también queda "unavailable" (el sitio sigue funcionando)', async () => {
    fetch.mockRejectedValueOnce(new Error('offline'))
    await initAuth()
    expect(getAuth().status).toBe('unavailable')
  })
  it('sin sesión queda "out"', async () => {
    routes['GET status'] = reply(200, { enabled: true, mail: true })
    routes['GET me'] = reply(401, { error: 'not_authenticated' })
    await initAuth()
    expect(getAuth()).toMatchObject({ status: 'out', user: null, mail: true })
  })
  it('con sesión entra, fusiona lo local con lo de la cuenta y lo sube', async () => {
    toggleList(movie(1, 'Local'))
    routes['GET status'] = reply(200, { enabled: true, mail: false })
    routes['GET me'] = reply(200, { user, library: { list: [serverItem(2, 'Remota')] } })
    routes['POST sync'] = (body) => reply(200, { library: body.library, supporterSince: null })
    await initAuth()
    expect(getAuth().status).toBe('in')
    expect(getLibrary().list.map((x) => x.title).sort()).toEqual(['Local', 'Remota'])
    const sync = calls.find((c) => c.path === 'sync')
    expect(sync.body.library.list).toHaveLength(2)
    expect(sync.credentials).toBe('same-origin')
  })
})

describe('registro e ingreso', () => {
  beforeEach(() => {
    routes['GET status'] = reply(200, { enabled: true, mail: true })
    routes['GET me'] = reply(401, { error: 'not_authenticated' })
  })

  it('al registrarse sube la biblioteca del dispositivo', async () => {
    toggleList(movie(1, 'Mi peli'))
    routes['POST register'] = (body) => reply(200, { user, library: body.library, mailSent: true })
    routes['POST sync'] = (body) => reply(200, { library: body.library })
    await initAuth()
    const r = await register({ email: 'ana@mail.com', password: 'una-clave-larga-1', name: 'Ana' })
    expect(r).toEqual({ ok: true, mailSent: true })
    expect(calls.find((c) => c.path === 'register').body.library.list.map((x) => x.title)).toEqual(['Mi peli'])
    expect(getAuth().status).toBe('in')
  })
  it('devuelve el código de error de la API', async () => {
    routes['POST register'] = reply(409, { error: 'email_taken' })
    await initAuth()
    expect(await register({ email: 'a@b.co', password: 'una-clave-larga-1' })).toEqual({ ok: false, error: 'email_taken' })
    expect(getAuth().status).toBe('out')
  })
  it('login correcto trae la lista de la cuenta', async () => {
    routes['POST login'] = reply(200, { user, library: { list: [serverItem(5, 'De la cuenta')] } })
    routes['POST sync'] = (body) => reply(200, { library: body.library })
    await initAuth()
    expect((await login({ email: 'ana@mail.com', password: 'x'.repeat(10) })).ok).toBe(true)
    expect(isInList(getLibrary(), 'movie', 5)).toBe(true)
  })
  it('login incorrecto no cambia nada', async () => {
    routes['POST login'] = reply(401, { error: 'invalid_credentials' })
    await initAuth()
    toggleList(movie(1, 'Local'))
    expect(await login({ email: 'ana@mail.com', password: 'mala-mala' })).toEqual({ ok: false, error: 'invalid_credentials' })
    expect(getAuth().status).toBe('out')
    expect(getLibrary().list).toHaveLength(1)
  })
  it('un error de red se informa con un código propio', async () => {
    await initAuth()
    fetch.mockRejectedValueOnce(new Error('offline'))
    expect(await login({ email: 'a@b.co', password: 'x'.repeat(10) })).toEqual({ ok: false, error: 'network' })
  })
  it('Supporter de la cuenta se aplica en el dispositivo', async () => {
    routes['POST login'] = reply(200, { user: { ...user, supporterSince: 12345 }, library: {} })
    routes['POST sync'] = (body) => reply(200, { library: body.library, supporterSince: 12345 })
    await initAuth()
    await login({ email: 'ana@mail.com', password: 'x'.repeat(10) })
    expect(getDonations().supporterSince).toBe(12345)
  })
})

describe('sesión abierta', () => {
  beforeEach(async () => {
    routes['GET status'] = reply(200, { enabled: true, mail: true })
    routes['GET me'] = reply(200, { user, library: { list: [serverItem(2, 'Remota')] } })
    routes['POST sync'] = (body) => reply(200, { library: body.library })
    await initAuth()
    calls.length = 0
  })

  it('logout hace una última subida, cierra sesión y vacía el dispositivo', async () => {
    routes['POST logout'] = reply(200, { ok: true })
    toggleList(movie(9, 'Nueva'))
    await logout()
    expect(calls.map((c) => c.path)).toEqual(['sync', 'logout'])
    expect(calls[0].body.library.list.map((x) => x.title)).toContain('Nueva')   // no se pierde nada
    expect(getAuth()).toMatchObject({ status: 'out', user: null })
    expect(getLibrary().list).toEqual([])
  })
  it('si la sesión venció (401) en la sincronización pasa a "out"', async () => {
    routes['POST sync'] = reply(401, { error: 'not_authenticated' })
    expect(await syncNow()).toBe(false)
    expect(getAuth().status).toBe('out')
  })
  it('un fallo del servidor marca error pero mantiene la sesión', async () => {
    routes['POST sync'] = reply(500, { error: 'server_error' })
    await syncNow()
    expect(getAuth()).toMatchObject({ status: 'in', syncError: true })
  })
  it('varias sincronizaciones simultáneas hacen un solo pedido', async () => {
    await Promise.all([syncNow(), syncNow(), syncNow()])
    expect(calls.filter((c) => c.path === 'sync')).toHaveLength(1)
  })
  it('lo que llega de otro dispositivo se suma sin perder lo local', async () => {
    toggleList(movie(1, 'Local'))
    routes['POST sync'] = (body) => reply(200, { library: { ...body.library, list: [...body.library.list, serverItem(77, 'Del otro celu')] } })
    await syncNow()
    expect(getLibrary().list.map((x) => x.title).sort()).toEqual(['Del otro celu', 'Local', 'Remota'])
  })
  it('borrar la cuenta deja la sesión cerrada y conserva lo local', async () => {
    routes['POST delete'] = reply(200, { ok: true })
    const r = await deleteAccount('una-clave-larga-1')
    expect(r.ok).toBe(true)
    expect(getAuth().status).toBe('out')
    expect(getLibrary().list.length).toBeGreaterThan(0)
  })
  it('syncNow sin sesión no hace pedidos', async () => {
    routes['POST logout'] = reply(200, { ok: true })
    await logout()
    calls.length = 0
    expect(await syncNow()).toBe(false)
    expect(calls).toEqual([])
  })
})

describe('mensajes', () => {
  it('todo código de error tiene texto en español y hay uno por defecto', () => {
    for (const code of ['network', 'email_taken', 'invalid_credentials', 'too_many_requests', 'token_invalid', 'password_short']) {
      expect(errorMessage(code).length).toBeGreaterThan(10)
    }
    expect(errorMessage('codigo_raro')).toBe(errorMessage('server_error'))
  })
  it('forgotPassword devuelve ok', async () => {
    routes['POST forgot'] = reply(200, { ok: true })
    expect(await forgotPassword('a@b.co')).toEqual({ ok: true })
  })
})
