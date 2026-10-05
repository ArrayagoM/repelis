import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, AndroidLogo, AppleLogo, WindowsLogo, LinuxLogo, Television, Desktop,
  DownloadSimple, Globe, CheckCircle, Warning, GithubLogo, Lightning, DeviceMobile,
} from '@phosphor-icons/react'
import {
  DOWNLOADS, RELEASES_PAGE, WEB_URL, TV_SHORT_LINK, recommendedFor,
} from '../../lib/downloads'
import { useSEO } from '../../lib/useSEO'
import { currentPlatform, isStandalone, requestInstall, subscribeInstall } from '../../lib/install'
import { IOSSteps } from '../../components/InstallBanner'

const ICONS = {
  android: AndroidLogo, apple: AppleLogo, windows: WindowsLogo, mac: Desktop, linux: LinuxLogo, tv: Television,
}

const PLATFORM_NAMES = {
  android: 'Android', tv: 'tu TV', ios: 'iPhone / iPad', windows: 'Windows', mac: 'Mac', linux: 'Linux',
  smarttv: 'tu Smart TV', other: 'todas tus pantallas',
}

const GUIDES = [
  { id: 'android', label: 'Android', Icon: AndroidLogo },
  { id: 'tv', label: 'TV / proyector', Icon: Television },
  { id: 'ios', label: 'iPhone / iPad', Icon: AppleLogo },
  { id: 'windows', label: 'Windows', Icon: WindowsLogo },
  { id: 'mac', label: 'Mac', Icon: Desktop },
  { id: 'linux', label: 'Linux', Icon: LinuxLogo },
  { id: 'smarttv', label: 'Samsung / LG', Icon: Globe },
]

