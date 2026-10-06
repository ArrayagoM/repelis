// Resumen diario por email de los avisos sin leer. Solo para quien lo activó en /avisos (opt-in) y solo si hubo novedades.
// Lo dispara una tarea programada de Vercel (api/cron/digest.js) una vez por día.

const DAY = 86_400_000
const MAX_USERS = 300

/**
 * @param {{ store, social, mailer, now?: () => number, site?: string }} deps
 * @returns {Promise<{ checked: number, sent: number, failed: number }>}
 */
export const runDigest = async ({ store, social, mailer, now = Date.now, site = 'https://lifehigh.site' }) => {
  const t = now()
  await social.pruneNotifications?.(t - 60 * DAY)                      // los avisos duran 60 días
  if (!mailer?.sendActivity) return { checked: 0, sent: 0, failed: 0 }
  const users = await store.usersWithEmailPrefs(MAX_USERS)
  let sent = 0, failed = 0
  for (const u of users) {
    if (u.emailVerified !== true) continue                             // solo a mails confirmados
    const since = Math.max(u.lastDigestAt || 0, t - DAY)
    const items = (await social.listNotifications(u.id, 20)).filter((n) => !n.readAt && n.createdAt > since)
    if (!items.length) continue
    try {
      await mailer.sendActivity(u.email, {
        name: u.name,
        headline: items.length === 1 ? 'Tenés 1 novedad en Life High' : `Tenés ${items.length} novedades en Life High`,
        items: items.map((n) => ({ title: n.text, link: `${site}${n.link || ''}` })),
        unsubscribeLink: `${site}/avisos`,
      })
      await store.updateUser(u.id, { lastDigestAt: t })
      sent += 1
    } catch { failed += 1 }
  }
  return { checked: users.length, sent, failed }
}
