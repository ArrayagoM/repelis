import { useEffect } from 'react'
import { Microphone, MicrophoneSlash, Headphones, PhoneDisconnect, SpinnerGap, SpeakerSlash } from '@phosphor-icons/react'
import { useRoomSession } from '../../lib/roomSession'
import { voiceErrorText } from '../../lib/voice'
import { showToast } from '../../lib/toast'

/**
 * Controles de voz de la sala: unirse, silenciar, colgar. Solo aparece si hay servidor de voz configurado.
 * `size` = tamaño de los botones (la barra de la sala usa 40, la barra flotante 36).
 */
export default function VoiceControls({ size = 40 }) {
  const s = useRoomSession()
  const v = s?.voice
  const available = !!s?.live.room?.voice?.available

  // Los errores de voz se muestran una vez como aviso (no se quedan pegados en la barra)
  useEffect(() => { if (v?.status === 'error' && v.error) showToast({ icon: '🎙️', title: voiceErrorText(v.error), ttl: 6000, tone: 'blue' }) }, [v?.status, v?.error]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!available || !v) return null
  const box = { width: size, height: size }
  const base = 'rounded-full flex items-center justify-center transition-colors'

  if (v.status === 'connecting') {
    return <button disabled style={box} aria-label="Conectando la voz" className={`${base} text-gold`}><SpinnerGap size={size * 0.5} className="animate-spin" /></button>
  }
  if (v.status !== 'on') {
    return (
      <button onClick={v.join} style={box} aria-label="Unirme a la voz" title="Unirme a la voz (usá auriculares para evitar eco)"
        className={`${base} bg-gold text-void hover:bg-gold-hi`}><Headphones size={size * 0.5} weight="fill" /></button>
    )
  }
  return (
    <>
      {v.blocked && (
        <button onClick={v.unblock} style={{ height: size }} className="px-3 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-semibold flex items-center gap-1.5">
          <SpeakerSlash size={14} /> Activar audio
        </button>
      )}
      <button onClick={v.toggleMute} style={box} aria-pressed={v.muted} aria-label={v.muted ? 'Activar micrófono' : 'Silenciar micrófono'}
        className={`${base} ${v.muted ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' : v.meSpeaking ? 'bg-emerald-500/25 text-emerald-300 ring-2 ring-emerald-400' : 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'}`}>
        {v.muted ? <MicrophoneSlash size={size * 0.5} weight="fill" /> : <Microphone size={size * 0.5} weight="fill" />}
      </button>
      <button onClick={v.leave} style={box} aria-label="Salir de la voz" title="Salir de la voz (seguís en la sala)" className={`${base} text-muted hover:text-red-300 hover:bg-red-500/10`}>
        <PhoneDisconnect size={size * 0.45} />
      </button>
    </>
  )
}
