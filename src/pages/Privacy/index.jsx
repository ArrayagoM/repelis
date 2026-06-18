import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from '@phosphor-icons/react'

export default function Privacy() {
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
            <ShieldCheck size={32} weight="fill" className="text-gold" />
            Política de Privacidad
          </h1>
          <p className="text-muted text-sm mt-2 font-mono">Última actualización: {new Date().toLocaleDateString('es-AR')}</p>
        </header>

        <article className="space-y-7 text-muted text-sm leading-relaxed">
          <Section title="Resumen rápido (TL;DR)">
            <ul className="list-disc list-inside space-y-1 marker:text-gold/60">
              <li>No tenemos cuentas, no pedimos email ni datos personales.</li>
              <li>No usamos Google Analytics, Meta Pixel ni trackers de publicidad.</li>
              <li>Lo único que guardamos es en <strong className="text-chalk/85">tu</strong> dispositivo, no en nuestros servers.</li>
              <li>Cuando reproducís, el video va directo entre vos y el servidor de terceros.</li>
            </ul>
          </Section>

          <Section title="1. Qué datos recolectamos">
            Recolectamos lo mínimo indispensable, todo agregado y anónimo:
            <ul className="list-disc list-inside mt-2 space-y-1 marker:text-gold/60">
              <li>
                <strong className="text-chalk/85">Geolocalización aproximada por IP</strong> (país, ciudad)
                de cada visita. Esto NO es dato personal según Ley 25.326 art. 2 — es metadato de transporte de red.
                Lo usamos para entender desde dónde se usa el sitio.
              </li>
              <li>
                <strong className="text-chalk/85">Geolocalización precisa (GPS) — sólo con consentimiento explícito.</strong>
                Cuando entrás a <Link to="/cines-cerca" className="text-gold underline">/cines-cerca</Link> y
                aceptás el popup del navegador, tu ubicación exacta se usa para calcular los cines más
                cercanos y se registra también en nuestras analytics agregadas. Si rechazás el permiso,
                no se registra nada.
              </li>
              <li>
                <strong className="text-chalk/85">Hash anónimo de sesión</strong> (UA + idioma + día) para contar
                visitantes únicos sin guardar ningún identificador persistente. Expira a los 7 días.
              </li>
            </ul>
            <p className="mt-3 text-chalk/80">
              <strong>Lo que NUNCA guardamos:</strong> tu IP cruda, tu nombre, tu email, tus contraseñas,
              ni nada que pueda re-identificarte personalmente.
            </p>
          </Section>

          <Section title="2. Qué guardamos en TU dispositivo (localStorage)">
            La app guarda en <code className="px-1 py-0.5 rounded bg-surface text-chalk/80 text-xs font-mono">localStorage</code> de tu
            navegador, exclusivamente para mejorar tu experiencia:
            <ul className="list-disc list-inside mt-2 space-y-1 marker:text-gold/60 font-mono text-xs">
              <li><code>repelis:lastSource:v1</code> — el último servidor de streaming que te funcionó.</li>
              <li><code>repelis:speed:v1</code> — medición de velocidad de los servidores (cacheado 6h).</li>
              <li><code>repelis:errors:v1</code> — últimos 20 errores técnicos para debug.</li>
              <li><code>repelis:extConfirm:v1</code> — flag de "ya viste el disclaimer de pestaña externa".</li>
            </ul>
            Podés limpiarlos en cualquier momento desde tu DevTools (Application → Local Storage) o
            borrando los datos del sitio en la configuración de tu navegador.
          </Section>

          <Section title="3. Service Worker y cache">
            Para que la app cargue rápido offline, registramos un Service Worker que guarda en cache:
            <ul className="list-disc list-inside mt-2 space-y-1 marker:text-gold/60">
              <li>Los archivos estáticos de la app (HTML, JS, CSS).</li>
              <li>Las imágenes de pósters de TMDB.</li>
              <li>Las respuestas de la API de TMDB (10 min).</li>
            </ul>
            Este cache vive en tu navegador, no en nuestros servers.
          </Section>

          <Section title="4. Servicios de terceros">
            <p className="mb-2">Life High usa tres tipos de terceros:</p>
            <ul className="list-disc list-inside space-y-1.5 marker:text-gold/60">
              <li><strong className="text-chalk/85">TMDB</strong> — provee metadatos (títulos, sinopsis, pósters). Su <a href="https://www.themoviedb.org/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">política de privacidad acá</a>.</li>
              <li><strong className="text-chalk/85">Servidores de streaming</strong> (vidsrc, embed.su, etc.) — cuando reproducís un video, tu navegador se conecta directo a ellos. Tienen sus propias políticas de privacidad y publicidad. No los controlamos.</li>
              <li><strong className="text-chalk/85">Google Fonts</strong> — para tipografías. Carga las fuentes desde sus CDNs.</li>
            </ul>
          </Section>

          <Section title="5. Cookies">
            Life High no setea cookies propias. Los terceros embebidos sí pueden setear cookies en su
            dominio, fuera de nuestro control.
          </Section>

          <Section title="6. Niños y menores">
            Life High indexa contenido de TMDB que puede no ser adecuado para menores. No hay un filtro
            de edad. Si sos padre/madre/tutor, te recomendamos usar las opciones de control parental de
            tu navegador o sistema operativo.
          </Section>

          <Section title="7. Cambios en esta política">
            Si actualizamos esta política, vas a ver una nueva fecha en la parte superior. Cambios
            sustanciales se anuncian en la página Sobre Life High.
          </Section>

          <Section title="8. Tus derechos">
            Como no recolectamos datos, no tenemos información tuya para corregir, exportar o eliminar.
            Si querés borrar todo lo que hay en tu navegador relacionado con Life High, limpiá los datos
            del sitio desde la configuración de privacidad de tu browser.
          </Section>

          <Section title="9. Contacto">
            Para consultas sobre privacidad, escribí a TinTech a través de los canales listados en <Link to="/about" className="text-gold hover:underline">la página Sobre Life High</Link>.
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
