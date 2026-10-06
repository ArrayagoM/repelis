import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './auth'
import { useMe } from './social'
import { useRoom, rooms } from './rooms'
import { useVoice } from './voice'

// La sala vive en la RAÍZ de la app (no en la página): así la presencia y, más adelante, la voz siguen activas
// mientras mirás la película en la misma pestaña o navegás por el sitio. Se ve como una "llamada": barra flotante + cajón de chat opcional.

const KEY = 'lifehigh:room:v1'
const read = () => { try { return sessionStorage.getItem(KEY) } catch { return null } }
const write = (v) => { try { if (v) sessionStorage.setItem(KEY, v); else sessionStorage.removeItem(KEY) } catch { /* sin storage */ } }

const Ctx = createContext(null)
export const useRoomSession = () => useContext(Ctx)

export function RoomProvider({ children }) {
  const auth = useAuth()
  const me = useMe()
  const [code, setCode] = useState(read)
  const [chatOpen, setChatOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const ready = auth.status === 'in' && !!me.data?.profile
  const live = useRoom(code, ready && !!code)
  const voice = useVoice(code, rooms)

  const enter = useCallback((c) => { setCode(c); write(c) }, [])
  const exit = useCallback(async () => {
    voice.leave()
    if (code) await live.leave()
    setCode(null); write(null); setChatOpen(false); setUnread(0)
  }, [code, live, voice])

  // Sin sesión no hay sala; si la sala terminó o te sacaron, se limpia solo al salir de la pantalla de error
  useEffect(() => { if (auth.status === 'out') { setCode(null); write(null) } }, [auth.status])

  // Mensajes sin leer mientras el cajón está cerrado (solo mensajes de otras personas)
  const seen = useRef(0)
  useEffect(() => {
    const last = live.messages.reduce((m, x) => Math.max(m, x.seq), 0)
    if (chatOpen) { seen.current = last; setUnread(0); return }
    const fresh = live.messages.filter((m) => m.seq > seen.current && m.kind === 'msg' && !m.mine).length
    if (seen.current === 0) { seen.current = last; return }          // primera carga: no cuenta como "nuevo"
    if (fresh) { seen.current = last; setUnread((u) => u + fresh) } else seen.current = Math.max(seen.current, last)
  }, [live.messages, chatOpen])

  // Personas de la sala con su estado de voz (hablando / silenciada / en la llamada)
  const byHandle = useMemo(() => Object.fromEntries(Object.values(voice.peers).map((p) => [p.handle, p])), [voice.peers])
  const members = useMemo(() => live.members.map((m) => {
    const inVoice = m.me ? voice.status === 'on' : !!byHandle[m.handle]
    const p = byHandle[m.handle]
    return { ...m, inVoice, muted: inVoice && (m.me ? voice.muted : !!p?.muted), speaking: inVoice && (m.me ? voice.meSpeaking && !voice.muted : !!p?.speaking) }
  }), [live.members, byHandle, voice.status, voice.muted, voice.meSpeaking])

  const value = useMemo(() => ({ code, live, voice, members, enter, exit, chatOpen, setChatOpen, unread, ready }), [code, live, voice, members, enter, exit, chatOpen, unread, ready])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
