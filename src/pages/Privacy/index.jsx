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
              <li>Las cuentas son <strong className="text-chalk/85">opcionales</strong>: podés usar todo el sitio sin registrarte y sin dar ningún dato.</li>
              <li>Si creás una cuenta, guardamos tu mail y tu biblioteca (lista, historial, avisos) para sincronizarla. Podés borrarla cuando quieras.</li>
              <li>No usamos Google Analytics, Meta Pixel ni trackers de publicidad.</li>
              <li>Sin cuenta, lo que guardamos queda en <strong className="text-chalk/85">tu</strong> dispositivo, no en nuestros servers.</li>
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
              <li>
                <strong className="text-chalk/85">Latido de actividad</strong>: mientras tenés la app abierta, cada 1–2 minutos
                se envía un identificador <strong>aleatorio que cambia todos los días</strong>, la página en la que estás (agrupada: "inicio", "película"…),
                la plataforma (navegador, app instalada…), si tenés cuenta (sí/no) y, si estás reproduciendo, qué título. Sirve para contar cuántas personas están
                conectadas, qué se mira más y cuánto tiempo en total. <strong>No se asocia a tu mail, a tu cuenta ni a tu historial</strong>, y no incluye tu IP.
              </li>
            </ul>
            <p className="mt-3 text-chalk/80">
              <strong>Sin cuenta, NUNCA guardamos:</strong> tu IP cruda, tu nombre, tu email ni nada que pueda
              re-identificarte personalmente. Con cuenta, ver la sección 3 ("Tu cuenta").
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
              <li><code>lifehigh:library:v1</code> — tu lista, lo que estás viendo (con progreso estimado), avisos de estreno, racha y logros.</li>
              <li><code>lifehigh:donations:v1</code> — cuándo te mostramos el pedido de apoyo y si tocaste "Ya doné".</li>
            </ul>
            Podés limpiarlos en cualquier momento desde tu DevTools (Application → Local Storage) o
            borrando los datos del sitio en la configuración de tu navegador.
          </Section>

          <Section title="3. Tu cuenta (opcional)">
            Crear una cuenta es voluntario y sirve para sincronizar tu biblioteca entre dispositivos. Si la creás, guardamos:
            <ul className="list-disc list-inside mt-2 space-y-1 marker:text-gold/60">
              <li>Tu <strong className="text-chalk/85">mail</strong> y, si querés, tu <strong className="text-chalk/85">nombre</strong>.</li>
              <li>Tu <strong className="text-chalk/85">contraseña</strong>, nunca en texto: solo un hash irreversible (scrypt). Ni nosotros podemos verla.</li>
              <li>Tu <strong className="text-chalk/85">biblioteca</strong>: Mi lista, historial con progreso estimado, avisos de estreno, racha, logros y si sos Supporter.</li>
              <li>Tus <strong className="text-chalk/85">sesiones abiertas</strong>: fecha, tipo de navegador y un identificador del que solo guardamos el hash.</li>
              <li>Contadores temporales anti-abuso (intentos de ingreso), con la IP convertida en un hash. Se borran solos en minutos u horas.</li>
            </ul>
            <p className="mt-3">
              Los datos se guardan en <strong className="text-chalk/85">MongoDB Atlas</strong> (región São Paulo, Brasil). Si el servicio de mails está
              activo, tu mail se usa solo para confirmar la cuenta y recuperar la contraseña, a través de <strong className="text-chalk/85">Resend</strong>.
              No vendemos, alquilamos ni compartimos tus datos, y no los usamos para publicidad.
            </p>
            <p className="mt-3">
              <strong className="text-chalk/85">Podés eliminar tu cuenta</strong> cuando quieras desde <Link to="/cuenta" className="text-gold hover:underline">Mi cuenta</Link>:
              se borran tu mail, tu contraseña y tu biblioteca de nuestros servidores. Al cerrar sesión, tu biblioteca se borra de ese
              dispositivo (sigue en tu cuenta) para que nadie más la vea en un equipo compartido.
            </p>
          </Section>

          <Section title="4. Service Worker y cache">
            Para que la app cargue rápido offline, registramos un Service Worker que guarda en cache:
            <ul className="list-disc list-inside mt-2 space-y-1 marker:text-gold/60">
              <li>Los archivos estáticos de la app (HTML, JS, CSS).</li>
              <li>Las imágenes de pósters de TMDB.</li>
              <li>Las respuestas de la API de TMDB (10 min).</li>
            </ul>
            Este cache vive en tu navegador, no en nuestros servers.
          </Section>

          <Section title="5. Servicios de terceros">
            <p className="mb-2">Life High usa tres tipos de terceros:</p>
            <ul className="list-disc list-inside space-y-1.5 marker:text-gold/60">
              <li><strong className="text-chalk/85">TMDB</strong> — provee metadatos (títulos, sinopsis, pósters). Su <a href="https://www.themoviedb.org/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">política de privacidad acá</a>.</li>
              <li><strong className="text-chalk/85">Servidores de streaming</strong> (vidsrc, embed.su, etc.) — cuando reproducís un video, tu navegador se conecta directo a ellos. Tienen sus propias políticas de privacidad y publicidad. No los controlamos.</li>
              <li><strong className="text-chalk/85">Google Fonts</strong> — para tipografías. Carga las fuentes desde sus CDNs.</li>
            </ul>
          </Section>

          <Section title="6. Cookies">
            Sin cuenta, Life High no setea cookies propias. Si iniciás sesión, usamos <strong className="text-chalk/85">una sola cookie</strong> (<code className="font-mono text-xs">lh_session</code>)
            para mantenerte conectado: es técnica, httpOnly (los scripts de la página no pueden leerla) y dura 30 días o hasta que cierres sesión.
            Los terceros embebidos sí pueden setear cookies en su dominio, fuera de nuestro control.
          </Section>

          <Section title="7. Niños y menores">
            Life High indexa contenido de TMDB que puede no ser adecuado para menores. No hay un filtro
            de edad. Si sos padre/madre/tutor, te recomendamos usar las opciones de control parental de
            tu navegador o sistema operativo.
          </Section>

          <Section title="8. Cambios en esta política">
            Si actualizamos esta política, vas a ver una nueva fecha en la parte superior. Cambios
            sustanciales se anuncian en la página Sobre Life High.
          </Section>

          <Section title="9. Tus derechos">
            Sin cuenta, no tenemos información tuya: para borrar lo que hay en tu navegador, limpiá los datos del sitio desde la
            configuración de privacidad. Con cuenta, podés <strong className="text-chalk/85">acceder</strong> a lo que guardamos desde Mi cuenta,
            <strong className="text-chalk/85"> cambiar tu contraseña</strong> y <strong className="text-chalk/85">eliminar todo</strong> en cualquier momento.
            Para otras consultas (corrección, exportación), escribinos por los canales de contacto.
          </Section>

          <Section title="10. Contacto">
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
