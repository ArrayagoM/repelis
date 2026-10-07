import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Popcorn, SpinnerGap } from '@phosphor-icons/react'
import { ensureAccount, refreshMe } from '../../lib/social'
import { rooms, roomErrorText } from '../../lib/rooms'
import { showToast } from '../../lib/toast'

/**
 * "Iniciar sala en grupo" desde la ficha de una película o serie: con cuenta, un solo toque abre la sala con este título y
 * te lleva adentro (el @usuario se crea solo). Después se invita con el enlace y se puede poner un horario. item = toLibItem(...)
 */
export default function RoomButton({ item, className = '' }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  if (!item?.id) return null

  const go = async () => {
    if (busy) return
    if (!(await ensureAccount(item.title))) return          // sin cuenta: se pide ingresar o crear una
    setBusy(true)
    const r = await rooms.create({
      title: `Vemos ${item.title}`.slice(0, 60),
      item: { type: item.type, id: item.id, title: item.title, poster: item.poster || null, year: (item.date || '').slice(0, 4) || null },
    })
    setBusy(false)
    if (!r.ok) return showToast({ icon: '⚠️', title: roomErrorText(r.error), ttl: 5000, tone: 'blue' })
    refreshMe()                                              // el perfil pudo crearse en este momento
    navigate(`/sala/${r.data.room.code}`)
  }

  return (
    <button onClick={go} disabled={busy}
      className={`flex items-center gap-2 px-5 py-3 rounded-full border text-sm font-medium transition-all duration-300 glass border-white/10 text-chalk hover:border-gold/30 hover:text-gold disabled:opacity-60 ${className}`}>
      {busy ? <SpinnerGap size={16} className="animate-spin" /> : <Popcorn size={16} weight="bold" />} Iniciar sala en grupo
    </button>
  )
}
