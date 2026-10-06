// Voz de las salas: WebRTC en malla (cada persona se conecta directo con las demás; el audio NO pasa por nuestros servidores).
// Para armar cada conexión solo se intercambian unos pocos mensajes chicos ("señales") por nuestra propia API: no hace falta
// ningún servidor extra ni nada prendido. Hasta 12 personas, solo audio.
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

/**
 * ¿Quién llama a quién? Siempre llama la persona que entró DESPUÉS (así nunca se cruzan dos ofertas a la vez).
 * `mine`/`theirs` = momento en que cada una entró a la llamada; si empatan, decide el @usuario.
 */
export const shouldInitiate = (mine, theirs, myHandle, theirHandle) =>
  mine > theirs || (mine === theirs && myHandle > theirHandle)

/** Cada cuánto consultar señales (ms): rápido mientras se conecta o acaba de entrar alguien, lento cuando todo está estable. */
export const SIGNAL_FAST_MS = 700
export const SIGNAL_SLOW_MS = 4000
export const signalDelay = ({ negotiating, recentChange }) => (negotiating || recentChange ? SIGNAL_FAST_MS : SIGNAL_SLOW_MS)

export const VOICE_ERRORS = {
  mic_denied: 'El navegador no te dejó usar el micrófono. Habilitalo desde el candado de la barra de direcciones.',
  mic_missing: 'No encontramos un micrófono en este dispositivo.',
  voice_unavailable: 'La voz todavía no está disponible.',
  kicked: 'El anfitrión te sacó de la sala.',
  room_closed: 'La sala terminó.',
  voice_failed: 'No pudimos conectar la voz. Revisá tu internet y probá de nuevo.',
  unsupported: 'Este navegador no admite llamadas de voz.',
}
export const voiceErrorText = (code) => VOICE_ERRORS[code] || VOICE_ERRORS.voice_failed

export const voiceSupported = () =>
  typeof window !== 'undefined' && !!window.RTCPeerConnection && !!navigator.mediaDevices?.getUserMedia

// ─── Hook ───────────────────────────────────────────────────────────────

/**
 * @param {string|null} code  sala
 * @param {{ voice, signal, signals }} api  llamadas a la API de salas (src/lib/rooms.js)
 * @returns {{ status:'off'|'connecting'|'on'|'error', error:string|null, muted:boolean, peers:Record<string,{handle,name,muted,speaking}>,
 *            meSpeaking:boolean, blocked:boolean, join:Function, leave:Function, toggleMute:Function, unblock:Function }}
 */
