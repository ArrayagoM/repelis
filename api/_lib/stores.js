// Almacenamiento de cuentas. Dos implementaciones con la MISMA interfaz:
//   · createMemoryStore()  → tests y desarrollo local (sin base)
//   · createMongoStore()   → producción (MongoDB Atlas)
//
// Interfaz (todo async). Los usuarios salen con `id` (string); los tiempos son milisegundos.

const emailTaken = () => Object.assign(new Error('email_taken'), { code: 'email_taken' })

// ─── Memoria ────────────────────────────────────────────────────────────
export const createMemoryStore = () => {
  const users = new Map()
  const sessions = new Map()
  const rate = new Map()
  let seq = 0
  const clone = (u) => (u ? structuredClone(u) : null)

  return {
    kind: 'memory',
    async findUserByEmail(email) { return clone([...users.values()].find((u) => u.email === email)) },
    async findUserById(id) { return clone(users.get(String(id))) },
    async findUserByToken(field, hash, now) {
      const u = [...users.values()].find((x) => x[`${field}Hash`] === hash && (x[`${field}Expires`] || 0) > now)
      return clone(u)
    },
    async createUser(doc) {
      if ([...users.values()].some((u) => u.email === doc.email)) throw emailTaken()
      const id = String(++seq)
      users.set(id, { ...structuredClone(doc), id })
      return clone(users.get(id))
    },
    async updateUser(id, patch) {
      const u = users.get(String(id))
      if (!u) return null
      for (const [k, v] of Object.entries(patch)) { if (v === undefined) delete u[k]; else u[k] = structuredClone(v) }
      return clone(u)
    },
    async deleteUser(id) {
      users.delete(String(id))
      for (const [k, s] of sessions) if (s.userId === String(id)) sessions.delete(k)
    },

    async createSession(s) { sessions.set(s.id, { ...s }) },
    async getSession(id) { return sessions.get(id) ? { ...sessions.get(id) } : null },
    async deleteSession(id) { sessions.delete(id) },
    async deleteSessionsOfUser(userId, exceptId) {
      for (const [k, s] of sessions) if (s.userId === String(userId) && k !== exceptId) sessions.delete(k)
    },
    async countSessions(userId) { return [...sessions.values()].filter((s) => s.userId === String(userId)).length },

    async hit(key, windowMs, now) {
      const cur = rate.get(key)
      if (!cur || cur.resetAt <= now) { rate.set(key, { count: 1, resetAt: now + windowMs }); return 1 }
      cur.count += 1
      return cur.count
    },
    async ensureIndexes() {},
  }
}

// ─── MongoDB ────────────────────────────────────────────────────────────
export const createMongoStore = (db, { ObjectId }) => {
  const users = db.collection('users')
  const sessions = db.collection('sessions')
  const rate = db.collection('rate_limits')

  const oid = (id) => { try { return new ObjectId(String(id)) } catch { return null } }
  const toUser = (d) => {
    if (!d) return null
    const { _id, ...rest } = d
    return { ...rest, id: String(_id) }
  }

  return {
    kind: 'mongo',
    async findUserByEmail(email) { return toUser(await users.findOne({ email })) },
    async findUserById(id) { const _id = oid(id); return _id ? toUser(await users.findOne({ _id })) : null },
    async findUserByToken(field, hash, now) {
      return toUser(await users.findOne({ [`${field}Hash`]: hash, [`${field}Expires`]: { $gt: now } }))
    },
    async createUser(doc) {
      try {
        const { insertedId } = await users.insertOne({ ...doc })
        return toUser({ ...doc, _id: insertedId })
      } catch (e) {
        if (e?.code === 11000) throw emailTaken()
        throw e
      }
    },
    async updateUser(id, patch) {
      const _id = oid(id)
      if (!_id) return null
      const $set = {}
      const $unset = {}
      for (const [k, v] of Object.entries(patch)) { if (v === undefined) $unset[k] = ''; else $set[k] = v }
      const update = {}
      if (Object.keys($set).length) update.$set = $set
      if (Object.keys($unset).length) update.$unset = $unset
      const doc = await users.findOneAndUpdate({ _id }, update, { returnDocument: 'after' })
      return toUser(doc)
    },
    async deleteUser(id) {
      const _id = oid(id)
      if (!_id) return
      await users.deleteOne({ _id })
      await sessions.deleteMany({ userId: String(id) })
    },

    async createSession(s) { await sessions.insertOne({ _id: s.id, userId: s.userId, ua: s.ua, createdAt: new Date(s.createdAt), expiresAt: new Date(s.expiresAt) }) },
    async getSession(id) {
      const d = await sessions.findOne({ _id: id })
      return d ? { id: d._id, userId: d.userId, ua: d.ua, createdAt: d.createdAt.getTime(), expiresAt: d.expiresAt.getTime() } : null
    },
    async deleteSession(id) { await sessions.deleteOne({ _id: id }) },
    async deleteSessionsOfUser(userId, exceptId) {
      await sessions.deleteMany({ userId: String(userId), ...(exceptId ? { _id: { $ne: exceptId } } : {}) })
    },
    async countSessions(userId) { return sessions.countDocuments({ userId: String(userId) }) },

    async hit(key, windowMs, now) {
      const doc = await rate.findOneAndUpdate(
        { _id: key, resetAt: { $gt: new Date(now) } },
        { $inc: { count: 1 } },
        { returnDocument: 'after' },
      )
      if (doc) return doc.count
      await rate.updateOne({ _id: key }, { $set: { count: 1, resetAt: new Date(now + windowMs) } }, { upsert: true })
      return 1
    },

    async ensureIndexes() {
      await Promise.all([
        users.createIndex({ email: 1 }, { unique: true }),
        users.createIndex({ verifyHash: 1 }, { sparse: true }),
        users.createIndex({ resetHash: 1 }, { sparse: true }),
        sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
        sessions.createIndex({ userId: 1 }),
        rate.createIndex({ resetAt: 1 }, { expireAfterSeconds: 0 }),
      ])
    },
  }
}

// ─── Conexión (cacheada entre invocaciones de la función) ───────────────
let cached = null

/** null si no hay MONGODB_URI configurada (las cuentas quedan deshabilitadas, el sitio sigue andando). */
export const getStore = (env = process.env) => {
  const uri = env.MONGODB_URI
  if (!uri) return null
  if (!cached) {
    cached = (async () => {
      const { MongoClient, ObjectId } = await import('mongodb')
      const client = new MongoClient(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 8000 })
      await client.connect()
      const store = createMongoStore(client.db(env.MONGODB_DB || 'lifehigh'), { ObjectId })
      await store.ensureIndexes()
      return store
    })().catch((e) => { cached = null; throw e })   // si falla, el próximo pedido reintenta
  }
  return cached
}
