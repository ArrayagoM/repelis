// Bandeja de correo de info@lifehigh.site (solo la ve el fundador desde /panel).
//  · Enviados: cada mail que manda la app se registra con destinatario, asunto, tipo y estado. NO se guarda el cuerpo
//    (los de verificación/restablecer llevan enlaces con token) ni nada sensible.
//  · Recibidos: los avisa Resend por webhook; se guarda quién lo manda, asunto y texto (acotado).
// Misma interfaz en memoria (tests/desarrollo) y en MongoDB.

const clone = (x) => (x ? structuredClone(x) : null)
export const MAX_TEXT = 20_000
export const MAX_HTML = 100_000

// ─── Memoria ────────────────────────────────────────────────────────────
export const createMemoryMail = () => {
  const rows = new Map()
  let seq = 0
  return {
    kind: 'memory',
    async add(doc) {
      const id = `m${++seq}`
      rows.set(id, { ...structuredClone(doc), id, readAt: doc.dir === 'out' ? doc.at : null })
      return clone(rows.get(id))
    },
    /** Evita duplicados cuando Resend reintenta un webhook (misma clave externa). */
    async addOnce(key, doc) {
      for (const r of rows.values()) if (r.key === key) return null
      return this.add({ ...doc, key })
    },
    async get(id) { return clone(rows.get(String(id))) },
    async list({ dir, limit = 30, before = Infinity }) {
      return [...rows.values()].filter((r) => r.dir === dir && r.at < before).sort((a, b) => b.at - a.at).slice(0, limit)
        .map(({ text, html, ...meta }) => ({ ...meta, preview: String(text || '').slice(0, 140), hasBody: !!(text || html) })).map(clone)
    },
    async markRead(id, at) { const r = rows.get(String(id)); if (r && !r.readAt) r.readAt = at; return clone(r) },
    async unreadCount() { return [...rows.values()].filter((r) => r.dir === 'in' && !r.readAt).length },
    /** Actualiza el estado de un envío por su id de Resend (delivered / bounced / complained…). */
    async setStatusByResendId(resendId, status, at, detail) {
      for (const r of rows.values()) if (r.dir === 'out' && r.resendId === resendId) { r.status = status; r.statusAt = at; if (detail) r.detail = detail; return true }
      return false
    },
    async remove(id) { return rows.delete(String(id)) },
    async prune(beforeMs) { let n = 0; for (const [k, r] of [...rows]) if (r.at < beforeMs) { rows.delete(k); n += 1 } return n },
    async stats() {
      const all = [...rows.values()]
      return { sent: all.filter((r) => r.dir === 'out').length, failed: all.filter((r) => r.dir === 'out' && r.status === 'failed').length, bounced: all.filter((r) => r.dir === 'out' && (r.status === 'bounced' || r.status === 'complained')).length, received: all.filter((r) => r.dir === 'in').length, unread: all.filter((r) => r.dir === 'in' && !r.readAt).length }
    },
    async ensureIndexes() {},
  }
}

// ─── MongoDB ────────────────────────────────────────────────────────────
export const createMongoMail = (db, { ObjectId }) => {
  const col = db.collection('mail_log')
  const oid = (id) => { try { return new ObjectId(String(id)) } catch { return null } }
  const out = (d) => { if (!d) return null; const { _id, ...rest } = d; return { ...rest, id: String(_id) } }
  return {
    kind: 'mongo',
    async add(doc) {
      const row = { ...doc, readAt: doc.dir === 'out' ? doc.at : null }
      const { insertedId } = await col.insertOne(row)
      return out({ ...row, _id: insertedId })
    },
    async addOnce(key, doc) {
      try {
        const row = { ...doc, key, readAt: doc.dir === 'out' ? doc.at : null }
        const { insertedId } = await col.insertOne(row)
        return out({ ...row, _id: insertedId })
      } catch (e) { if (e?.code === 11000) return null; throw e }
    },
    async get(id) { const _id = oid(id); return _id ? out(await col.findOne({ _id })) : null },
    async list({ dir, limit = 30, before = Infinity }) {
      const filter = { dir }
      if (Number.isFinite(before)) filter.at = { $lt: before }
      const rows = await col.find(filter, { projection: { html: 0 } }).sort({ at: -1 }).limit(limit).toArray()
      return rows.map((d) => { const { text, ...meta } = out(d); return { ...meta, preview: String(text || '').slice(0, 140), hasBody: !!text } })
    },
    async markRead(id, at) { const _id = oid(id); if (_id) await col.updateOne({ _id, readAt: null }, { $set: { readAt: at } }); return this.get(id) },
    async unreadCount() { return col.countDocuments({ dir: 'in', readAt: null }) },
    async setStatusByResendId(resendId, status, at, detail) {
      const r = await col.updateOne({ dir: 'out', resendId }, { $set: { status, statusAt: at, ...(detail ? { detail } : {}) } })
      return r.matchedCount > 0
    },
    async remove(id) { const _id = oid(id); return _id ? (await col.deleteOne({ _id })).deletedCount > 0 : false },
    async prune(beforeMs) { return (await col.deleteMany({ at: { $lt: beforeMs } })).deletedCount },
    async stats() {
      const [sent, failed, bounced, received, unread] = await Promise.all([
        col.countDocuments({ dir: 'out' }), col.countDocuments({ dir: 'out', status: 'failed' }),
        col.countDocuments({ dir: 'out', status: { $in: ['bounced', 'complained'] } }),
        col.countDocuments({ dir: 'in' }), col.countDocuments({ dir: 'in', readAt: null }),
      ])
      return { sent, failed, bounced, received, unread }
    },
    async ensureIndexes() {
      await Promise.all([
        col.createIndex({ dir: 1, at: -1 }),
        col.createIndex({ key: 1 }, { unique: true, sparse: true }),
        col.createIndex({ resendId: 1 }, { sparse: true }),
        col.createIndex({ dir: 1, readAt: 1 }),
      ])
    },
  }
}
