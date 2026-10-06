// Envío de mails con Resend (https://resend.com, plan gratis). Sin RESEND_API_KEY no hay mails:
// las cuentas funcionan igual, pero no se puede verificar el mail ni recuperar la contraseña.

const SITE_DEFAULT = 'https://repelis.vercel.app'

const wrap = (title, body, buttonText, link) => `<!doctype html>
<html lang="es"><body style="margin:0;background:#08080E;font-family:Arial,Helvetica,sans-serif;color:#F0EDE8">
  <div style="max-width:480px;margin:0 auto;padding:32px 24px">
    <p style="font-size:20px;font-weight:bold;margin:0 0 20px">Life <span style="color:#E8A020">High</span></p>
    <h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
    <p style="font-size:15px;line-height:1.6;color:#cfcac2;margin:0 0 24px">${body}</p>
    <a href="${link}" style="display:inline-block;background:#E8A020;color:#08080E;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:999px">${buttonText}</a>
    <p style="font-size:12px;color:#7A7488;margin:28px 0 0;line-height:1.5">Si el botón no funciona, copiá este enlace en tu navegador:<br>${link}</p>
    <p style="font-size:12px;color:#7A7488;margin:16px 0 0">Si no fuiste vos, ignorá este mail: no pasa nada.</p>
  </div>
</body></html>`

export const createMailer = (env = process.env, fetchImpl = fetch) => {
  const key = env.RESEND_API_KEY
  if (!key) return null
  const from = env.MAIL_FROM || 'Life High <onboarding@resend.dev>'
  const site = (env.SITE_URL || SITE_DEFAULT).replace(/\/$/, '')

  const send = async ({ to, subject, html, text }) => {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
    })
    if (!res.ok) throw new Error(`mail_failed_${res.status}`)
  }

  return {
    site,
    sendVerify: (to, token) => {
      const link = `${site}/cuenta/verificar?token=${encodeURIComponent(token)}`
      return send({
        to, subject: 'Confirmá tu mail en Life High',
        html: wrap('Confirmá tu mail', 'Tocá el botón para confirmar tu dirección. El enlace vale 24 horas.', 'Confirmar mail', link),
        text: `Confirmá tu mail en Life High (vale 24 horas): ${link}`,
      })
    },
    sendReset: (to, token) => {
      const link = `${site}/cuenta/restablecer?token=${encodeURIComponent(token)}`
      return send({
        to, subject: 'Restablecé tu contraseña de Life High',
        html: wrap('Restablecé tu contraseña', 'Pediste cambiar tu contraseña. Tocá el botón para elegir una nueva. El enlace vale 1 hora.', 'Elegir nueva contraseña', link),
        text: `Restablecé tu contraseña de Life High (vale 1 hora): ${link}`,
      })
    },
  }
}
