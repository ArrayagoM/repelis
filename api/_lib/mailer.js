// Envío de mails con Resend (https://resend.com). Sin RESEND_API_KEY no hay mails:
// las cuentas funcionan igual, pero no se puede verificar el mail ni recuperar la contraseña.
// Remitente: "Life High <info@lifehigh.site>" (el dominio se verifica en Resend con SPF/DKIM/DMARC).

import * as T from './emailTemplates.js'

const SITE_DEFAULT = 'https://lifehigh.site'
const FROM_DEFAULT = 'Life High <info@lifehigh.site>'
const REPLY_DEFAULT = 'info@lifehigh.site'

export const createMailer = (env = process.env, fetchImpl = fetch) => {
  const key = env.RESEND_API_KEY
  if (!key) return null
  const from = env.MAIL_FROM || FROM_DEFAULT
  const replyTo = env.MAIL_REPLY_TO || REPLY_DEFAULT
  const site = (env.SITE_URL || SITE_DEFAULT).replace(/\/$/, '')

  const send = async (to, { subject, html, text }, extra = {}) => {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], reply_to: replyTo, subject, html, text, ...extra }),
    })
    if (!res.ok) throw new Error(`mail_failed_${res.status}`)
  }

  const ctx = (to, name) => ({ site, to, name })

  return {
    site,
    sendVerify: (to, token, { name } = {}) =>
      send(to, T.verifyEmail({ ...ctx(to, name), link: `${site}/cuenta/verificar?token=${encodeURIComponent(token)}` })),
    sendReset: (to, token, { name } = {}) =>
      send(to, T.resetPassword({ ...ctx(to, name), link: `${site}/cuenta/restablecer?token=${encodeURIComponent(token)}` })),
    sendWelcome: (to, { name } = {}) => send(to, T.welcome(ctx(to, name))),
    sendPasswordChanged: (to, { name } = {}) => send(to, T.passwordChanged(ctx(to, name))),
    sendAccountDeleted: (to, { name } = {}) => send(to, T.accountDeleted(ctx(to, name))),
    /** Avisos de actividad: llevan cabecera List-Unsubscribe (buena práctica y requisito de Gmail/Yahoo). */
    sendActivity: (to, { name, headline, items, unsubscribeLink }) =>
      send(to, T.activity({ ...ctx(to, name), headline, items, unsubscribeLink }), {
        headers: { 'List-Unsubscribe': `<${unsubscribeLink || `mailto:${replyTo}?subject=unsubscribe`}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      }),
  }
}
