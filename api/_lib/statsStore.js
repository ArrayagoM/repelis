// Almacenamiento de estadísticas (anónimas y agregadas). Misma interfaz en memoria (tests/dev) y MongoDB.
//
//  presence      → quién está conectado AHORA (un doc por visitante, se borra solo en 1 h)
//  stats_daily   → un documento por día con todos los contadores ($inc)
//  stats_titles  → un documento por (día, título) con segundos vistos y reproducciones
//
// Nada de esto guarda IP, mail ni identificadores persistentes: el id de visitante rota cada día.

const TITLE_TTL_MS = 120 * 86400000

const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
const incPath = (obj, path, n) => {
  const keys = path.split('.')
  let o = obj
  for (const k of keys.slice(0, -1)) o = (o[k] ||= {})
  const last = keys[keys.length - 1]
  o[last] = (o[last] || 0) + n
}

// ─── Memoria ────────────────────────────────────────────────────────────
export const createMemoryStats = () => {
  const presence = new Map()
  const daily = new Map()
  const titles = new Map()

  return {
    kind: 'memory',
    async touchPresence(sid, doc) {
      const before = presence.get(sid) ? structuredClone(presence.get(sid)) : null
      presence.set(sid, { ...doc, _id: sid })
      return before
    },
    async incDaily(day, incs) {
      if (!Object.keys(incs).length) return
      const d = daily.get(day) || { _id: day, day }
      for (const [k, v] of Object.entries(incs)) incPath(d, k, v)
      daily.set(day, d)
    },
    async incTitle(day, key, meta, incs) {
      const id = `${day}|${key}`
      const d = titles.get(id) || { _id: id, day, key, ...meta }
      d.title = meta.title || d.title
      for (const [k, v] of Object.entries(incs)) incPath(d, k, v)
      titles.set(id, d)
    },
    async listOnline(sinceMs) {
      return [...presence.values()].filter((p) => p.lastSeen >= sinceMs).map((p) => structuredClone(p))
    },
    async getDailies(days) { return days.map((day) => structuredClone(daily.get(day) || { _id: day, day })) },
    async getTitles(days) {
      const set = new Set(days)
      return [...titles.values()].filter((t) => set.has(t.day)).map((t) => structuredClone(t))
    },
    async ensureIndexes() {},
    // solo tests
    _dump: () => ({ presence, daily, titles }),
    _get: (day, path) => getPath(daily.get(day) || {}, path),
  }
}

// ─── MongoDB ────────────────────────────────────────────────────────────
export const createMongoStats = (db) => {
  const presence = db.collection('presence')
  const daily = db.collection('stats_daily')
  const titles = db.collection('stats_titles')

  return {
    kind: 'mongo',
    async touchPresence(sid, doc) {
      // devuelve el estado ANTERIOR (null si es la primera vez): con eso se calculan segundos y reproducciones
      return presence.findOneAndUpdate(
        { _id: sid },
        { $set: { ...doc, seenAt: new Date(doc.lastSeen) } },
        { upsert: true, returnDocument: 'before' },
      )
    },
    async incDaily(day, incs) {
      if (!Object.keys(incs).length) return
      await daily.updateOne({ _id: day }, { $inc: incs, $setOnInsert: { day } }, { upsert: true })
    },
    async incTitle(day, key, meta, incs) {
      await titles.updateOne(
        { _id: `${day}|${key}` },
        { $inc: incs, $set: { day, key, title: meta.title, type: meta.type }, $setOnInsert: { expireAt: new Date(Date.now() + TITLE_TTL_MS) } },
        { upsert: true },
      )
    },
    async listOnline(sinceMs) {
      return presence.find({ lastSeen: { $gte: sinceMs } }, { projection: { seenAt: 0 } }).limit(5000).toArray()
    },
    async getDailies(days) {
      const docs = await daily.find({ _id: { $in: days } }).toArray()
      const byId = new Map(docs.map((d) => [d._id, d]))
      return days.map((day) => byId.get(day) || { _id: day, day })
    },
    async getTitles(days) { return titles.find({ day: { $in: days } }).limit(20000).toArray() },
    async ensureIndexes() {
      await Promise.all([
        presence.createIndex({ seenAt: 1 }, { expireAfterSeconds: 3600 }),
        presence.createIndex({ lastSeen: 1 }),
        titles.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 }),
        titles.createIndex({ day: 1 }),
      ])
    },
  }
}
