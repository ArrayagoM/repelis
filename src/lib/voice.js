// Voz de las salas: WebRTC en malla (cada persona se conecta directo con las demás; el audio NO pasa por nuestros servidores).
// El servidor de voz (voice-server/, por WebSocket) solo reenvía la señalización. Hasta 12 personas, solo audio.
import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Piezas puras (se prueban sin navegador) ────────────────────────────

/** Nivel RMS (0..1) de una muestra de audio en bytes (0..255 centrado en 128). */
export const rmsLevel = (bytes) => {
  if (!bytes?.length) return 0
  let sum = 0
  for (let i = 0; i < bytes.length; i++) { const v = (bytes[i] - 128) / 128; sum += v * v }
  return Math.sqrt(sum / bytes.length)
}

export const SPEAK_ON = 0.03       // por encima de esto se considera que habla
export const SPEAK_HOLD_MS = 450   // se mantiene "hablando" un ratito para que el anillo no parpadee

/** Estado de "hablando" con histéresis: { speaking, until } → nuevo estado. */
export const nextSpeaking = (prev, level, now) => {
  if (level >= SPEAK_ON) return { speaking: true, until: now + SPEAK_HOLD_MS }
  if (prev.speaking && now < prev.until) return prev
  return { speaking: false, until: 0 }
}

/** Qué hacer cuando se cierra la conexión con el servidor de voz. */
export const closeAction = (code) => {
  if (code === 1000 || code === 1005) return { retry: false, error: null }
  if (code === 4001) return { retry: false, error: 'voice_full' }
  if (code === 4002) return { retry: false, error: 'voice_replaced' }
  if (code === 4003) return { retry: false, error: 'voice_kicked' }
  if (code === 4008) return { retry: false, error: 'voice_rate' }
  return { retry: true, error: null }            // 1006 (caída), servidor despertando, etc.
}

export const VOICE_ERRORS = {
  mic_denied: 'El navegador no te dejó usar el micrófono. Habilitalo desde el candado de la barra de direcciones.',
  mic_missing: 'No encontramos un micrófono en este dispositivo.',
  voice_unavailable: 'La voz todavía no está disponible.',
  voice_full: 'La voz de esta sala está llena.',
  voice_replaced: 'Entraste a la voz desde otra pestaña o dispositivo.',
  voice_kicked: 'El anfitrión te sacó de la sala.',
  voice_rate: 'Se cortó la conexión por demasiada actividad. Probá de nuevo.',
  voice_failed: 'No pudimos conectar la voz. Revisá tu internet y probá de nuevo.',
  unsupported: 'Este navegador no admite llamadas de voz.',
}
export const voiceErrorText = (code) => VOICE_ERRORS[code] || VOICE_ERRORS.voice_failed

export const voiceSupported = () =>
  typeof window !== 'undefined' && !!window.RTCPeerConnection && !!navigator.mediaDevices?.getUserMedia && 'WebSocket' in window

const MAX_RETRIES = 6
const RETRY_MS = 2000      // el servidor de voz duerme cuando no hay nadie: puede tardar unos segundos en despertar

// ─── Hook ───────────────────────────────────────────────────────────────

/**
 * @param {string|null} code  sala
 * @param {(code:string) => Promise<{ok:boolean,data:any,error?:string}>} getToken  pide { url, token } a la API
 * @returns {{ status:'off'|'connecting'|'on'|'error', error:string|null, muted:boolean, peers:Record<string,{handle,name,muted,speaking}>,
 *            meSpeaking:boolean, blocked:boolean, join:Function, leave:Function, toggleMute:Function, unblock:Function }}
 */
