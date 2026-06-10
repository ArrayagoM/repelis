import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowLeft, Scales } from '@phosphor-icons/react'

export default function DMCA() {
  return (
    <motion.main
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen bg-void pt-28 pb-24"
    >
      <div className="max-w-3xl mx-auto px-6 md:px-12">
        <Link to="/" className="inline-flex items-center gap-2 text-muted hover:text-gold transition-colors mb-8 text-sm">
          <ArrowLeft size={14} /> Volver al inicio
        </Link>

        <header className="mb-10">
          <span className="inline-block px-2.5 py-0.5 rounded-full border border-gold/20 bg-gold/10 text-gold text-[10px] uppercase tracking-widest font-semibold">
            Legal
          </span>
          <h1 className="font-display font-extrabold text-4xl text-chalk tracking-tight mt-2 flex items-center gap-3">
            <Scales size={32} weight="fill" className="text-gold" />
            DMCA / Reclamos de copyright
          </h1>
        </header>

        <article className="space-y-7 text-muted text-sm leading-relaxed">
          <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/20">
            <p className="text-amber-200 text-sm leading-relaxed">
              <strong>Importante:</strong> Life High es un agregador. <strong>No alojamos ningún archivo de video</strong>.
              Los reproductores embebidos pertenecen a terceros independientes que no operamos.
              Si querés que un video específico baje del internet, la solicitud DMCA tiene que ir
              dirigida a esos terceros, no a nosotros.
            </p>
          </div>

          <Section title="¿A quién dirigir el reclamo?">
            <p className="mb-3">Identificá primero <strong className="text-chalk/85">qué servidor</strong> está sirviendo el video. En el modal del reproductor,
            arriba a la derecha vas a ver el nombre del servidor actual (EmbedMaster, VidSrc, VidLink, etc.).
            Cada uno tiene su propio formulario o canal DMCA:</p>
            <ul className="list-disc list-inside space-y-1 marker:text-gold/60">
              <li>vidsrc.to → contactar via su sitio</li>
              <li>embed.su → contactar via su sitio</li>
              <li>2embed.cc → contactar via su sitio</li>
              <li>(etc.)</li>
            </ul>
          </Section>

          <Section title="Si igual querés que Life High no liste un título">
            <p className="mb-3">Si sos titular de derechos y preferís que Life High directamente <strong className="text-chalk/85">no muestre</strong> un título en su catálogo, escribinos con:</p>
            <ol className="list-decimal list-inside space-y-1 marker:text-gold/60">
              <li>Nombre completo de la obra y año de estreno.</li>
              <li>ID de TMDB (lo encontrás en themoviedb.org).</li>
              <li>Acreditación de titularidad (registro de derecho de autor, contrato de licencia, etc.).</li>
              <li>Tus datos de contacto para que te respondamos.</li>
            </ol>
            <p className="mt-3">Procesamos pedidos verificables en hasta <strong className="text-chalk/85">7 días hábiles</strong>.</p>
          </Section>

          <Section title="Canal de contacto">
            <p>Escribí a TinTech a través del perfil de GitHub listado en <Link to="/about" className="text-gold hover:underline">la página Sobre Life High</Link>.
            Asunto sugerido: <code className="px-1.5 py-0.5 rounded bg-surface text-chalk/80 text-xs font-mono">[DMCA] Life High - &lt;Título&gt;</code></p>
          </Section>

          <Section title="Reclamos abusivos">
            Reclamos sin titularidad acreditada, o claramente abusivos (por ejemplo, intentos de
            censura sin base legal), se archivan sin procesar.
          </Section>
        </article>
      </div>
    </motion.main>
  )
}

function Section({ title, children }) {
  return (
    <section>
      <h2 className="font-display font-bold text-lg text-chalk mb-2">{title}</h2>
      <div>{children}</div>
    </section>
  )
}
