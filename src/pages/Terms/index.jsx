import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowLeft } from '@phosphor-icons/react'

export default function Terms() {
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
          <h1 className="font-display font-extrabold text-4xl text-chalk tracking-tight mt-2">
            Términos y Condiciones
          </h1>
          <p className="text-muted text-sm mt-2 font-mono">Última actualización: {new Date().toLocaleDateString('es-AR')}</p>
        </header>

        <article className="prose-content space-y-7 text-muted text-sm leading-relaxed">
          <Section title="1. Aceptación de los términos">
            Al usar Repelis aceptás estos términos en su totalidad. Si no estás de acuerdo con
            alguno de los puntos, te pedimos que no uses el servicio.
          </Section>

          <Section title="2. Naturaleza del servicio">
            Repelis es un <strong className="text-chalk/85">agregador de enlaces</strong>. La aplicación
            funciona como un índice que muestra metadatos públicos provistos por The Movie Database
            (TMDB) y embebe reproductores de terceros independientes (vidsrc, embed.su, autoembed,
            entre otros). <strong className="text-chalk/85">Repelis no aloja, almacena, codifica ni transmite
            archivos de video.</strong> No tenemos control sobre el contenido que sirven los terceros.
          </Section>

          <Section title="3. Uso aceptable">
            El usuario es responsable de cumplir las leyes de propiedad intelectual de su jurisdicción.
            Repelis se ofrece "tal cual" con fines informativos y educativos. Cualquier uso que vulnere
            derechos de autor es responsabilidad exclusiva del usuario.
          </Section>

          <Section title="4. Ausencia de cuentas y datos personales">
            Repelis no requiere registro. No recolectamos correos, contraseñas, números de teléfono ni
            datos identificatorios. Para más detalle ver nuestra <Link to="/privacy" className="text-gold hover:underline">Política de Privacidad</Link>.
          </Section>

          <Section title="5. Disponibilidad y garantías">
            El servicio se ofrece sin garantías de ningún tipo. Los servidores embebidos pueden caerse,
            cambiar de URL o dejar de funcionar sin aviso. Repelis no garantiza disponibilidad continua,
            calidad de reproducción ni existencia de un título específico.
          </Section>

          <Section title="6. Reclamos por contenido (DMCA / takedown)">
            Si sos titular de derechos sobre una obra y considerás que un enlace indexado por Repelis
            infringe tu copyright:
            <ol className="list-decimal list-inside mt-2 space-y-1 marker:text-gold/60">
              <li>Dirigí tu reclamo <strong className="text-chalk/85">directamente al servidor</strong> que aloja el video (vidsrc, embed.su, etc.). Ellos son quienes pueden quitar el contenido.</li>
              <li>Si querés que Repelis <strong className="text-chalk/85">no indexe</strong> un título puntual, escribinos al canal de contacto del proyecto TinTech con: título, año, ID de TMDB y prueba de titularidad.</li>
              <li>Procesamos pedidos legítimos en hasta 7 días hábiles.</li>
            </ol>
          </Section>

          <Section title="7. Publicidad de terceros">
            Los reproductores embebidos suelen mostrar publicidad propia, pop-ups y redireccionamientos.
            Repelis <strong className="text-chalk/85">no recibe ingresos</strong> por esa publicidad y no
            tenemos control sobre ella. Recomendamos usar un bloqueador de anuncios.
          </Section>

          <Section title="8. Limitación de responsabilidad">
            Repelis y TinTech no son responsables por: daños derivados del uso del servicio, pérdida de
            datos, interrupciones del servicio, contenido inadecuado servido por terceros, ni acciones
            legales que pudieran derivarse del uso por parte del usuario.
          </Section>

          <Section title="9. Modificaciones">
            Estos términos pueden actualizarse en cualquier momento. La fecha al inicio del documento
            indica la última revisión. El uso continuado del servicio implica aceptación de la versión
            vigente.
          </Section>

          <Section title="10. Jurisdicción">
            Cualquier disputa relacionada con el uso de Repelis se resolverá bajo las leyes de la
            República Argentina, ciudad de residencia del operador del proyecto.
          </Section>

          <Section title="11. Contacto">
            Por cualquier consulta legal, dirigite al perfil de <strong className="text-chalk/85">TinTech</strong> en
            GitHub o redes asociadas listadas en <Link to="/about" className="text-gold hover:underline">la página Sobre Repelis</Link>.
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
