import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowLeft, Code, Lightning, ShieldStar, GithubLogo, Globe, Coffee } from '@phosphor-icons/react'
import CafecitoButton from '../../components/CafecitoButton'
import { tt } from '../../lib/i18n'

export default function About() {
  return (
    <motion.main
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen bg-void pt-28 pb-24"
    >
      <div className="max-w-3xl mx-auto px-6 md:px-12">
        <Link to="/" className="inline-flex items-center gap-2 text-muted hover:text-gold transition-colors mb-8 text-sm">
          <ArrowLeft size={14} /> {tt("Volver al inicio")}
        </Link>

        <header className="mb-10">
          <span className="inline-block px-2.5 py-0.5 rounded-full border border-gold/20 bg-gold/10 text-gold text-[10px] uppercase tracking-widest font-semibold">
            {tt("Sobre Life High")}
          </span>
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl text-chalk tracking-tight mt-2">
            {tt("Hecho por")} <span className="text-gold">{tt("TinTech")}</span>
          </h1>
          <p className="text-muted text-base mt-3 leading-relaxed">
            {tt("Life High es un proyecto independiente que reúne en un solo lugar películas, series, anime y K-dramas, indexando metadatos de TMDB y reproduciendo desde servidores agregadores públicos.")}
          </p>
        </header>

        <section className="space-y-8">
          {/* Qué es */}
          <div className="p-6 rounded-2xl bg-card border border-white/[0.06]">
            <div className="flex items-start gap-3 mb-3">
              <Lightning size={20} weight="fill" className="text-gold flex-shrink-0 mt-0.5" />
              <h2 className="font-display font-bold text-xl text-chalk">{tt("¿Qué es Life High?")}</h2>
            </div>
            <p className="text-muted text-sm leading-relaxed">
              {tt("Un")} <strong className="text-chalk/90">{tt("agregador")}</strong>{tt(": no alojamos archivos de video, no codificamos contenido, no operamos servidores de streaming. Lo que hacemos es ofrecer una interfaz limpia para que encuentres y reproduzcas títulos que ya circulan libremente en otros lugares de internet.")}
            </p>
          </div>

          {/* Stack */}
          <div className="p-6 rounded-2xl bg-card border border-white/[0.06]">
            <div className="flex items-start gap-3 mb-3">
              <Code size={20} weight="fill" className="text-gold flex-shrink-0 mt-0.5" />
              <h2 className="font-display font-bold text-xl text-chalk">{tt("Hecho con")}</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-muted">
              {['React 18', 'Vite', 'Redux Toolkit', 'Tailwind CSS', 'Framer Motion', 'TMDB API', 'Service Worker', 'React Router 6'].map((t) => (
                <div key={t} className="px-3 py-1.5 rounded-full bg-surface border border-white/5 text-center font-mono text-[11px]">{t}</div>
              ))}
            </div>
          </div>

          {/* Privacidad */}
          <div className="p-6 rounded-2xl bg-card border border-white/[0.06]">
            <div className="flex items-start gap-3 mb-3">
              <ShieldStar size={20} weight="fill" className="text-gold flex-shrink-0 mt-0.5" />
              <h2 className="font-display font-bold text-xl text-chalk">{tt("Tu privacidad")}</h2>
            </div>
            <ul className="text-muted text-sm leading-relaxed space-y-1.5 list-disc list-inside marker:text-gold/60">
              <li>{tt("No tenemos cuentas, no pedimos email ni contraseña.")}</li>
              <li>{tt("No usamos analítica de terceros ni trackers publicitarios.")}</li>
              <li>{tt("Lo único que guardamos es")} <em>{tt("tu")}</em> {tt("historial de servidores que te funcionaron, en")} <em>{tt("tu")}</em> {tt("localStorage. No sale de tu dispositivo.")}</li>
              <li>{tt("Cuando reproducís, el video viaja directo entre vos y el servidor de terceros — no pasamos por nuestros servers.")}</li>
            </ul>
            <Link to="/privacy" className="inline-block mt-3 text-gold text-xs font-semibold hover:underline">
              {tt("Leer la política completa →")}
            </Link>
          </div>

          {/* Apoyar */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-gold/10 to-gold/5 border border-gold/20">
            <div className="flex items-start gap-3 mb-3">
              <Coffee size={20} weight="fill" className="text-gold flex-shrink-0 mt-0.5" />
              <h2 className="font-display font-bold text-xl text-chalk">{tt("Apoyar el proyecto")}</h2>
            </div>
            <p className="text-muted text-sm leading-relaxed mb-4">
              {tt("Life High se banca con horas de mi tiempo y un hosting humilde. Si te gusta y querés ayudar a mantenerlo vivo, podés invitarme un café en Cafecito.")}
            </p>
            <CafecitoButton />
            <p className="text-muted/50 text-[10px] mt-2 font-mono">
              {tt("Se procesa con Mercado Pago. 100% va al desarrollador.")}
            </p>
          </div>

          {/* Contacto */}
          <div className="p-6 rounded-2xl bg-card border border-white/[0.06]">
            <h2 className="font-display font-bold text-xl text-chalk mb-3 flex items-center gap-2">
              <Globe size={20} weight="fill" className="text-gold" />
              {tt("Contacto")}
            </h2>
            <p className="text-muted text-sm leading-relaxed">
              {tt("¿Bug, sugerencia, colaboración o reclamo? Escribime al perfil de TinTech.")}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <a href="https://github.com/ArrayagoM" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full glass border border-white/10 text-muted text-xs hover:text-gold hover:border-gold/30 transition-all">
                <GithubLogo size={12} weight="bold" /> {tt("GitHub")}
              </a>
            </div>
          </div>
        </section>
      </div>
    </motion.main>
  )
}