export const useVoice = (code, api) => {
  const [status, setStatus] = useState('off')
  const [error, setError] = useState(null)
  const [muted, setMuted] = useState(false)
  const [peers, setPeers] = useState({})          // clave = @usuario
  const [meSpeaking, setMeSpeaking] = useState(false)
  const [blocked, setBlocked] = useState(false)

  const R = useRef({ active: false, since: 0, handle: '', pcs: new Map(), pending: new Map(), roster: new Map(), local: null, ice: [],
    ctx: null, meters: new Map(), speak: new Map(), timer: null, loop: null, box: null, muted: false, lastChange: 0, fails: 0 })

  const dropPeer = useCallback((handle) => {
    const r = R.current
    r.pcs.get(handle)?.close(); r.pcs.delete(handle); r.pending.delete(handle); r.meters.delete(handle); r.speak.delete(handle); r.roster.delete(handle)
    r.box?.querySelector(`[data-peer="${handle}"]`)?.remove()
    setPeers((p) => { if (!p[handle]) return p; const n = { ...p }; delete n[handle]; return n })
  }, [])

  // Medidor de nivel (quién habla): un solo temporizador para todos
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

  const sendSignal = useCallback((to, data) => { api.signal(code, to, data).catch?.(() => {}) }, [api, code])

  const makePeer = useCallback((handle, initiator) => {
    const r = R.current
    if (r.pcs.has(handle)) return r.pcs.get(handle)
    const pc = new RTCPeerConnection({ iceServers: r.ice })
    r.pcs.set(handle, pc)
    r.local?.getTracks().forEach((t) => pc.addTrack(t, r.local))
    pc.onicecandidate = (e) => { if (e.candidate) sendSignal(handle, { candidate: e.candidate }) }
    pc.ontrack = (e) => {
      const stream = e.streams[0] || new MediaStream([e.track])
      let el = r.box?.querySelector(`[data-peer="${handle}"]`)
      if (!el) { el = document.createElement('audio'); el.dataset.peer = handle; el.autoplay = true; el.playsInline = true; r.box?.appendChild(el) }
      el.srcObject = stream
      el.play?.().catch(() => setBlocked(true))
      watch(handle, stream)
    }
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed' && initiator) { try { pc.restartIce() } catch { /* ya cerrada */ } } }
    if (initiator) {
      pc.onnegotiationneeded = async () => {
        try { await pc.setLocalDescription(await pc.createOffer()); sendSignal(handle, { sdp: pc.localDescription }) } catch { /* se reintenta con el próximo evento */ }
      }
    }
    return pc
  }, [watch, sendSignal])

  const onSignal = useCallback(async (from, data) => {
    const r = R.current
    if (!r.active) return
    const pc = makePeer(from, false)
    try {
      if (data?.sdp) {
        await pc.setRemoteDescription(data.sdp)
        for (const c of r.pending.get(from) || []) await pc.addIceCandidate(c).catch(() => {})
        r.pending.delete(from)
        if (data.sdp.type === 'offer') { await pc.setLocalDescription(await pc.createAnswer()); sendSignal(from, { sdp: pc.localDescription }) }
      } else if (data?.candidate) {
        if (pc.remoteDescription) await pc.addIceCandidate(data.candidate).catch(() => {})
        else r.pending.set(from, [...(r.pending.get(from) || []), data.candidate])
      }
    } catch { /* una señal rota no tumba la llamada */ }
  }, [makePeer, sendSignal])

  /** Sincroniza la lista de quienes están en la llamada: crea conexiones nuevas y cierra las de quienes salieron. */
  const applyRoster = useCallback((list) => {
    const r = R.current
    const seen = new Set()
    for (const p of list) {
      seen.add(p.handle)
      const known = r.roster.get(p.handle)
      if (!known) { r.lastChange = Date.now(); setPeers((cur) => ({ ...cur, [p.handle]: { handle: p.handle, name: p.name, muted: p.muted, speaking: false } })) }
      else if (known.muted !== p.muted) setPeers((cur) => (cur[p.handle] ? { ...cur, [p.handle]: { ...cur[p.handle], muted: p.muted } } : cur))
      r.roster.set(p.handle, p)
      if (!r.pcs.has(p.handle) && shouldInitiate(r.since, p.since || 0, r.handle, p.handle)) makePeer(p.handle, true)   // quien llegó después llama
    }
    for (const handle of [...r.roster.keys()]) if (!seen.has(handle)) { r.lastChange = Date.now(); dropPeer(handle) }
  }, [makePeer, dropPeer])

  const stopAll = useCallback(() => {
    const r = R.current
    r.active = false
    clearTimeout(r.loop); r.loop = null
    clearInterval(r.timer); r.timer = null
    r.pcs.forEach((pc) => pc.close()); r.pcs.clear(); r.pending.clear(); r.meters.clear(); r.speak.clear(); r.roster.clear()
    r.local?.getTracks().forEach((t) => t.stop()); r.local = null
    r.ctx?.close?.().catch(() => {}); r.ctx = null
    r.box?.remove(); r.box = null
    setPeers({}); setMeSpeaking(false); setBlocked(false)
  }, [])

  // Ciclo de señales: rápido mientras se conecta, lento cuando todo está estable
  const startLoop = useCallback(() => {
    const r = R.current
    const tick = async () => {
      if (!r.active) return
      const res = await api.signals(code)
      if (!r.active) return
      if (res.ok) {
        r.fails = 0
        for (const s of res.data.signals) await onSignal(s.from, s.data)
        applyRoster(res.data.peers)
        if (!res.data.me.on) { stopAll(); setStatus('off'); return }              // el servidor ya no nos tiene en la llamada
      } else if (['kicked', 'room_closed', 'room_not_found', 'not_member'].includes(res.error)) {
        stopAll(); setStatus('error'); setError(res.error === 'not_member' ? 'voice_failed' : res.error); return
      } else if ((r.fails += 1) >= 8) { stopAll(); setStatus('error'); setError('voice_failed'); return }
      const negotiating = [...r.pcs.values()].some((pc) => pc.connectionState !== 'connected') || r.pcs.size < r.roster.size
      r.loop = setTimeout(tick, signalDelay({ negotiating, recentChange: Date.now() - r.lastChange < 8000 }))
    }
    r.loop = setTimeout(tick, SIGNAL_FAST_MS)
  }, [api, code, applyRoster, onSignal, stopAll])

  const join = useCallback(async () => {
    const r = R.current
    if (status === 'connecting' || status === 'on') return
    if (!voiceSupported()) { setStatus('error'); setError('unsupported'); return }
    setStatus('connecting'); setError(null)
    try {
      r.local = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false })
    } catch (e) {
      setStatus('error'); setError(e?.name === 'NotFoundError' ? 'mic_missing' : 'mic_denied'); return
    }
    const res = await api.voice(code, { on: true })
    if (!res.ok) { stopAll(); setStatus('error'); setError(res.error === 'voice_unavailable' ? 'voice_unavailable' : res.error || 'voice_failed'); return }
    r.active = true; r.since = res.data.since; r.ice = res.data.ice || []; r.muted = false; r.lastChange = Date.now(); r.fails = 0
    r.handle = res.data.handle || ''
    setMuted(false)
    r.box = document.createElement('div'); r.box.id = 'lh-voice-audio'; r.box.style.display = 'none'; document.body.appendChild(r.box)
    watch('me', r.local)
    setStatus('on')
    applyRoster(res.data.peers)
    startLoop()
  }, [status, api, code, stopAll, watch, applyRoster, startLoop])

  const leave = useCallback(() => {
    const was = R.current.active
    stopAll(); setStatus('off'); setError(null)
    if (was) api.voice(code, { on: false }).catch?.(() => {})
  }, [api, code, stopAll])

  const toggleMute = useCallback(() => {
    const r = R.current
    r.muted = !r.muted
    r.local?.getAudioTracks().forEach((t) => { t.enabled = !r.muted })
    setMuted(r.muted)
    api.voice(code, { muted: r.muted })
  }, [api, code])

  const unblock = useCallback(() => {
    R.current.box?.querySelectorAll('audio').forEach((a) => a.play?.().catch(() => {}))
    R.current.ctx?.resume?.()
    setBlocked(false)
  }, [])

  // Cambiar de sala o desmontar = colgar
  useEffect(() => () => { if (R.current.active) { api.voice(code, { on: false }).catch?.(() => {}); } stopAll() }, [code]) // eslint-disable-line react-hooks/exhaustive-deps

  return { status, error, muted, peers, meSpeaking, blocked, join, leave, toggleMute, unblock }
}
