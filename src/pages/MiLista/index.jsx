import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { BookmarkSimple } from '@phosphor-icons/react'
import { ContinueRow, MyListRow, RemindersRow } from '../../components/MyLibrary'
import { AchievementsPanel } from '../../components/Achievements'
import { useLibrary, continueWatching } from '../../lib/library'
import { useSEO } from '../../lib/useSEO'
import { useAuth } from '../../lib/auth'

export default function MiLista() {
  const lib = useLibrary()
  const auth = useAuth()
  useSEO({ title: 'Mi lista', description: 'Tus películas y series guardadas y lo que estás viendo en Life High.' })
  const hasContinue = continueWatching(lib).length > 0
  const hasList = lib.list.length > 0
  const hasReminders = lib.reminders.length > 0

  return (
    <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-void pt-28 pb-24">
      <div className="max-w-7xl mx-auto px-6 md:px-12 mb-10">
        <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-chalk">Mi espacio</h1>
        {auth.status === 'in' ? (
          <p className="text-muted mt-2 max-w-xl text-sm leading-relaxed">
            Sincronizado con tu cuenta <span className="text-chalk">{auth.user.email}</span>: lo ves igual en todos tus dispositivos.
          </p>
        ) : (
          <p className="text-muted mt-2 max-w-xl text-sm leading-relaxed">
            Se guarda en este dispositivo. Si borrás los datos del navegador, se borra.
          </p>
        )}
        {auth.status === 'out' && (
          <div className="mt-5 max-w-xl flex flex-wrap items-center gap-3 p-4 rounded-2xl bg-gold/10 border border-gold/25">
            <p className="flex-1 min-w-[14rem] text-chalk text-sm leading-snug">
              <strong>Creá tu cuenta gratis</strong> y llevá tu lista, lo que estabas viendo y tus avisos a cualquier dispositivo.
            </p>
            <Link to="/cuenta" className="px-5 py-2.5 rounded-full bg-gold text-void font-bold text-sm hover:bg-gold-hi transition-colors">
              Ingresar o crear cuenta
            </Link>
          </div>
        )}
      </div>

      <div className="space-y-12">
        {hasContinue && <ContinueRow />}
        {hasReminders && <RemindersRow />}
        {hasList && <MyListRow limit={200} />}

        {!hasContinue && !hasList && !hasReminders && (
          <div className="max-w-xl mx-auto px-6 text-center py-16">
            <div className="w-16 h-16 mx-auto rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center mb-5">
              <BookmarkSimple size={28} weight="fill" className="text-gold" />
            </div>
            <p className="text-chalk font-display font-bold text-xl">Todavía no guardaste nada</p>
            <p className="text-muted text-sm mt-2 leading-relaxed">
              Tocá el <strong className="text-chalk">+</strong> en cualquier póster o el botón <strong className="text-chalk">Mi lista</strong> en una película o serie.
              Lo que empieces a ver aparece acá para seguir donde lo dejaste.
            </p>
            <Link to="/" className="inline-block mt-6 px-6 py-2.5 rounded-full bg-gold text-void font-semibold text-sm hover:bg-gold-hi transition-colors">
              Explorar el catálogo
            </Link>
          </div>
        )}
        <AchievementsPanel />
      </div>
    </motion.main>
  )
}
