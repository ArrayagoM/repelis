// Plugin de Vite SOLO para desarrollo local (`npm run dev`): sirve /api/auth/* con una base en memoria
// y "manda" los mails imprimiendo los enlaces en la terminal. En producción esto no existe:
// ahí corre la función de Vercel (api/auth/[action].js) con MongoDB.
//
// La base en memoria se borra al reiniciar el servidor de desarrollo.

import { createAuthApi } from '../api/_lib/authApi.js'
import { createMemoryStore } from '../api/_lib/stores.js'
import { getGoogleKeys, verifyGoogleIdToken } from '../api/_lib/google.js'

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
    const api = createAuthApi({ store, mailer, secureCookies: false, googleClientId, verifyGoogle })

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
