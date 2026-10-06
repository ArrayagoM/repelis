// Servidores ICE para las llamadas de voz (WebRTC). Por defecto, STUN público (alcanza para la mayoría de las redes).
// Para las redes que bloquean la conexión directa (~15 %) se puede sumar un servidor TURN con la variable ICE_SERVERS (JSON), por ejemplo:
//   [{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:turn.ejemplo.com:3478","username":"usuario","credential":"clave"}]
const FALLBACK = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }]

export const parseIceServers = (raw) => {
  if (!raw) return FALLBACK
  try {
    const list = JSON.parse(raw)
    if (!Array.isArray(list) || !list.length) return FALLBACK
    // Solo se aceptan entradas con forma válida (no se reenvía cualquier cosa a los clientes)
    const ok = list.filter((s) => s && (typeof s.urls === 'string' || Array.isArray(s.urls))
      && [].concat(s.urls).every((u) => /^(stun|stuns|turn|turns):[^\s]+$/i.test(u)))
    return ok.length ? ok.map((s) => ({ urls: s.urls, ...(s.username ? { username: String(s.username) } : {}), ...(s.credential ? { credential: String(s.credential) } : {}) })) : FALLBACK
  } catch { return FALLBACK }
}
