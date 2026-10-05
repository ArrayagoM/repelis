import { Plus, Check, BookmarkSimple } from '@phosphor-icons/react'
import { useLibrary, toggleList, isInList } from '../../lib/library'
import { showToast } from '../../lib/toast'

/**
 * "Mi lista": agrega/quita un título. `item` = toLibItem(...)
 * variant 'full'    → botón con texto (páginas de detalle)
 * variant 'compact' → círculo con ícono (sobre el póster)
 */
export default function ListButton({ item, variant = 'full', className = '' }) {
  const lib = useLibrary()
  if (!item?.id) return null
  const inList = isInList(lib, item.type, item.id)

  const onClick = (e) => {
    e.stopPropagation()
    const added = toggleList(item)
    if (added) {
      showToast({ icon: '✅', title: 'Agregado a Mi lista', text: item.title, actionLabel: 'Ver mi lista', to: '/mi-lista', ttl: 4000, tone: 'green' })
    }
  }

  if (variant === 'compact') {
    return (
      <button
        onClick={onClick}
        aria-pressed={inList}
        aria-label={inList ? `Quitar ${item.title} de Mi lista` : `Agregar ${item.title} a Mi lista`}
        title={inList ? 'Quitar de Mi lista' : 'Agregar a Mi lista'}
        className={`w-8 h-8 rounded-full backdrop-blur-sm border flex items-center justify-center transition-all duration-200
          ${inList ? 'bg-gold text-void border-gold' : 'bg-void/70 text-chalk border-white/20 hover:border-gold/60 hover:text-gold'} ${className}`}
      >
        {inList ? <Check size={14} weight="bold" /> : <Plus size={14} weight="bold" />}
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      aria-pressed={inList}
      className={`flex items-center gap-2 px-5 py-3 rounded-full border text-sm font-medium transition-all duration-300
        ${inList ? 'bg-gold/15 border-gold/40 text-gold' : 'glass border-white/10 text-chalk hover:border-gold/30 hover:text-gold'} ${className}`}
    >
      {inList ? <Check size={16} weight="bold" /> : <BookmarkSimple size={16} weight="bold" />}
      {inList ? 'En Mi lista' : 'Mi lista'}
    </button>
  )
}
