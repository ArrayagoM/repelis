// Envío de mails con Resend (https://resend.com). Sin RESEND_API_KEY no hay mails:
// las cuentas funcionan igual, pero no se puede verificar el mail ni recuperar la contraseña.
// Remitente: "Life High <info@lifehigh.site>" (el dominio se verifica en Resend con SPF/DKIM/DMARC).

import * as T from './emailTemplates.js'

const SITE_DEFAULT = 'https://lifehigh.site'
const FROM_DEFAULT = 'Life High <info@lifehigh.site>'
const REPLY_DEFAULT = 'info@lifehigh.site'

/** @param {{ log?: (entry: object) => Promise<any> }} [opts]  log = registra cada envío (para la bandeja del fundador) */
export const createMailer = (env = process.env, fetchImpl = fetch, { log = null } = {}) => {
  const key = env.RESEND_API_KEY
  if (!key) return null
  const from = env.MAIL_FROM || FROM_DEFAULT
  const replyTo = env.MAIL_REPLY_TO || REPLY_DEFAULT
  const site = (env.SITE_URL || SITE_DEFAULT).replace(/\/$/, '')

  // Cada envío queda anotado (destinatario, asunto, tipo y estado). Nunca se guarda el cuerpo: los enlaces llevan tokens.
  const record = async (entry) => { try { await log?.({ dir: 'out', at: Date.now(), ...entry }) } catch { /* el registro nunca rompe un envío */ } }

  const send = async (to, { subject, html, text }, extra = {}, kind = 'otro') => {
    const base = { to, from, subject, kind }
    let res
    try {
      res = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [to], reply_to: replyTo, subject, html, text, ...extra }),
      })
    } catch (e) { await record({ ...base, status: 'failed', detail: 'network' }); throw e }
    if (!res.ok) { await record({ ...base, status: 'failed', detail: `http_${res.status}` }); throw new Error(`mail_failed_${res.status}`) }
    let resendId = null
    try { resendId = typeof res.json === 'function' ? (await res.json())?.id || null : null } catch { /* sin cuerpo */ }
    await record({ ...base, status: 'sent', resendId })
  }

  const ctx = (to, name) => ({ site, to, name })

  return {
    site,
    sendVerify: (to, token, { name } = {}) =>
      send(to, T.verifyEmail({ ...ctx(to, name), link: `${site}/cuenta/verificar?token=${encodeURIComponent(token)}` }), {}, 'verificar'),
    sendReset: (to, token, { name } = {}) =>
      send(to, T.resetPassword({ ...ctx(to, name), link: `${site}/cuenta/restablecer?token=${encodeURIComponent(token)}` }), {}, 'restablecer'),
    sendWelcome: (to, { name } = {}) => send(to, T.welcome(ctx(to, name)), {}, 'bienvenida'),
    sendPasswordChanged: (to, { name } = {}) => send(to, T.passwordChanged(ctx(to, name)), {}, 'clave_cambiada'),
    sendAccountDeleted: (to, { name } = {}) => send(to, T.accountDeleted(ctx(to, name)), {}, 'cuenta_eliminada'),
    /** Avisos de actividad: llevan cabecera List-Unsubscribe (buena práctica y requisito de Gmail/Yahoo). */
    sendActivity: (to, { name, headline, items, unsubscribeLink }) =>
      send(to, T.activity({ ...ctx(to, name), headline, items, unsubscribeLink }), {
        headers: { 'List-Unsubscribe': `<${unsubscribeLink || `mailto:${replyTo}?subject=unsubscribe`}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      }, 'resumen'),
  }
}
