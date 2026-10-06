import { useNavigate } from 'react-router-dom'
import { Popcorn } from '@phosphor-icons/react'
import { ensureAccount } from '../../lib/social'

/** "Crear una sala" con esta película o serie ya elegida (desde la ficha). item = toLibItem(...) */
export default function RoomButton({ item, className = '' }) {
  const navigate = useNavigate()
  if (!item?.id) return null
  const go = async () => {
    if (!(await ensureAccount(item.title))) return
    navigate('/salas', {
      state: {
        title: `Vemos ${item.title}`,
        item: { type: item.type, id: item.id, title: item.title, poster: item.poster || null, year: (item.date || '').slice(0, 4) || null },
      },
    })
  }
  return (
    <button onClick={go}
      className={`flex items-center gap-2 px-5 py-3 rounded-full border text-sm font-medium transition-all duration-300 glass border-white/10 text-chalk hover:border-gold/30 hover:text-gold ${className}`}>
      <Popcorn size={16} weight="bold" /> Crear sala
    </button>
  )
}