export const useVoice = (code, getToken) => {
  const [status, setStatus] = useState('off')
  const [error, setError] = useState(null)
  const [muted, setMuted] = useState(false)
  const [peers, setPeers] = useState({})
  const [meSpeaking, setMeSpeaking] = useState(false)
  const [blocked, setBlocked] = useState(false)

  const R = useRef({ ws: null, pcs: new Map(), pending: new Map(), local: null, ice: [], myId: null, ctx: null, meters: new Map(), timer: null, speak: new Map(), box: null, retries: 0, closing: false, muted: false })

  const setPeer = useCallback((id, patch) => setPeers((p) => ({ ...p, [id]: { ...(p[id] || { handle: '', name: '', muted: false, speaking: false }), ...patch } })), [])
  const dropPeer = useCallback((id) => {
    const r = R.current
    r.pcs.get(id)?.close(); r.pcs.delete(id); r.pending.delete(id); r.meters.delete(id); r.speak.delete(id)
    r.box?.querySelector(`[data-peer="${id}"]`)?.remove()
    setPeers((p) => { const n = { ...p }; delete n[id]; return n })
  }, [])

  const send = (msg) => { const ws = R.current.ws; if (ws?.readyState === 1) ws.send(JSON.stringify(msg)) }

  // Medidor de nivel (quién habla) con un solo temporizador para todos
  const watch = useCallback((key, stream) => {
    const r = R.current
    try {
      r.ctx ||= new (window.AudioContext || window.webkitAudioContext)()
      r.ctx.resume?.()
      const analyser = r.ctx.createAnalyser(); analyser.fftSize = 512
      r.ctx.createMediaStreamSource(stream).connect(analyser)
      r.meters.set(key, { analyser, data: new Uint8Array(analyser.fftSize) })
    } catch { /* sin medidor: la voz funciona igual */ }
    if (!r.timer) {
      r.timer = setInterval(() => {
        const now = Date.now()
        for (const [k, m] of r.meters) {
          m.analyser.getByteTimeDomainData(m.data)
          const level = k === 'me' && r.muted ? 0 : rmsLevel(m.data)
          const prev = r.speak.get(k) || { speaking: false, until: 0 }
          const nxt = nextSpeaking(prev, level, now)
          r.speak.set(k, nxt)
          if (nxt.speaking !== prev.speaking) {
            if (k === 'me') setMeSpeaking(nxt.speaking); else setPeers((p) => (p[k] ? { ...p, [k]: { ...p[k], speaking: nxt.speaking } } : p))
          }
        }
      }, 150)
    }
  }, [])

  const makePeer = useCallback((id, initiator) => {
    const r = R.current
    if (r.pcs.has(id)) return r.pcs.get(id)
    const pc = new RTCPeerConnection({ iceServers: r.ice })
    r.pcs.set(id, pc)
    r.local?.getTracks().forEach((t) => pc.addTrack(t, r.local))
    pc.onicecandidate = (e) => { if (e.candidate) send({ type: 'signal', to: id, data: { candidate: e.candidate } }) }
    pc.ontrack = (e) => {
      const stream = e.streams[0] || new MediaStream([e.track])
      let el = r.box?.querySelector(`[data-peer="${id}"]`)
      if (!el) { el = document.createElement('audio'); el.dataset.peer = id; el.autoplay = true; el.playsInline = true; r.box?.appendChild(el) }
      el.srcObject = stream
      el.play?.().catch(() => setBlocked(true))
      watch(id, stream)
    }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' && initiator) { try { pc.restartIce() } catch { /* ya cerrada */ } }
    }
    if (initiator) {
      pc.onnegotiationneeded = async () => {
        try { await pc.setLocalDescription(await pc.createOffer()); send({ type: 'signal', to: id, data: { sdp: pc.localDescription } }) } catch { /* se reintenta con el próximo evento */ }
      }
    }
    return pc
  }, [watch])

  const onSignal = useCallback(async (from, data) => {
    const r = R.current
    const pc = makePeer(from, false)
    try {
      if (data?.sdp) {
        await pc.setRemoteDescription(data.sdp)
        for (const c of r.pending.get(from) || []) await pc.addIceCandidate(c).catch(() => {})
        r.pending.delete(from)
        if (data.sdp.type === 'offer') { await pc.setLocalDescription(await pc.createAnswer()); send({ type: 'signal', to: from, data: { sdp: pc.localDescription } }) }
      } else if (data?.candidate) {
        if (pc.remoteDescription) await pc.addIceCandidate(data.candidate).catch(() => {})
        else r.pending.set(from, [...(r.pending.get(from) || []), data.candidate])
      }
    } catch { /* un mensaje de señalización roto no tumba la llamada */ }
  }, [makePeer])

  const teardown = useCallback((keepMic = false) => {
    const r = R.current
    r.closing = true
    clearInterval(r.timer); r.timer = null
    r.pcs.forEach((pc) => pc.close()); r.pcs.clear(); r.pending.clear(); r.meters.clear(); r.speak.clear()
    try { r.ws?.close(1000) } catch { /* ya cerrado */ }
    r.ws = null
    if (!keepMic) { r.local?.getTracks().forEach((t) => t.stop()); r.local = null; r.ctx?.close?.().catch(() => {}); r.ctx = null }
    r.box?.remove(); r.box = null
    setPeers({}); setMeSpeaking(false); setBlocked(false)
  }, [])

  const connect = useCallback(async () => {
    const r = R.current
    r.closing = false
    const t = await getToken(code)
    if (!t.ok) { setStatus('error'); setError(t.error === 'voice_unavailable' ? 'voice_unavailable' : t.error || 'voice_failed'); return }
    await new Promise((resolve) => {
      let ws
      try { ws = new WebSocket(`${t.data.url}?token=${encodeURIComponent(t.data.token)}`) } catch { resolve(); setStatus('error'); setError('voice_failed'); return }
      r.ws = ws
      let opened = false
      ws.onopen = () => { opened = true }
      ws.onmessage = (ev) => {
        let m; try { m = JSON.parse(ev.data) } catch { return }
        if (m.type === 'welcome') {
          r.myId = m.id; r.ice = m.ice || []; r.retries = 0
          setStatus('on'); setError(null)
          m.peers.forEach((p) => { setPeer(p.id, { handle: p.handle, name: p.name, muted: p.muted }); makePeer(p.id, true) })   // quien llega llama a los que ya estaban
          if (r.muted) send({ type: 'mute', muted: true })
        } else if (m.type === 'peer-joined') setPeer(m.peer.id, { handle: m.peer.handle, name: m.peer.name, muted: m.peer.muted })
        else if (m.type === 'peer-left') dropPeer(m.id)
        else if (m.type === 'peer-state') setPeer(m.id, { muted: m.muted })
        else if (m.type === 'signal') onSignal(m.from, m.data)
      }
      ws.onclose = (ev) => {
        resolve()
        if (r.closing) return
        r.pcs.forEach((pc) => pc.close()); r.pcs.clear(); r.pending.clear(); setPeers({})
        const act = closeAction(ev.code)
        if (act.error) { teardown(); setStatus('error'); setError(act.error); return }
        if (act.retry && r.retries < MAX_RETRIES) {
          r.retries += 1
          setStatus('connecting')
          setTimeout(() => { if (!r.closing) connect() }, opened ? 800 : RETRY_MS)
        } else { teardown(); setStatus('error'); setError('voice_failed') }
      }
      ws.onerror = () => {}
    })
  }, [code, getToken, makePeer, onSignal, setPeer, dropPeer, teardown])

  const join = useCallback(async () => {
    const r = R.current
    if (status === 'connecting' || status === 'on') return
    if (!voiceSupported()) { setStatus('error'); setError('unsupported'); return }
    setStatus('connecting'); setError(null); r.retries = 0
    try {
      r.local = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false })
    } catch (e) {
      setStatus('error'); setError(e?.name === 'NotFoundError' ? 'mic_missing' : 'mic_denied'); return
    }
    r.muted = false; setMuted(false)
    r.box = document.createElement('div'); r.box.id = 'lh-voice-audio'; r.box.style.display = 'none'; document.body.appendChild(r.box)
    watch('me', r.local)
    await connect()
  }, [status, watch, connect])

  const leave = useCallback(() => { teardown(); setStatus('off'); setError(null) }, [teardown])

  const toggleMute = useCallback(() => {
    const r = R.current
    r.muted = !r.muted
    r.local?.getAudioTracks().forEach((t) => { t.enabled = !r.muted })
    setMuted(r.muted)
    send({ type: 'mute', muted: r.muted })
  }, [])

  const unblock = useCallback(() => {
    R.current.box?.querySelectorAll('audio').forEach((a) => a.play?.().catch(() => {}))
    R.current.ctx?.resume?.()
    setBlocked(false)
  }, [])

  // Cambiar de sala o desmontar = colgar
  useEffect(() => () => { teardown() }, [code, teardown])

  return { status, error, muted, peers, meSpeaking, blocked, join, leave, toggleMute, unblock }
}
