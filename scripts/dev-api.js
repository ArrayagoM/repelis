// Plugin de Vite SOLO para desarrollo local (`npm run dev`): sirve /api/auth/* con una base en memoria
// y "manda" los mails imprimiendo los enlaces en la terminal. En producción esto no existe:
// ahí corre la función de Vercel (api/auth/[action].js) con MongoDB.
//
// La base en memoria se borra al reiniciar el servidor de desarrollo.

import { createAuthApi } from '../api/_lib/authApi.js'
import { createMemoryStore } from '../api/_lib/stores.js'
import { getGoogleKeys, verifyGoogleIdToken } from '../api/_lib/google.js'
import { createMemoryStats } from '../api/_lib/statsStore.js'
import { createPulse } from '../api/_lib/pulse.js'
import { createAdminApi } from '../api/_lib/adminApi.js'
import { parseRootEmails } from '../api/_lib/session.js'
import { seedDemoStats } from './dev-seed.js'
import { createMemorySocial } from '../api/_lib/socialStore.js'
import { createSocialApi } from '../api/_lib/socialApi.js'
import { createMemoryRooms } from '../api/_lib/roomsStore.js'
import { createRoomsApi } from '../api/_lib/roomsApi.js'
import { createVoice } from '../api/_lib/voice.js'

const readJson = (req) => new Promise((resolve) => {
  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')) } catch { resolve({}) } })
  req.on('error', () => resolve({}))
})

export const devAuthApi = () => ({
  name: 'lifehigh-dev-auth-api',
  apply: 'serve',
  configureServer(server) {
    const store = createMemoryStore()
    const base = () => `http://localhost:${server.config.server.port || 5173}`
    const mailer = {
      sendVerify: async (to, token) => console.log(`\n[dev-mail] Confirmar mail de ${to}:\n  ${base()}/cuenta/verificar?token=${token}\n`),
      sendReset: async (to, token) => console.log(`\n[dev-mail] Restablecer contraseña de ${to}:\n  ${base()}/cuenta/restablecer?token=${token}\n`),
    }
    // Google: con GOOGLE_CLIENT_ID real en el entorno se verifica de verdad; si no, "Google falso" SOLO para desarrollo:
    // la credencial `fake:<sub>:<mail>:<nombre>` se acepta tal cual (así se prueba el flujo sin una cuenta de Google).
    const realClientId = (process.env.GOOGLE_CLIENT_ID || '').trim()
    const googleClientId = realClientId || 'dev-client.apps.googleusercontent.com'
    const verifyGoogle = realClientId
      ? async (credential) => verifyGoogleIdToken(credential, { clientId: realClientId, keys: await getGoogleKeys() })
      : async (credential) => {
          const [kind, sub, email, name] = String(credential).split(':')
          if (kind !== 'fake' || !sub || !email) throw new Error('google_invalid')
          return { sub, email: email.toLowerCase(), name: name || '', picture: null }
        }
    // Fundador de desarrollo: ROOT_EMAILS del entorno, o root@dev.test (se prueba con la credencial falsa "fake:1:root@dev.test:Fundador")
    const rootEmails = parseRootEmails(process.env.ROOT_EMAILS).length ? parseRootEmails(process.env.ROOT_EMAILS) : ['root@dev.test']
    const social = createMemorySocial()
    const rooms = createMemoryRooms()
    const api = createAuthApi({ store, mailer, secureCookies: false, googleClientId, verifyGoogle, rootEmails, onUserDeleted: async (id) => { await social.deleteUserData(id); await rooms.deleteUserData(id) } })

    // Estadísticas en memoria. Arrancan VACÍAS. Con DEV_SEED=1 se cargan 7 días de datos INVENTADOS y el panel lo avisa con un cartel rojo.
    const stats = createMemoryStats()
    if (process.env.DEV_SEED === '1') {
      stats.demo = true
      seedDemoStats({ stats }).catch((e) => console.error('[dev-seed]', e?.message))
    }
    const pulse = createPulse({ stats })
    const admin = createAdminApi({ store, stats, social, rootEmails })
    // Push de mentira para desarrollo: acepta suscripciones y cuenta los envíos (no sale nada a la red)
    const devPush = { publicKey: 'dev-vapid-public-key', sent: [], async send(subs, payload) { devPush.sent.push({ subs: subs.length, payload }); return { sent: subs.length, gone: [] } } }
    const socialApi = createSocialApi({ store, social, push: devPush, rootEmails })

    const send = (res, out) => {
      res.statusCode = out.status
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify(out.body))
    }
    server.middlewares.use('/api/pulse', async (req, res) => {
      if (req.method !== 'POST') return send(res, { status: 405, body: { error: 'method_not_allowed' } })
      send(res, await pulse({ body: await readJson(req), headers: req.headers }))
    })
    server.middlewares.use('/api/admin', async (req, res) => {
      const url = new URL(req.url || '/', 'http://localhost')
      const action = url.pathname.replace(/^\/+/, '').split('/')[0]
      const body = req.method === 'POST' ? await readJson(req) : {}
      send(res, await admin({ method: req.method, action, headers: req.headers, query: { days: url.searchParams.get('days') }, body }))
    })
    const roomsApi = createRoomsApi({ store, social, rooms, voice: createVoice(process.env), rootEmails })
    server.middlewares.use('/api/rooms', async (req, res) => {
      const url = new URL(req.url || '/', 'http://localhost')
      const action = url.pathname.replace(/^\/+/, '').split('/')[0]
      const body = req.method === 'POST' ? await readJson(req) : {}
      send(res, await roomsApi({ method: req.method, action, headers: req.headers, body, query: Object.fromEntries(url.searchParams) }))
    })
    server.middlewares.use('/api/social', async (req, res) => {
      const url = new URL(req.url || '/', 'http://localhost')
      const action = url.pathname.replace(/^\/+/, '').split('/')[0]
      const body = req.method === 'POST' ? await readJson(req) : {}
      send(res, await socialApi({ method: req.method, action, headers: req.headers, body, query: Object.fromEntries(url.searchParams), ip: req.socket.remoteAddress || '' }))
    })

    server.middlewares.use('/api/auth', async (req, res) => {
      const action = (req.url || '').split('?')[0].replace(/^\/+/, '').split('/')[0]
      const body = req.method === 'POST' ? await readJson(req) : undefined
      const out = await api({ method: req.method, action, headers: req.headers, body, ip: req.socket.remoteAddress || '' })
      res.statusCode = out.status
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'no-store')
      if (out.cookies?.length) res.setHeader('Set-Cookie', out.cookies)
      res.end(JSON.stringify(out.body))
    })
  },
})
