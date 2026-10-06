import { describe, it, expect } from 'vitest'
import * as T from '../_lib/emailTemplates.js'
import { createMailer } from '../_lib/mailer.js'

const SITE = 'https://lifehigh.site'
const base = { site: SITE, to: 'ana@mail.com', name: 'Ana María', link: `${SITE}/cuenta/verificar?token=abc` }

describe('plantillas de mail', () => {
  it('cada plantilla trae asunto, HTML y texto plano', () => {
    for (const make of [T.verifyEmail, T.resetPassword, T.welcome, T.passwordChanged, T.accountDeleted]) {
      const m = make(base)
      expect(m.subject.length).toBeGreaterThan(5)
      expect(m.html).toContain('<!doctype html>')
      expect(m.html).toContain('info@lifehigh.site')
      expect(m.text).toContain('info@lifehigh.site')
      expect(m.html).toContain('Hola, Ana')           // solo el primer nombre
    }
  })
  it('los botones llevan el enlace y el texto plano también', () => {
    const v = T.verifyEmail(base)
    expect(v.html).toContain(`href="${base.link}"`)
    expect(v.text).toContain(base.link)
    expect(v.html).toContain('24 horas')
    expect(T.resetPassword(base).html).toContain('1 hora')
  })
  it('escapa los datos variables (nada de HTML inyectado por el nombre o el mail)', () => {
    const m = T.welcome({ ...base, name: '<script>alert(1)</script>', to: 'x"><img src=x@mail.com' })
    expect(m.html).not.toContain('<script>')
    expect(m.html).not.toContain('<img src=x')
    expect(m.html).toContain('&lt;script&gt;')
  })
  it('un enlace con esquema peligroso se neutraliza', () => {
    const m = T.verifyEmail({ ...base, link: 'javascript:alert(1)' })
    expect(m.html).not.toContain('href="javascript:')
  })
  it('sin nombre, saluda sin romper', () => {
    expect(T.welcome({ ...base, name: '' }).html).toContain('Hola,')
    expect(T.welcome({ ...base, name: undefined }).text).toMatch(/^Hola,/)
  })
  it('el aviso de actividad lista hasta 5 elementos y ofrece darse de baja', () => {
    const items = Array.from({ length: 8 }, (_, i) => ({ title: `Lista ${i}`, text: 'de @ana', link: `${SITE}/lista/${i}` }))
    const m = T.activity({ ...base, headline: 'Novedades', items, unsubscribeLink: `${SITE}/cuenta` })
    expect((m.html.match(/href="https:\/\/lifehigh\.site\/lista\//g) || []).length).toBe(5)
    expect(m.html).toContain('Dejar de recibirlos')
  })
})

describe('mailer (Resend)', () => {
  const mk = (env = {}) => {
    const calls = []
    const fetchImpl = async (url, init) => { calls.push({ url, init, body: JSON.parse(init.body) }); return { ok: true, status: 200 } }
    return { mailer: createMailer({ RESEND_API_KEY: 're_test', ...env }, fetchImpl), calls }
  }
  it('sin RESEND_API_KEY no hay mailer', () => expect(createMailer({})).toBeNull())
  it('envía desde info@lifehigh.site con responder-a y credenciales', async () => {
    const { mailer, calls } = mk()
    await mailer.sendVerify('ana@mail.com', 'tok en/1', { name: 'Ana' })
    const c = calls[0]
    expect(c.url).toBe('https://api.resend.com/emails')
    expect(c.init.headers.Authorization).toBe('Bearer re_test')
    expect(c.body.from).toBe('Life High <info@lifehigh.site>')
    expect(c.body.reply_to).toBe('info@lifehigh.site')
    expect(c.body.to).toEqual(['ana@mail.com'])
    expect(c.body.html).toContain('token=tok%20en%2F1')       // el token se codifica
  })
  it('los avisos de actividad llevan List-Unsubscribe', async () => {
    const { mailer, calls } = mk()
    await mailer.sendActivity('ana@mail.com', { name: 'Ana', headline: 'Hola', items: [], unsubscribeLink: 'https://lifehigh.site/cuenta' })
    expect(calls[0].body.headers['List-Unsubscribe']).toBe('<https://lifehigh.site/cuenta>')
  })
  it('si Resend responde error, la promesa falla (el llamador decide)', async () => {
    const mailer = createMailer({ RESEND_API_KEY: 'k' }, async () => ({ ok: false, status: 422 }))
    await expect(mailer.sendWelcome('a@b.com', {})).rejects.toThrow('mail_failed_422')
  })
  it('respeta SITE_URL, MAIL_FROM y MAIL_REPLY_TO', async () => {
    const { mailer, calls } = mk({ SITE_URL: 'https://otro.site/', MAIL_FROM: 'X <x@otro.site>', MAIL_REPLY_TO: 'r@otro.site' })
    await mailer.sendWelcome('a@b.com', {})
    expect(calls[0].body.from).toBe('X <x@otro.site>')
    expect(calls[0].body.reply_to).toBe('r@otro.site')
    expect(calls[0].body.html).toContain('https://otro.site/icon-192.png')
  })
})
