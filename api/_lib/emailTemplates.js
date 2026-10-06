// Plantillas de mail de Life High. Puras (sin red): reciben datos y devuelven { subject, html, text }.
// Diseño: tarjeta clara sobre fondo crema, franja oscura con la marca, botón dorado "a prueba de Outlook"
// (tablas + estilos en línea, sin imágenes de fondo ni CSS externo). Todo dato variable se escapa.

export const BRAND = {
  name: 'Life High',
  legal: 'Life High · un proyecto de TinTech',
  support: 'info@lifehigh.site',
  gold: '#E8A020',
  ink: '#0B0B12',
  text: '#2A2833',
  muted: '#6B6778',
  line: '#E7E2D8',
  paper: '#F5F2EA',
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c])

/** Solo http(s): evita javascript: u otros esquemas en los enlaces. */
const safeUrl = (u) => (/^https?:\/\//i.test(String(u)) ? String(u) : '#')

const firstName = (name) => String(name || '').trim().split(/\s+/)[0].slice(0, 40)
const greet = (name) => (firstName(name) ? `Hola, ${firstName(name)}` : 'Hola')

const p = (html) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${BRAND.text}">${html}</p>`

const button = (label, link) => `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:26px 0 8px">
  <tr><td align="center" bgcolor="${BRAND.gold}" style="border-radius:999px">
    <a href="${esc(safeUrl(link))}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:${BRAND.ink};text-decoration:none;border-radius:999px">${esc(label)}</a>
  </td></tr>
</table>`

const callout = (html) => `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0 0">
  <tr><td style="background:${BRAND.paper};border-left:3px solid ${BRAND.gold};padding:12px 16px;font-size:13px;line-height:1.6;color:${BRAND.muted}">${html}</td></tr>
</table>`

/** Estructura común. `site` es la URL base del sitio (sin barra final). */
const layout = ({ site, preheader, title, bodyHtml, to, footerNote }) => `<!doctype html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.paper};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px">${esc(preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${BRAND.paper}">
<tr><td align="center" style="padding:32px 12px">
  <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px">
    <tr><td style="background:${BRAND.ink};border-radius:16px 16px 0 0;padding:22px 32px">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
        <td style="vertical-align:middle"><img src="${esc(site)}/icon-192.png" width="40" height="40" alt="" style="display:block;border:0;border-radius:10px"></td>
        <td style="vertical-align:middle;padding-left:12px;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:bold;color:#F0EDE8;letter-spacing:.2px">Life <span style="color:${BRAND.gold}">High</span></td>
      </tr></table>
    </td></tr>
    <tr><td style="height:4px;background:${BRAND.gold};font-size:0;line-height:0">&nbsp;</td></tr>
    <tr><td style="background:#FFFFFF;padding:36px 32px 28px;font-family:Arial,Helvetica,sans-serif;border-left:1px solid ${BRAND.line};border-right:1px solid ${BRAND.line}">
      <h1 style="margin:0 0 20px;font-size:23px;line-height:1.3;color:${BRAND.ink};font-family:Arial,Helvetica,sans-serif">${esc(title)}</h1>
      ${bodyHtml}
    </td></tr>
    <tr><td style="background:#FFFFFF;border:1px solid ${BRAND.line};border-top:0;border-radius:0 0 16px 16px;padding:0 32px 26px;font-family:Arial,Helvetica,sans-serif">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="border-top:1px solid ${BRAND.line};padding-top:18px;font-size:12px;line-height:1.7;color:${BRAND.muted}">
        ${footerNote ? `${footerNote}<br>` : ''}
        ¿Necesitás ayuda? Escribinos a <a href="mailto:${BRAND.support}" style="color:${BRAND.muted};text-decoration:underline">${BRAND.support}</a>.
      </td></tr></table>
    </td></tr>
    <tr><td align="center" style="padding:20px 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.7;color:#8C8798">
      ${BRAND.legal}<br>
      <a href="${esc(site)}/terms" style="color:#8C8798">Términos</a> &nbsp;·&nbsp; <a href="${esc(site)}/privacy" style="color:#8C8798">Privacidad</a> &nbsp;·&nbsp; <a href="${esc(site)}" style="color:#8C8798">lifehigh.site</a><br>
      ${to ? `Este mensaje se envió a ${esc(to)}.` : ''}
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`

const textFooter = (site) => `\n—\n${BRAND.legal}\nAyuda: ${BRAND.support}\nTérminos: ${site}/terms · Privacidad: ${site}/privacy\n`

// ─── Plantillas ─────────────────────────────────────────────────────────

export const verifyEmail = ({ site, to, name, link }) => ({
  subject: 'Confirmá tu dirección de email · Life High',
  html: layout({
    site, to, title: 'Confirmá tu dirección de email',
    preheader: 'Un último paso para activar tu cuenta de Life High.',
    bodyHtml: p(esc(greet(name)) + ',')
      + p('Gracias por crear tu cuenta en Life High. Para activarla y poder publicar en la comunidad, confirmá que esta dirección de email es tuya.')
      + button('Confirmar mi email', link)
      + callout('Por seguridad, este enlace vale <strong>24 horas</strong> y solo puede usarse una vez.')
      + p(`<span style="font-size:12px;color:${BRAND.muted};display:block;margin-top:18px">Si el botón no funciona, copiá y pegá este enlace en tu navegador:<br><a href="${esc(safeUrl(link))}" style="color:${BRAND.muted};word-break:break-all">${esc(link)}</a></span>`),
    footerNote: 'Recibís este mensaje porque alguien creó una cuenta en Life High con esta dirección. Si no fuiste vos, ignorá este mail: la cuenta no se activará.',
  }),
  text: `${greet(name)},\n\nGracias por crear tu cuenta en Life High. Confirmá tu dirección de email con este enlace (vale 24 horas, un solo uso):\n${link}\n\nSi no fuiste vos, ignorá este mensaje.${textFooter(site)}`,
})

export const resetPassword = ({ site, to, name, link }) => ({
  subject: 'Restablecé tu contraseña · Life High',
  html: layout({
    site, to, title: 'Restablecé tu contraseña',
    preheader: 'Recibimos un pedido para cambiar tu contraseña.',
    bodyHtml: p(esc(greet(name)) + ',')
      + p('Recibimos un pedido para restablecer la contraseña de tu cuenta de Life High. Tocá el botón para elegir una nueva.')
      + button('Elegir una nueva contraseña', link)
      + callout('Este enlace vale <strong>1 hora</strong> y solo puede usarse una vez. Al cambiar la contraseña cerraremos todas tus sesiones abiertas.')
      + p(`<span style="font-size:12px;color:${BRAND.muted};display:block;margin-top:18px">Si el botón no funciona, copiá y pegá este enlace en tu navegador:<br><a href="${esc(safeUrl(link))}" style="color:${BRAND.muted};word-break:break-all">${esc(link)}</a></span>`),
    footerNote: '<strong>¿No pediste este cambio?</strong> Podés ignorar este mail con tranquilidad: tu contraseña actual sigue siendo la misma.',
  }),
  text: `${greet(name)},\n\nRecibimos un pedido para restablecer tu contraseña de Life High. Elegí una nueva con este enlace (vale 1 hora, un solo uso):\n${link}\n\nSi no fuiste vos, ignorá este mensaje: tu contraseña no cambia.${textFooter(site)}`,
})

export const welcome = ({ site, to, name }) => ({
  subject: 'Te damos la bienvenida a Life High',
  html: layout({
    site, to, title: 'Te damos la bienvenida a Life High',
    preheader: 'Tu cuenta está lista. Esto es lo que podés hacer ahora.',
    bodyHtml: p(esc(greet(name)) + ',')
      + p('Tu cuenta quedó confirmada. Gracias por sumarte: Life High es un proyecto independiente y cada persona que lo usa lo hace crecer.')
      + p('Con tu cuenta podés:')
      + `<ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.8;color:${BRAND.text}">
          <li>Guardar tu <strong>Mi lista</strong> y retomar donde lo dejaste en cualquier dispositivo.</li>
          <li>Armar y compartir <strong>listas</strong> con la comunidad: zapping, planes de finde, maratones.</li>
          <li>Seguir a otras personas y recibir avisos de lo que publican.</li>
        </ul>`
      + button('Explorar Life High', site)
      + callout('Si querés cambiar tus preferencias de avisos o borrar tu cuenta, lo hacés desde “Mi cuenta” en cualquier momento.'),
    footerNote: 'Recibís este mensaje porque confirmaste tu cuenta en Life High.',
  }),
  text: `${greet(name)},\n\nTu cuenta de Life High quedó confirmada. Ya podés guardar tu lista, armar listas para la comunidad y seguir a otras personas.\n\nEntrá: ${site}${textFooter(site)}`,
})

export const passwordChanged = ({ site, to, name }) => ({
  subject: 'Tu contraseña de Life High fue cambiada',
  html: layout({
    site, to, title: 'Tu contraseña fue cambiada',
    preheader: 'Te avisamos por seguridad: cambió la contraseña de tu cuenta.',
    bodyHtml: p(esc(greet(name)) + ',')
      + p('Te avisamos que la contraseña de tu cuenta de Life High fue cambiada hace un momento.')
      + callout('<strong>¿Fuiste vos?</strong> No tenés que hacer nada.<br><strong>¿No reconocés este cambio?</strong> Restablecé tu contraseña cuanto antes desde el botón de abajo y escribinos a ' + BRAND.support + '.')
      + button('Restablecer mi contraseña', `${site}/cuenta`),
    footerNote: 'Enviamos este aviso de seguridad cada vez que cambia la contraseña de una cuenta.',
  }),
  text: `${greet(name)},\n\nLa contraseña de tu cuenta de Life High fue cambiada. Si fuiste vos, no tenés que hacer nada. Si no reconocés el cambio, restablecela en ${site}/cuenta y escribinos a ${BRAND.support}.${textFooter(site)}`,
})

export const accountDeleted = ({ site, to, name }) => ({
  subject: 'Tu cuenta de Life High fue eliminada',
  html: layout({
    site, to, title: 'Tu cuenta fue eliminada',
    preheader: 'Confirmamos que borramos tu cuenta y tus datos.',
    bodyHtml: p(esc(greet(name)) + ',')
      + p('Confirmamos que tu cuenta de Life High fue eliminada. Borramos tu perfil, tus listas, tus me gusta, tus seguimientos y tu biblioteca de nuestros servidores.')
      + p('Lamentamos verte partir. Si algún día querés volver, vas a poder crear una cuenta nueva cuando quieras.')
      + callout('Si no pediste esta eliminación, escribinos de inmediato a <a href="mailto:' + BRAND.support + '" style="color:' + BRAND.muted + '">' + BRAND.support + '</a>.'),
    footerNote: 'Este es el último mensaje que te enviaremos.',
  }),
  text: `${greet(name)},\n\nConfirmamos que tu cuenta de Life High fue eliminada junto con tu perfil, listas, me gusta, seguimientos y biblioteca. Si no lo pediste, escribinos a ${BRAND.support}.${textFooter(site)}`,
})

/** Aviso de actividad (seguidos que publican, me gusta, estrenos de tu lista). items: [{ title, text, link }] */
export const activity = ({ site, to, name, headline, items = [], unsubscribeLink }) => ({
  subject: headline,
  html: layout({
    site, to, title: headline,
    preheader: items[0]?.title || headline,
    bodyHtml: p(esc(greet(name)) + ',')
      + items.slice(0, 5).map((i) => `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 12px"><tr>
          <td style="border:1px solid ${BRAND.line};border-radius:12px;padding:14px 16px;font-family:Arial,Helvetica,sans-serif">
            <a href="${esc(safeUrl(i.link))}" style="font-size:15px;font-weight:bold;color:${BRAND.ink};text-decoration:none">${esc(i.title)}</a>
            ${i.text ? `<div style="font-size:13px;line-height:1.6;color:${BRAND.muted};margin-top:4px">${esc(i.text)}</div>` : ''}
          </td></tr></table>`).join('')
      + button('Abrir Life High', site),
    footerNote: unsubscribeLink
      ? `Recibís estos avisos porque los activaste en tu cuenta. <a href="${esc(safeUrl(unsubscribeLink))}" style="color:${BRAND.muted};text-decoration:underline">Dejar de recibirlos</a>.`
      : 'Podés desactivar estos avisos desde “Mi cuenta”.',
  }),
  text: `${greet(name)},\n\n${headline}\n\n${items.slice(0, 5).map((i) => `• ${i.title}${i.text ? ` — ${i.text}` : ''}\n  ${i.link}`).join('\n')}\n\n${site}${unsubscribeLink ? `\nDejar de recibirlos: ${unsubscribeLink}` : ''}${textFooter(site)}`,
})
