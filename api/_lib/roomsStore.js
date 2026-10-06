// Almacenamiento de las salas (cine digital): salas, mensajes y presencia.
// Misma interfaz en memoria (tests/desarrollo) y en MongoDB. Los ids de usuario son strings.
import { ROOM } from '../../src/lib/roomRules.js'

const dup = (code) => Object.assign(new Error(code), { code })
const isDup = (e) => e?.code === 11000
const KEEP_MESSAGES = 300

// ─── Memoria ────────────────────────────────────────────────────────────
export const createMemoryRooms = () => {
  const rooms = new Map()       // code → sala
  const msgs = new Map()        // code → [mensaje]
  const members = new Map()     // `${code}|${userId}` → miembro
  const clone = (x) => (x ? structuredClone(x) : null)

  return {
    kind: 'memory',
    async createRoom(doc) {
      if (rooms.has(doc.code)) throw dup('code_taken')
      rooms.set(doc.code, { ...structuredClone(doc), seq: 0, kicked: [], closedAt: null })
      msgs.set(doc.code, [])
      return clone(rooms.get(doc.code))
    },
    async getRoom(code) { return clone(rooms.get(code)) },
    async updateRoom(code, patch) { const r = rooms.get(code); if (!r) return null; Object.assign(r, structuredClone(patch)); return clone(r) },
    async addKicked(code, userId) { const r = rooms.get(code); if (r && !r.kicked.includes(String(userId))) r.kicked = [...r.kicked, String(userId)].slice(-ROOM.kickedKeep) },
    async countActiveByOwner(ownerId, now) {
      return [...rooms.values()].filter((r) => r.ownerId === String(ownerId) && !r.closedAt && now < r.expiresAt).length
    },
    async nextSeq(code) { const r = rooms.get(code); if (!r) return null; r.seq += 1; return r.seq },
    async addMessage(m) {
      const list = msgs.get(m.code); if (!list) return null
      list.push({ ...structuredClone(m) })
      if (list.length > KEEP_MESSAGES) list.splice(0, list.length - KEEP_MESSAGES)
      return clone(m)
    },
    async messagesSince(code, since, limit = 100) {
      return (msgs.get(code) || []).filter((m) => m.seq > since).slice(0, limit).map(clone)
    },
    async upsertMember(code, m) {
      const k = `${code}|${m.userId}`
      const isNew = !members.has(k)
      members.set(k, { ...(members.get(k) || {}), ...structuredClone(m), code, joinedAt: members.get(k)?.joinedAt || m.lastSeen })
      return isNew
    },
    async getMember(code, userId) { return clone(members.get(`${code}|${userId}`)) },
    async removeMember(code, userId) { return members.delete(`${code}|${userId}`) },
    async onlineMembers(code, sinceMs) {
      return [...members.values()].filter((m) => m.code === code && m.lastSeen >= sinceMs).sort((a, b) => a.joinedAt - b.joinedAt).map(clone)
    },
    async roomsForUser(userId, now) {
      const mine = new Set([...members.values()].filter((m) => m.userId === String(userId)).map((m) => m.code))
      return [...rooms.values()].filter((r) => (r.ownerId === String(userId) || mine.has(r.code)) && !r.closedAt && now < r.expiresAt)
        .sort((a, b) => (a.startsAt || a.createdAt) - (b.startsAt || b.createdAt)).map(clone)
    },
    /** Borra salas que ya vencieron hace más de `keepMs` (con sus mensajes y presencia). */
    async deleteExpired(now, keepMs = ROOM.keepAfterMs) {
      let n = 0
      for (const r of [...rooms.values()]) {
        const end = r.closedAt || r.expiresAt
        if (now - end > keepMs) {
          rooms.delete(r.code); msgs.delete(r.code)
          for (const k of [...members.keys()]) if (k.startsWith(`${r.code}|`)) members.delete(k)
          n += 1
        }
      }
      return n
    },
    async deleteUserData(userId) {
      const uid = String(userId)
      for (const r of [...rooms.values()]) if (r.ownerId === uid) { rooms.delete(r.code); msgs.delete(r.code); for (const k of [...members.keys()]) if (k.startsWith(`${r.code}|`)) members.delete(k) }
      for (const k of [...members.keys()]) if (members.get(k).userId === uid) members.delete(k)
      for (const list of msgs.values()) for (let i = list.length - 1; i >= 0; i--) if (list[i].userId === uid) list.splice(i, 1)
    },
    async stats(now) {
      const all = [...rooms.values()]
      return { rooms: all.length, live: all.filter((r) => !r.closedAt && now < r.expiresAt).length, messages: [...msgs.values()].reduce((a, l) => a + l.length, 0) }
    },
    async ensureIndexes() {},
  }
}

