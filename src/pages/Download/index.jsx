import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, DeviceMobile, CheckCircle, Warning, Lightning,
  DownloadSimple, Television, GithubLogo,
} from '@phosphor-icons/react'
import DownloadAPK from '../../components/DownloadAPK'
import { APK_INFO, APK_RELEASES_PAGE, isAndroid } from '../../lib/apkInfo'
import { useSEO } from '../../lib/useSEO'

export default function Download() {
  useSEO({
    title: 'Descargar APK Android · Life High',
    description: 'Instalá Life High como app nativa en tu Android, TV o proyector. APK gratuito, compatible con Android 5.0 en adelante.',
    keywords: 'descargar life high apk, life high android, instalar life high tv, apk android peliculas',
  })

  return (
    <motion.main
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="min-h-screen bg-void pt-24 pb-24"
    >
      <div className="max-w-3xl mx-auto px-6 md:px-12">
        <Link to="/" className="inline-flex items-center gap-2 text-muted hover:text-gold transition-colors mb-8 text-sm">
          <ArrowLeft size={14} /> Volver al inicio
        </Link>

        {/* Hero */}
        <header className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-[0_8px_32px_rgba(16,185,129,0.4)] mb-4">
            <DeviceMobile size={36} weight="fill" className="text-void" />
          </div>
          <h1 className="font-display font-extrabold text-4xl text-chalk tracking-tight">
            Life High en tu Android
          </h1>
          <p className="text-muted text-base mt-3 max-w-md mx-auto">
            App nativa para celular, tablet, TV o proyector. Sin Play Store, sin cuentas, gratis.
          </p>

          <div className="mt-8 flex justify-center">
            <DownloadAPK variant="big" />
          </div>

          <p className="text-muted/50 text-[11px] mt-3 font-mono">
            Compatibilidad: Android {APK_INFO.minAndroid}+ · {APK_INFO.size} · {APK_INFO.arch}
          </p>
        </header>

        {/* Por qué APK */}
        <section className="mb-10 p-5 rounded-2xl bg-gradient-to-br from-gold/10 to-gold/0 border border-gold/20">
          <p className="text-chalk font-display font-bold text-lg mb-2 flex items-center gap-2">
            <Lightning size={18} weight="fill" className="text-gold" />
            ¿Por qué la APK en vez de la web?
          </p>
          <ul className="space-y-1.5 text-muted text-sm">
            <li className="flex gap-2"><CheckCircle size={14} weight="fill" className="text-emerald-400 flex-shrink-0 mt-0.5" /> Pantalla completa sin barras del browser</li>
            <li className="flex gap-2"><CheckCircle size={14} weight="fill" className="text-emerald-400 flex-shrink-0 mt-0.5" /> Funciona en proyectores Android donde Chrome se queda sin RAM</li>
            <li className="flex gap-2"><CheckCircle size={14} weight="fill" className="text-emerald-400 flex-shrink-0 mt-0.5" /> Ícono directo en el launcher de tu TV / celular</li>
            <li className="flex gap-2"><CheckCircle size={14} weight="fill" className="text-emerald-400 flex-shrink-0 mt-0.5" /> Misma app que <code className="font-mono text-gold">repelis.vercel.app</code> — auto-actualiza con cada deploy</li>
          </ul>
        </section>

        {/* Pasos de instalación */}
        <section className="mb-10">
          <h2 className="font-display font-bold text-2xl text-chalk mb-4">Cómo instalarlo</h2>

          {isAndroid() ? (
            <Step n={1} title="Tap en 'Descargar APK' arriba">
              Se baja el archivo a tu carpeta de Descargas (~6 MB).
            </Step>
          ) : (
            <Step n={1} title="Descargá el APK en tu PC">
              Tap el botón verde de arriba. Te baja <code className="font-mono">lifehigh.apk</code>.
            </Step>
          )}

          {!isAndroid() && (
            <Step n={2} title="Pasalo al Android">
              Por <strong className="text-chalk/85">pendrive USB</strong>, Google Drive, WhatsApp Web a vos mismo, o cable USB con explorador.
            </Step>
          )}

          <Step n={isAndroid() ? 2 : 3} title="Abrí el archivo .apk">
            Desde el explorador de archivos del Android, tap en <code className="font-mono">lifehigh.apk</code>.
          </Step>

          <Step n={isAndroid() ? 3 : 4} title="Permitir fuentes desconocidas">
            La primera vez Android te avisa "<em className="text-chalk/70">No se permite la instalación</em>".
            Tap en <strong className="text-gold/90">Configuración</strong> → activá <strong className="text-gold/90">Permitir esta fuente</strong> → volvé atrás.
          </Step>

          <Step n={isAndroid() ? 4 : 5} title="Instalar" last>
            Tap <strong className="text-emerald-400">Instalar</strong>. Espera 5s → listo, queda el ícono en el launcher.
          </Step>
        </section>

        {/* Para TV / proyector */}
        <section className="mb-10 p-5 rounded-2xl bg-surface border border-white/10">
          <p className="text-chalk font-display font-bold text-lg mb-2 flex items-center gap-2">
            <Television size={18} weight="fill" className="text-blue-400" />
            En TV Android o proyector
          </p>
          <ol className="space-y-1.5 text-muted text-sm list-decimal list-inside marker:text-blue-400/60">
            <li>Bajá el APK en tu PC desde el botón verde arriba</li>
            <li>Copialo a un pendrive USB</li>
            <li>Enchufá el pendrive a la TV / proyector</li>
            <li>Abrí el explorador de archivos del dispositivo</li>
            <li>Tap en <code className="font-mono">lifehigh.apk</code> → Instalar</li>
            <li>El ícono aparece junto a Netflix, YouTube, etc.</li>
          </ol>
          <p className="text-muted/60 text-xs mt-3">
            Si el explorador no aparece, instalá <strong>ES File Explorer</strong> o <strong>X-plore</strong> desde la tienda del TV.
          </p>
        </section>

        {/* Troubleshooting */}
        <section className="mb-10 p-5 rounded-2xl bg-amber-500/5 border border-amber-500/20">
          <p className="text-amber-300 font-bold text-sm mb-3 flex items-center gap-2">
            <Warning size={14} weight="fill" />
            ¿Algún error al instalar?
          </p>
          <div className="space-y-2 text-muted text-xs">
            <p><strong className="text-amber-200">"App no instalada"</strong> → ya hay una versión instalada, desinstalala primero.</p>
            <p><strong className="text-amber-200">"Parse error"</strong> → re-descargá el APK, se cortó la descarga.</p>
            <p><strong className="text-amber-200">"App no compatible"</strong> → tu Android es muy viejo (&lt;5.0).</p>
            <p><strong className="text-amber-200">"Bloqueado por Play Protect"</strong> → tap "Instalar de todas formas" abajo a la derecha.</p>
            <p><strong className="text-amber-200">Pantalla blanca al abrir</strong> → actualizá <strong>Android System WebView</strong> en Play Store.</p>
          </div>
        </section>

        {/* Historial de versiones */}
        <section className="text-center">
          <a href={APK_RELEASES_PAGE} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-muted hover:text-gold text-xs transition-colors">
            <GithubLogo size={12} weight="fill" />
            Ver historial de versiones en GitHub
          </a>
        </section>
      </div>
    </motion.main>
  )
}

function Step({ n, title, children, last = false }) {
  return (
    <div className={`flex gap-4 ${last ? '' : 'pb-5 border-b border-white/5'} mb-5`}>
      <div className="w-9 h-9 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center justify-center font-bold text-sm flex-shrink-0">
        {n}
      </div>
      <div className="flex-1">
        <p className="text-chalk font-display font-semibold text-base">{title}</p>
        <div className="text-muted text-sm mt-1">{children}</div>
      </div>
    </div>
  )
}
