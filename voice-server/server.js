// Servidor de voz de Life High: "central telefónica" por WebSocket para las salas.
// Solo reenvía mensajes de señalización (WebRTC) entre personas de la MISMA sala; el audio viaja directo entre ellas (P2P).
// No guarda ni graba nada. Se autentica con un token firmado que emite la API de Life High (VOICE_SECRET compartido).
import http from 'node:http'
import { WebSocketServer } from 'ws'
import {
  MAX_PEERS, MAX_PAYLOAD, verifyToken, safeEqual, originAllowed, makeLimiter, createRooms, publicPeer, newId, parseIceServers,
} from './lib.js'

export const createVoiceServer = ({ secret, origins, iceServers, now = Date.now } = {}) => {
  if (!secret) throw new Error('Falta VOICE_SECRET')
  const rooms = createRooms()
  const ice = parseIceServers(iceServers)
  const allowed = (origins || '').split(',').map((s) => s.trim()).filter(Boolean)
  const stats = { connections: 0, rejected: 0, signals: 0 }

  const send = (ws, msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)) }
  const broadcast = (code, msg, exceptId) => { for (const p of rooms.peers(code)) if (p.id !== exceptId) send(p.ws, msg) }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://x')
    res.setHeader('Cache-Control', 'no-store')
    if (url.pathname === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, rooms: rooms.count() })) }

    // La API de Life High pide sacar a alguien (patada del anfitrión) o cerrar la sala
    if (req.method === 'POST' && url.pathname === '/kick') {
      if (!safeEqual(req.headers['x-voice-secret'], secret)) { res.writeHead(401); return res.end() }
      const chunks = []
      let size = 0
      req.on('data', (c) => { size += c.length; if (size > 2048) req.destroy(); else chunks.push(c) })
      req.on('end', () => {
        let body = {}
        try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}') } catch { /* cuerpo inválido */ }
        const code = String(body.code || '')
        let closed = 0
        for (const p of rooms.peers(code)) {
          if (body.all === true || (body.userId && p.userId === String(body.userId))) { p.ws.close(4003, 'kicked'); closed += 1 }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, closed }))
      })
      return undefined
    }
    res.writeHead(404); return res.end()
  })

  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD })

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url || '/', 'http://x')
    const reject = (status) => { stats.rejected += 1; socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`); socket.destroy() }
    if (url.pathname !== '/ws') return reject('404 Not Found')
    if (allowed.length && !originAllowed(req.headers.origin, allowed)) return reject('403 Forbidden')
    const v = verifyToken(url.searchParams.get('token'), secret, now())
    if (!v.ok) return reject('401 Unauthorized')
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, v.claims))
  })

  wss.on('connection', (ws, claims) => {
    const code = claims.code
    const userId = String(claims.sub)

    // Una persona = una conexión: si abre otra pestaña, la vieja se cierra
    for (const old of rooms.byUser(code, userId)) { old.ws.close(4002, 'replaced'); rooms.remove(code, old.id) }
    if (rooms.size(code) >= MAX_PEERS) { ws.close(4001, 'full'); stats.rejected += 1; return }

    const peer = { id: newId(), userId, handle: String(claims.handle || '').slice(0, 24), name: String(claims.name || '').slice(0, 40), muted: false, ws }
    const limit = makeLimiter(120, 5000)
    stats.connections += 1
    const others = rooms.peers(code).map(publicPeer)
    rooms.add(code, peer)
    send(ws, { type: 'welcome', id: peer.id, peers: others, ice })
    broadcast(code, { type: 'peer-joined', peer: publicPeer(peer) }, peer.id)

    ws.on('message', (raw) => {
      if (!limit(now())) return ws.close(4008, 'rate_limit')
      let msg
      try { msg = JSON.parse(raw.toString()) } catch { return }
      if (!msg || typeof msg !== 'object') return
      if (msg.type === 'signal') {
        const target = rooms.get(code, String(msg.to || ''))
        if (target && target.id !== peer.id) { stats.signals += 1; send(target.ws, { type: 'signal', from: peer.id, data: msg.data }) }
      } else if (msg.type === 'mute') {
        peer.muted = msg.muted === true
        broadcast(code, { type: 'peer-state', id: peer.id, muted: peer.muted }, peer.id)
      }
    })
    ws.on('close', () => {
      if (rooms.remove(code, peer.id)) broadcast(code, { type: 'peer-left', id: peer.id })
    })
    ws.on('error', () => {})
  })

  // Latido: cierra conexiones muertas (cambio de red, pestaña congelada) para liberar su lugar
  const timer = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) { ws.terminate(); continue }
      ws.isAlive = false
      try { ws.ping() } catch { /* ya cerrado */ }
    }
  }, 25_000)
  wss.on('connection', (ws) => { ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true }) })
  server.on('close', () => clearInterval(timer))

  return { server, wss, rooms, stats }
}