// ─── MongoDB ────────────────────────────────────────────────────────────
export const createMongoRooms = (db) => {
  const rooms = db.collection('rooms')
  const msgs = db.collection('room_messages')
  const members = db.collection('room_members')
  const toRoom = (d) => { if (!d) return null; const { _id, ...rest } = d; return { ...rest, code: _id } }
  const toMsg = (d) => { const { _id, ...rest } = d; return rest }

  return {
    kind: 'mongo',
    async createRoom(doc) {
      try {
        const { code, ...rest } = doc
        await rooms.insertOne({ _id: code, ...rest, seq: 0, kicked: [], closedAt: null })
        return toRoom(await rooms.findOne({ _id: code }))
      } catch (e) { if (isDup(e)) throw dup('code_taken'); throw e }
    },
    async getRoom(code) { return toRoom(await rooms.findOne({ _id: code })) },
    async updateRoom(code, patch) { return toRoom(await rooms.findOneAndUpdate({ _id: code }, { $set: patch }, { returnDocument: 'after' })) },
    async addKicked(code, userId) { await rooms.updateOne({ _id: code }, { $addToSet: { kicked: String(userId) } }) },
    async countActiveByOwner(ownerId, now) { return rooms.countDocuments({ ownerId: String(ownerId), closedAt: null, expiresAt: { $gt: now } }) },
    async nextSeq(code) {
      const r = await rooms.findOneAndUpdate({ _id: code }, { $inc: { seq: 1 } }, { returnDocument: 'after', projection: { seq: 1 } })
      return r ? r.seq : null
    },
    async addMessage(m) {
      await msgs.insertOne({ ...m })
      if (m.seq % 50 === 0) await msgs.deleteMany({ code: m.code, seq: { $lte: m.seq - KEEP_MESSAGES } })
      return m
    },
    async messagesSince(code, since, limit = 100) { return (await msgs.find({ code, seq: { $gt: since } }).sort({ seq: 1 }).limit(limit).toArray()).map(toMsg) },
    async upsertMember(code, m) {
      const r = await members.updateOne(
        { _id: `${code}|${m.userId}` },
        { $set: { ...m, code }, $setOnInsert: { joinedAt: m.lastSeen } },
        { upsert: true },
      )
      return r.upsertedCount > 0
    },
    async getMember(code, userId) { const d = await members.findOne({ _id: `${code}|${userId}` }); if (!d) return null; const { _id, ...rest } = d; return rest },
    async removeMember(code, userId) { return (await members.deleteOne({ _id: `${code}|${userId}` })).deletedCount > 0 },
    async onlineMembers(code, sinceMs) {
      return (await members.find({ code, lastSeen: { $gte: sinceMs } }).sort({ joinedAt: 1 }).limit(ROOM.maxMembers + 5).toArray()).map(({ _id, ...rest }) => rest)
    },
    async roomsForUser(userId, now) {
      const mine = (await members.find({ userId: String(userId) }, { projection: { code: 1 } }).limit(50).toArray()).map((m) => m.code)
      return (await rooms.find({ $or: [{ ownerId: String(userId) }, { _id: { $in: mine } }], closedAt: null, expiresAt: { $gt: now } }).limit(20).toArray()).map(toRoom)
        .sort((a, b) => (a.startsAt || a.createdAt) - (b.startsAt || b.createdAt))
    },
    async deleteExpired(now, keepMs = ROOM.keepAfterMs) {
      const old = await rooms.find({ $or: [{ closedAt: { $ne: null, $lt: now - keepMs } }, { closedAt: null, expiresAt: { $lt: now - keepMs } }] }, { projection: { _id: 1 } }).limit(100).toArray()
      if (!old.length) return 0
      const codes = old.map((r) => r._id)
      await Promise.all([rooms.deleteMany({ _id: { $in: codes } }), msgs.deleteMany({ code: { $in: codes } }), members.deleteMany({ code: { $in: codes } })])
      return codes.length
    },
    async deleteUserData(userId) {
      const uid = String(userId)
      const own = (await rooms.find({ ownerId: uid }, { projection: { _id: 1 } }).toArray()).map((r) => r._id)
      await Promise.all([
        own.length ? rooms.deleteMany({ _id: { $in: own } }) : null,
        own.length ? msgs.deleteMany({ code: { $in: own } }) : null,
        own.length ? members.deleteMany({ code: { $in: own } }) : null,
        members.deleteMany({ userId: uid }),
        msgs.deleteMany({ userId: uid }),
      ])
    },
    async stats(now) {
      const [total, live, messages] = await Promise.all([rooms.estimatedDocumentCount(), rooms.countDocuments({ closedAt: null, expiresAt: { $gt: now } }), msgs.estimatedDocumentCount()])
      return { rooms: total, live, messages }
    },
    async ensureIndexes() {
      await Promise.all([
        rooms.createIndex({ ownerId: 1, closedAt: 1, expiresAt: 1 }),
        rooms.createIndex({ expiresAt: 1 }),
        msgs.createIndex({ code: 1, seq: 1 }),
        msgs.createIndex({ userId: 1 }),
        members.createIndex({ code: 1, lastSeen: -1 }),
        members.createIndex({ userId: 1 }),
      ])
    },
  }
}
