import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, FilmSlate, Wrench } from '@phosphor-icons/react'
import { useSEO } from '../../lib/useSEO'

// Sección EN CONSTRUCCIÓN — bloqueada temporalmente.
// El código de geolocalización + Overpass está preservado en git; cuando
// se termine se reactiva el flujo. No se pide ubicación ni se hace fetch.
export default function CinesCerca() {
  const navigate = useNavigate()

  useSEO({
    title: 'Cines cerca tuyo — próximamente',
    description: 'Función en desarrollo.',
    noindex: true,
  })

  return (
    <motion.main
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="min-h-screen bg-void pt-24 pb-24"
    >
      <div className="max-w-2xl mx-auto px-6 md:px-12">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => navigate('/')}
            className="w-9 h-9 rounded-full glass border border-white/10 flex items-center justify-center text-muted hover:text-gold">
            <ArrowLeft size={16} />
          </button>
          <h1 className="font-display font-extrabold text-2xl text-chalk">Cines cerca tuyo</h1>
        </div>

        <div className="flex flex-col items-center justify-center text-center gap-4 py-16 px-6 rounded-2xl bg-surface border border-white/10">
          <div className="w-16 h-16 rounded-full bg-gold/15 flex items-center justify-center">
            <Wrench size={28} weight="fill" className="text-gold" />
          </div>
          <div className="space-y-2">
            <p className="text-chalk font-display font-bold text-xl">Sección en construcción</p>
            <p className="text-muted text-sm max-w-md leading-relaxed">
              Estamos terminando la búsqueda de cines cercanos. Va a volver pronto,
              más precisa y estable. Gracias por la paciencia.
            </p>
          </div>
          <button onClick={() => navigate('/')}
            className="mt-2 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gold text-void font-bold text-sm hover:bg-gold-hi transition-colors">
            <FilmSlate size={16} weight="fill" />
            Volver al catálogo
          </button>
        </div>
      </div>
    </motion.main>
  )
}
