import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { BookmarkSimple, LockKey } from '@phosphor-icons/react'
import { ContinueRow, MyListRow, RemindersRow } from '../../components/MyLibrary'
import { AchievementsPanel } from '../../components/Achievements'
import { useLibrary, continueWatching } from '../../lib/library'
import { isLibraryEmpty } from '../../lib/libraryMerge'
import { useSEO } from '../../lib/useSEO'
import { useAuth } from '../../lib/auth'
import { canUsePersonal } from '../../lib/access'

export default function MiLista() {
  const lib = useLibrary()
  const auth = useAuth()
  useSEO({ title: 'Mi lista', description: 'Tus películas y series guardadas y lo que estás viendo en Life High.' })
  const personal = canUsePersonal(auth.status)
  const hasContinue = continueWatching(lib).length > 0
  const hasList = lib.list.length > 0
  const hasReminders = lib.reminders.length > 0
  const hadLocalData = !isLibraryEmpty(lib)

  // Sin cuenta: no se muestra la biblioteca; se invita a crearla (lo que ya tenía guardado se suma a la cuenta)
  if (auth.status === 'out') {
    return (
      <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-void pt-28 pb-24 px-6">
        <div className="max-w-md mx-auto text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-gold/10 border border-gold/25 flex items-center justify-center mb-5">
            <LockKey size={28} weight="fill" className="text-gold" />
          </div>
          <h1 className="font-display font-extrabold text-3xl text-chalk">Mi lista es con cuenta</h1>
          <p className="text-muted text-sm mt-3 leading-relaxed">
            Con tu cuenta gratis guardás películas y series, seguís viendo donde lo dejaste y lo tenés en todos tus dispositivos.
            Ver y buscar sigue siendo libre, sin registrarte.
          </p>
          {hadLocalData && (
            <p className="mt-4 p-3 rounded-xl bg-gold/10 border border-gold/25 text-gold/90 text-xs leading-relaxed">
              Lo que ya guardaste en este dispositivo se suma a tu cuenta cuando la creés.
            </p>
          )}
          <div className="mt-6 flex flex-col gap-2">
            <Link to="/cuenta?modo=registro&volver=/mi-lista" className="py-3 rounded-full bg-gold text-void font-bold text-sm hover:bg-gold-hi transition-colors">
              Crear mi cuenta gratis
            </Link>
            <Link to="/cuenta?volver=/mi-lista" className="py-3 rounded-full glass border border-white/10 text-chalk text-sm hover:border-gold/30 hover:text-gold transition-colors">
              Ya tengo cuenta
            </Link>
          </div>
        </div>
      </motion.main>
    )
  }

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
      </div>

      <div className="space-y-12">
        {personal && hasContinue && <ContinueRow />}
        {personal && hasReminders && <RemindersRow />}
        {personal && hasList && <MyListRow limit={200} />}

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
        {personal && <AchievementsPanel />}
      </div>
    </motion.main>
  )
}