export default function Download({ forcePlatform } = {}) {
  useSEO({
    title: 'Descargar Life High · Android, iPhone, TV, Windows y Mac',
    description: 'Instalá Life High en tu celular, tablet, iPad, Android TV, proyector, Windows, Mac o Linux. Gratis y sin cuentas.',
    keywords: 'descargar life high, life high apk, life high android tv, life high ios, life high windows, life high mac, peliculas app',
  })

  const detected = useMemo(() => forcePlatform || currentPlatform(), [forcePlatform])
  const recommended = recommendedFor(detected)
  const [guide, setGuide] = useState(GUIDES.some((g) => g.id === detected) ? detected : 'android')
  const [, refresh] = useState(0)
  useEffect(() => subscribeInstall(() => refresh((n) => n + 1)), [])
  const alreadyInstalled = typeof window !== 'undefined' && isStandalone()
  const apk = DOWNLOADS.find((d) => d.id === 'android')
  const installNow = async () => {
    const result = await requestInstall()
    if (result === 'unavailable') window.location.href = apk.url
  }

  return (
    <motion.main
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="min-h-screen bg-void pt-24 pb-24"
    >
      <div className="max-w-4xl mx-auto px-6 md:px-12">
        <Link to="/" className="inline-flex items-center gap-2 text-muted hover:text-gold transition-colors mb-8 text-sm">
          <ArrowLeft size={14} /> Volver al inicio
        </Link>

        {/* Hero: lo primero que ve cada persona depende de su dispositivo */}
        <header className="mb-12 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-gold to-gold-lo shadow-[0_8px_32px_rgba(232,160,32,0.35)] mb-4">
            <DeviceMobile size={36} weight="fill" className="text-void" />
          </div>

          {alreadyInstalled ? (
            <>
              <h1 className="font-display font-extrabold text-4xl text-chalk tracking-tight">Ya tenés la app instalada</h1>
              <p className="text-muted text-base mt-3 max-w-lg mx-auto">Estás usando Life High como app. Si querés instalarla en otro dispositivo, elegí abajo.</p>
              <Link to="/" className="inline-flex mt-6 px-7 py-3.5 rounded-2xl bg-gold text-void font-extrabold hover:bg-gold-hi transition-colors">Ir al inicio</Link>
            </>
          ) : detected === 'ios' ? (
            <>
              <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-chalk tracking-tight">Instalá Life High en tu iPhone o iPad</h1>
              <p className="text-muted text-base mt-3 max-w-md mx-auto">
                Son 3 toques y tarda 20 segundos. No necesitás la App Store ni bajar nada raro.
              </p>
              <div className="max-w-md mx-auto mt-6 text-left"><IOSSteps /></div>
            </>
          ) : detected === 'tv' ? (
            <>
              <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-chalk tracking-tight">Instalá Life High en tu TV o proyector</h1>
              <p className="text-muted text-base mt-3 max-w-lg mx-auto">Se maneja con el control remoto. Elegí la forma que te resulte más cómoda.</p>
              <div className="mt-8 grid md:grid-cols-2 gap-4 text-left">
                <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/40">
                  <p className="text-emerald-300 text-xs font-bold uppercase tracking-widest mb-3">La forma más fácil</p>
                  <ol className="space-y-3 text-chalk/90 text-sm">
                    <li><strong className="text-chalk">1.</strong> En la tienda de tu TV instalá la app gratuita <strong className="text-gold">Downloader</strong>.</li>
                    <li><strong className="text-chalk">2.</strong> Abrila y escribí exactamente esta dirección:
                      <span className="block mt-2 px-3 py-3 rounded-xl bg-void border border-gold/40 text-gold font-mono text-lg sm:text-xl text-center select-all">{TV_SHORT_LINK}</span>
                    </li>
                    <li><strong className="text-chalk">3.</strong> Cuando termine de descargar, elegí <strong className="text-emerald-300">Instalar</strong>.</li>
                  </ol>
                </div>
                <div className="p-5 rounded-2xl bg-surface border border-white/10 flex flex-col">
                  <p className="text-muted text-xs font-bold uppercase tracking-widest mb-3">Desde este navegador</p>
                  <a
                    href={recommended?.url}
                    autoFocus
                    className="inline-flex items-center justify-center gap-3 px-6 py-5 rounded-2xl bg-emerald-500 text-void font-extrabold text-xl focus:outline-none focus:ring-4 focus:ring-gold"
                  >
                    <DownloadSimple size={26} weight="bold" /> Descargar para TV
                  </a>
                  <p className="text-muted text-sm mt-4 leading-relaxed">
                    Al terminar, abrí el archivo <span className="font-mono text-chalk/80">lifehigh-android-tv.apk</span> desde el administrador de archivos del TV y elegí Instalar. Si te pide permiso para “fuentes desconocidas”, activalo.
                  </p>
                </div>
              </div>
            </>
          ) : detected === 'android' ? (
            <>
              <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-chalk tracking-tight">Instalá Life High en tu Android</h1>
              <p className="text-muted text-base mt-3 max-w-md mx-auto">Gratis y con un solo toque. Queda el ícono en tu pantalla como cualquier otra app.</p>
              <div className="mt-8 flex flex-col items-center gap-3">
                <button
                  onClick={installNow}
                  className="group inline-flex items-center gap-3 px-8 py-5 rounded-2xl bg-emerald-500 text-void font-bold shadow-[0_8px_32px_rgba(16,185,129,0.4)] active:scale-95 transition-all duration-200"
                >
                  <span className="w-11 h-11 rounded-full bg-void/20 flex items-center justify-center">
                    <DownloadSimple size={22} weight="bold" />
                  </span>
                  <span className="text-left leading-tight">
                    <span className="block text-xl font-extrabold">Instalar la app</span>
                    <span className="block text-xs opacity-75">Gratis · Android 7 o superior</span>
                  </span>
                </button>
                <p className="text-muted/70 text-xs max-w-xs">
                  Si Android te pregunta por permisos, tocá <strong className="text-chalk/80">Permitir</strong> y después <strong className="text-chalk/80">Instalar</strong>.
                </p>
              </div>
            </>
          ) : (
            <>
              <h1 className="font-display font-extrabold text-4xl text-chalk tracking-tight">
                Life High en {PLATFORM_NAMES[detected] || PLATFORM_NAMES.other}
              </h1>
              <p className="text-muted text-base mt-3 max-w-lg mx-auto">
                Celular, tablet, iPad, TV, proyector, Windows y Mac. Gratis, sin cuentas y con la misma app en todos lados.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3">
                {recommended ? (
                  <a
                    href={recommended.url}
                    className="group inline-flex items-center gap-3 px-7 py-4 rounded-2xl bg-emerald-500 text-void font-bold shadow-[0_8px_32px_rgba(16,185,129,0.4)] hover:bg-emerald-400 hover:scale-105 active:scale-95 transition-all duration-200"
                  >
                    <span className="w-10 h-10 rounded-full bg-void/20 flex items-center justify-center">
                      <DownloadSimple size={20} weight="bold" />
                    </span>
                    <span className="text-left leading-tight">
                      <span className="block text-lg font-extrabold">Descargar para {PLATFORM_NAMES[detected]}</span>
                      <span className="block text-xs font-mono opacity-70">{recommended.file}</span>
                    </span>
                  </a>
                ) : (
                  <a
                    href={WEB_URL}
                    className="inline-flex items-center gap-3 px-7 py-4 rounded-2xl bg-gold text-void font-bold hover:bg-gold-hi transition-colors"
                  >
                    <Globe size={20} weight="bold" /> Abrir Life High en el navegador
                  </a>
                )}
                <p className="text-muted/50 text-[11px] font-mono">Elegí otra plataforma más abajo</p>
              </div>
            </>
          )}
        </header>

        {/* Todas las descargas */}
        <section className="mb-14" aria-labelledby="todas">
          <h2 id="todas" className="font-display font-bold text-2xl text-chalk mb-5">Todas las descargas</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {DOWNLOADS.map((d) => {
              const Icon = ICONS[d.icon] || Globe
              const isRec = recommended?.id === d.id
              return (
                <a
                  key={d.id}
                  href={d.url}
                  className={`group flex items-start gap-4 p-4 rounded-2xl border transition-all hover:-translate-y-0.5 ${
                    isRec ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-surface border-white/10 hover:border-gold/30'
                  }`}
                >
                  <span className="w-11 h-11 rounded-xl bg-void flex items-center justify-center flex-shrink-0">
                    <Icon size={22} weight="fill" className={isRec ? 'text-emerald-300' : 'text-gold'} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-chalk font-display font-semibold text-sm">{d.label}</span>
                    <span className="block text-muted text-xs mt-1 leading-relaxed">{d.detail}</span>
                    <span className="block text-muted/40 text-[10px] font-mono mt-2 truncate">{d.file}</span>
                  </span>
                  <DownloadSimple size={18} className="text-muted/40 group-hover:text-gold transition-colors flex-shrink-0 mt-1" />
                </a>
              )
            })}
            <a
              href={WEB_URL}
              className="group flex items-start gap-4 p-4 rounded-2xl bg-surface border border-white/10 hover:border-gold/30 transition-all hover:-translate-y-0.5"
            >
              <span className="w-11 h-11 rounded-xl bg-void flex items-center justify-center flex-shrink-0">
                <Globe size={22} weight="fill" className="text-gold" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-chalk font-display font-semibold text-sm">Smart TV Samsung / LG y cualquier navegador</span>
                <span className="block text-muted text-xs mt-1 leading-relaxed">Sin instalar nada: abrí el sitio desde el navegador del TV o instalalo como app desde Chrome/Safari.</span>
                <span className="block text-muted/40 text-[10px] font-mono mt-2 truncate">repelis.vercel.app</span>
              </span>
            </a>
          </div>
        </section>

        {/* Por qué la app */}
        <section className="mb-14 p-5 rounded-2xl bg-gradient-to-br from-gold/10 to-gold/0 border border-gold/20">
          <p className="text-chalk font-display font-bold text-lg mb-3 flex items-center gap-2">
            <Lightning size={18} weight="fill" className="text-gold" /> ¿Por qué la app en vez de la web?
          </p>
          <ul className="space-y-1.5 text-muted text-sm">
            <li className="flex gap-2"><CheckCircle size={14} weight="fill" className="text-emerald-400 flex-shrink-0 mt-0.5" /> Pantalla completa, sin barras del navegador y sin pop-ups de anuncios.</li>
            <li className="flex gap-2"><CheckCircle size={14} weight="fill" className="text-emerald-400 flex-shrink-0 mt-0.5" /> Adaptada a cada pantalla: celular, tablet, iPad, TV con control remoto y escritorio.</li>
            <li className="flex gap-2"><CheckCircle size={14} weight="fill" className="text-emerald-400 flex-shrink-0 mt-0.5" /> Funciona en proyectores y TV box donde el navegador se queda sin memoria.</li>
            <li className="flex gap-2"><CheckCircle size={14} weight="fill" className="text-emerald-400 flex-shrink-0 mt-0.5" /> Ícono directo en tu launcher, escritorio o pantalla de inicio.</li>
          </ul>
        </section>

        {/* Guías de instalación */}
        <section className="mb-14" aria-labelledby="guias">
          <h2 id="guias" className="font-display font-bold text-2xl text-chalk mb-5">Cómo instalarlo</h2>
          <div role="tablist" className="flex gap-1 mb-5 overflow-x-auto pb-1">
            {GUIDES.map(({ id, label, Icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={guide === id}
                onClick={() => setGuide(id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all border ${
                  guide === id ? 'bg-gold/10 text-gold border-gold/20' : 'text-muted hover:text-chalk border-transparent'
                }`}
              >
                <Icon size={14} weight={guide === id ? 'fill' : 'regular'} /> {label}
              </button>
            ))}
          </div>
          <GuideBody id={guide} />
        </section>

        {/* Problemas comunes */}
        <section className="mb-10 p-5 rounded-2xl bg-amber-500/5 border border-amber-500/20">
          <p className="text-amber-300 font-bold text-sm mb-3 flex items-center gap-2">
            <Warning size={14} weight="fill" /> ¿Algún error al instalar?
          </p>
          <div className="space-y-2 text-muted text-xs">
            <p><strong className="text-amber-200">Android “App no instalada”</strong> → ya hay otra versión firmada distinta: desinstalala primero y probá de nuevo.</p>
            <p><strong className="text-amber-200">Android “Parse error”</strong> → la descarga se cortó, volvé a bajar el archivo.</p>
            <p><strong className="text-amber-200">“Bloqueado por Play Protect”</strong> → tocá “Instalar de todas formas”. La app no está en Play Store.</p>
            <p><strong className="text-amber-200">Windows “SmartScreen protegió tu PC”</strong> → tocá “Más información” → “Ejecutar de todas formas”.</p>
            <p><strong className="text-amber-200">Mac “app dañada / de un desarrollador no identificado”</strong> → ver la guía de Mac arriba (un comando en Terminal).</p>
            <p><strong className="text-amber-200">Audio en inglés</strong> → dentro del reproductor abrí <em>Audio / CC</em> y elegí Español/Latino, o cambiá de servidor.</p>
          </div>
        </section>

        <section className="text-center">
          <a href={RELEASES_PAGE} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-muted hover:text-gold text-xs transition-colors">
            <GithubLogo size={12} weight="fill" /> Ver historial de versiones en GitHub
          </a>
        </section>
      </div>
    </motion.main>
  )
}

function GuideBody({ id }) {
  if (id === 'ios') {
    return (
      <div className="space-y-4">
        <IOSSteps />
        <p className="text-muted/60 text-xs leading-relaxed">
          Apple no permite apps como esta en la App Store, por eso se instala desde Safari y funciona igual que una app.
          Solo si sabés usar AltStore o Sideloadly existe también el archivo IPA en la lista de descargas.
        </p>
      </div>
    )
  }

  const content = {
    android: {
      steps: [
        ['Descargá el APK', 'Tocá “Android — celular y tablet” arriba. Se guarda en Descargas.'],
        ['Abrilo', 'Desde el explorador de archivos tocá lifehigh-android.apk.'],
        ['Permití fuentes desconocidas', 'Android te avisa la primera vez: Configuración → activá “Permitir esta fuente” → volvé atrás.'],
        ['Instalá', 'Tocá Instalar. Queda el ícono en tu launcher.'],
      ],
      note: 'La app necesita Android 7.0 o superior. Si tu equipo tiene poca memoria, probá la “versión liviana”. En Android 5 o 6 usá el sitio desde Chrome: menú ⋮ → “Agregar a pantalla de inicio”.',
    },
    tv: {
      steps: [
        ['Con Downloader (lo más fácil)', `Instalá la app gratuita “Downloader” desde la tienda de tu Android TV / Fire TV, abrila y escribí ${TV_SHORT_LINK} y confirmá la descarga.`],
        ['O con pendrive', 'Bajá lifehigh-android-tv.apk en tu PC, copialo a un pendrive y enchufalo al TV o proyector.'],
        ['Abrí el archivo', 'Desde un explorador de archivos del TV (por ejemplo X-plore) tocá el .apk → Instalar. Habilitá “fuentes desconocidas” si lo pide.'],
        ['A ver', 'El ícono aparece junto a tus otras apps. Se maneja con el control remoto.'],
      ],
      note: 'Compatible con Android TV, Google TV, Fire TV Stick y TV box con Android 7.0 o superior.',
    },
    ios: {
      steps: [
        ['Opción rápida: instalarla desde Safari', 'Abrí repelis.vercel.app en Safari → botón Compartir → “Agregar a pantalla de inicio”. Funciona en iPhone y iPad sin ninguna herramienta extra.'],
        ['Opción IPA: instalá AltStore o Sideloadly', 'Descargá el IPA de “iPhone y iPad” arriba y abrilo con AltStore (altstore.io) o Sideloadly (sideloadly.io) desde tu PC o Mac.'],
        ['Confiá en el perfil', 'En el iPhone: Ajustes → General → VPN y administración de dispositivos → confiar en tu Apple ID.'],
      ],
      note: 'Apple no permite apps como esta en la App Store. Con una cuenta Apple gratuita, las apps instaladas por IPA deben renovarse cada 7 días (AltStore lo hace solo).',
    },
    windows: {
      steps: [
        ['Descargá el instalador', 'Tocá “Windows 10 / 11” arriba (LifeHigh-Setup-windows-x64.exe).'],
        ['Ejecutalo', 'Si Windows muestra “SmartScreen protegió tu PC”: Más información → Ejecutar de todas formas (la app no está firmada digitalmente).'],
        ['Instalá', 'Elegí la carpeta y terminá el asistente. Se crea un acceso directo en el escritorio.'],
      ],
      note: 'Necesita Windows 10 o superior de 64 bits e internet: abre Life High en una ventana propia.',
    },
    mac: {
      steps: [
        ['Elegí tu Mac', 'Apple Silicon (M1, M2, M3, M4) o Intel. Si dudás: menú  → “Acerca de esta Mac”.'],
        ['Abrí el .dmg', 'Arrastrá “Life High” a la carpeta Aplicaciones.'],
        ['Primer inicio', 'Click derecho sobre la app → Abrir → Abrir. Si dice “dañada”, ejecutá en Terminal: xattr -cr "/Applications/Life High.app"'],
      ],
      note: 'macOS 11 o superior. La app no está notarizada por Apple, por eso el primer inicio pide ese paso extra.',
    },
    linux: {
      steps: [
        ['Descargá el AppImage', 'Tocá “Linux” arriba (LifeHigh-linux-x86_64.AppImage).'],
        ['Dale permiso', 'En Terminal: chmod +x LifeHigh-linux-x86_64.AppImage'],
        ['Abrilo', 'Doble click o ./LifeHigh-linux-x86_64.AppImage'],
      ],
      note: 'Distribuciones de 64 bits con FUSE (Ubuntu, Fedora, Debian, Mint, etc.).',
    },
    smarttv: {
      steps: [
        ['Abrí el navegador del TV', 'En Samsung (Tizen) o LG (webOS) abrí la app Navegador de internet.'],
        ['Entrá a repelis.vercel.app', 'Guardalo en favoritos para volver con un click.'],
        ['Alternativa más cómoda', 'Enchufá un Fire TV Stick o un TV box con Android TV y usá la app de TV: se maneja con el control remoto.'],
      ],
      note: 'Samsung y LG no permiten instalar apps externas de forma simple; por eso la web o un dispositivo Android TV son las vías recomendadas.',
    },
  }[id]

  return (
    <div className="p-5 rounded-2xl bg-surface border border-white/10">
      {content.steps.map(([title, text], i) => (
        <div key={title} className={`flex gap-4 ${i === content.steps.length - 1 ? '' : 'pb-4 mb-4 border-b border-white/5'}`}>
          <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center justify-center font-bold text-sm flex-shrink-0">
            {i + 1}
          </div>
          <div className="flex-1">
            <p className="text-chalk font-display font-semibold text-sm">{title}</p>
            <p className="text-muted text-sm mt-1 leading-relaxed">{text}</p>
          </div>
        </div>
      ))}
      <p className="text-muted/60 text-xs mt-5 pt-4 border-t border-white/5">{content.note}</p>
    </div>
  )
}
