// Almacenamiento de la comunidad (perfiles, listas, likes, seguidores, reportes).
// Misma interfaz en memoria (tests/desarrollo) y en MongoDB. Los ids de usuario son strings.

const dup = (code) => Object.assign(new Error(code), { code })
const MAX_FOLLOWING = 500

// ─── Memoria ────────────────────────────────────────────────────────────
export const createMemorySocial = () => {
  const profiles = new Map()     // userId → perfil
  const lists = new Map()        // id → lista
  const likes = new Set()        // `${userId}|${listId}`
  const follows = new Map()      // `${follower}|${followee}` → { follower, followee, at }
  const reports = new Map()      // `${listId}|${reporter}` → { listId, reporter, reason, at }  (listId = 'c:<id>' para comentarios)
  const comments = new Map()     // id → comentario
  const notifs = new Map()       // id → aviso
  const pushSubs = new Map()     // endpoint → suscripción push
  let seq = 0
  const clone = (x) => (x ? structuredClone(x) : null)

  return {
    kind: 'memory',

    // Perfiles
    async getProfile(userId) { return clone(profiles.get(String(userId))) },
    async getProfileByHandle(handle) { return clone([...profiles.values()].find((p) => p.handle === handle)) },
    async getProfilesByIds(ids) { return ids.map((id) => profiles.get(String(id))).filter(Boolean).map(clone) },
    async createProfile(p) {
      if ([...profiles.values()].some((x) => x.handle === p.handle)) throw dup('handle_taken')
      profiles.set(String(p.userId), { ...structuredClone(p), userId: String(p.userId) })
      return clone(profiles.get(String(p.userId)))
    },
    async updateProfile(userId, patch) {
      const cur = profiles.get(String(userId))
      if (!cur) return null
      if (patch.handle && patch.handle !== cur.handle && [...profiles.values()].some((x) => x.handle === patch.handle)) throw dup('handle_taken')
      Object.assign(cur, structuredClone(patch))
      return clone(cur)
    },

    // Listas
    async createList(doc) {
      const id = `l${++seq}`
      lists.set(id, { ...structuredClone(doc), id, likes: 0, hidden: false })
      return clone(lists.get(id))
    },
    async getList(id) { return clone(lists.get(String(id))) },
    async updateList(id, patch) {
      const cur = lists.get(String(id))
      if (!cur) return null
      Object.assign(cur, structuredClone(patch))
      return clone(cur)
    },
    async deleteList(id) {
      lists.delete(String(id))
      for (const c of [...comments.values()]) if (c.target === `list:${id}`) { comments.delete(c.id); for (const k of [...reports.keys()]) if (k.startsWith(`c:${c.id}|`)) reports.delete(k) }
      for (const k of [...likes]) if (k.endsWith(`|${id}`)) likes.delete(k)
      for (const k of [...reports.keys()]) if (k.startsWith(`${id}|`)) reports.delete(k)
    },
    async listsByOwner(ownerId) {
      return [...lists.values()].filter((l) => l.ownerId === String(ownerId)).sort((a, b) => b.updatedAt - a.updatedAt).map(clone)
    },
    async countListsByOwner(ownerId) { return [...lists.values()].filter((l) => l.ownerId === String(ownerId)).length },
    /** Listas públicas visibles (no ocultas, con al menos un título). sort: 'new' | 'popular' */
    async queryLists({ ownerIds = null, sort = 'new', sinceMs = 0, limit = 24 }) {
      let out = [...lists.values()].filter((l) => l.visibility === 'public' && !l.hidden && l.items.length > 0 && l.updatedAt >= sinceMs)
      if (ownerIds) { const set = new Set(ownerIds.map(String)); out = out.filter((l) => set.has(l.ownerId)) }
      out.sort(sort === 'popular' ? (a, b) => b.likes - a.likes || b.updatedAt - a.updatedAt : (a, b) => b.updatedAt - a.updatedAt)
      return out.slice(0, limit).map(clone)
    },
    async incListLikes(id, n) { const l = lists.get(String(id)); if (l) l.likes = Math.max(0, l.likes + n) },

    // Likes
    async addLike(userId, listId) { const k = `${userId}|${listId}`; if (likes.has(k)) return false; likes.add(k); return true },
    async removeLike(userId, listId) { return likes.delete(`${userId}|${listId}`) },
    /** Me gusta por clave (listas, títulos 'movie:603', comentarios 'c:<id>') → Map clave → cantidad */
    async countLikesMany(keys) { const out = new Map(keys.map((k) => [k, 0])); for (const k of likes) { const key = k.slice(k.indexOf('|') + 1); if (out.has(key)) out.set(key, out.get(key) + 1) } return out },
    async likedSet(userId, listIds) { return new Set(listIds.filter((id) => likes.has(`${userId}|${id}`))) },

    // Seguidores
    async addFollow(a, b) { const k = `${a}|${b}`; if (follows.has(k)) return false; follows.set(k, { follower: String(a), followee: String(b), at: Date.now() }); return true },
    async removeFollow(a, b) { return follows.delete(`${a}|${b}`) },
    async isFollowing(a, b) { return follows.has(`${a}|${b}`) },
    async followingIds(a) { return [...follows.values()].filter((f) => f.follower === String(a)).slice(0, MAX_FOLLOWING).map((f) => f.followee) },
    async countFollowers(b) { return [...follows.values()].filter((f) => f.followee === String(b)).length },
    async countFollowing(a) { return [...follows.values()].filter((f) => f.follower === String(a)).length },

    // Comentarios y opiniones. target = 'list:<id>' | 'movie:<id>' | 'tv:<id>'
    async addComment(doc) { const id = `c${++seq}`; comments.set(id, { ...structuredClone(doc), id, hidden: false }); return clone(comments.get(id)) },
    async getComment(id) { return clone(comments.get(String(id))) },
    async updateComment(id, patch) { const c = comments.get(String(id)); if (!c) return null; Object.assign(c, structuredClone(patch)); return clone(c) },
    async deleteComment(id) { comments.delete(String(id)); for (const k of [...reports.keys()]) if (k.startsWith(`c:${id}|`)) reports.delete(k); for (const k of [...likes]) if (k.endsWith(`|c:${id}`)) likes.delete(k) },
    async findUserComment(userId, target) { return clone([...comments.values()].find((c) => c.target === target && c.authorId === String(userId))) },
    async listComments(target, { limit = 20, before = Infinity } = {}) {
      return [...comments.values()].filter((c) => c.target === target && !c.hidden && c.createdAt < before)
        .sort((a, b) => b.createdAt - a.createdAt).slice(0, limit).map(clone)
    },
    async commentSummary(target) {
      const vis = [...comments.values()].filter((c) => c.target === target && !c.hidden)
      const rated = vis.filter((c) => c.rating)
      return { count: vis.length, rated: rated.length, avg: rated.length ? Math.round((rated.reduce((a, c) => a + c.rating, 0) / rated.length) * 10) / 10 : null }
    },

    // Avisos (notificaciones dentro de la app) y suscripciones push
    async addNotification(n) {
      if ([...notifs.values()].some((x) => x.userId === String(n.userId) && x.key === n.key)) return null
      const id = `n${++seq}`
      notifs.set(id, { ...structuredClone(n), userId: String(n.userId), id, readAt: null })
      return clone(notifs.get(id))
    },
    async listNotifications(userId, limit = 30) {
      return [...notifs.values()].filter((n) => n.userId === String(userId)).sort((a, b) => b.createdAt - a.createdAt).slice(0, limit).map(clone)
    },
    async countUnread(userId) { return [...notifs.values()].filter((n) => n.userId === String(userId) && !n.readAt).length },
    async markRead(userId, at) { for (const n of notifs.values()) if (n.userId === String(userId) && !n.readAt) n.readAt = at },
    async pruneNotifications(beforeMs) { for (const [k, n] of [...notifs]) if (n.createdAt < beforeMs) notifs.delete(k) },
    async followerIds(userId, limit = 500) { return [...follows.values()].filter((f) => f.followee === String(userId)).slice(0, limit).map((f) => f.follower) },
    async addPushSub(sub) { pushSubs.set(sub.endpoint, { ...structuredClone(sub), userId: String(sub.userId) }) },
    async removePushSub(endpoint, userId) { const s = pushSubs.get(endpoint); if (s && (!userId || s.userId === String(userId))) pushSubs.delete(endpoint) },
    async pushSubsOf(userId) { return [...pushSubs.values()].filter((s) => s.userId === String(userId)).map(clone) },

    // Reportes
    async addReport(r) {
      const k = `${r.listId}|${r.reporter}`
      if (reports.has(k)) return { added: false, distinct: [...reports.values()].filter((x) => x.listId === r.listId).length }
      reports.set(k, { ...r })
      return { added: true, distinct: [...reports.values()].filter((x) => x.listId === r.listId).length }
    },
    async reportedLists(limit = 50) {
      const byList = new Map()
      for (const r of reports.values()) {
        const e = byList.get(r.listId) || { listId: r.listId, count: 0, reasons: [], last: 0 }
        e.count += 1; e.last = Math.max(e.last, r.at); if (r.reason) e.reasons.push(r.reason)
        byList.set(r.listId, e)
      }
      return [...byList.values()].sort((a, b) => b.count - a.count || b.last - a.last).slice(0, limit)
    },
    async clearReports(listId) { for (const k of [...reports.keys()]) if (k.startsWith(`${listId}|`)) reports.delete(k) },

    /** Borra todo lo de una persona (derecho al olvido): perfil, listas, likes (y su cuenta en los contadores), follows y reportes. */
    async deleteUserData(userId) {
      const uid = String(userId)
      for (const l of [...lists.values()]) if (l.ownerId === uid) await this.deleteList(l.id)
      for (const k of [...likes]) {
        if (!k.startsWith(`${uid}|`)) continue
        likes.delete(k)
        const l = lists.get(k.slice(uid.length + 1))
        if (l) l.likes = Math.max(0, l.likes - 1)
      }
      for (const [k, f] of [...follows]) if (f.follower === uid || f.followee === uid) follows.delete(k)
      for (const [k, r] of [...reports]) if (r.reporter === uid) reports.delete(k)
      for (const [k, n] of [...notifs]) if (n.userId === uid || n.actorId === uid) notifs.delete(k)
      for (const [k, s] of [...pushSubs]) if (s.userId === uid) pushSubs.delete(k)
      for (const c of [...comments.values()]) if (c.authorId === uid) await this.deleteComment(c.id)
      profiles.delete(uid)
    },

    async stats() {
      const all = [...lists.values()]
      return {
        profiles: profiles.size, lists: all.filter((l) => l.visibility === 'public').length, privateLists: all.filter((l) => l.visibility === 'private').length,
        likes: likes.size, follows: follows.size, hiddenLists: all.filter((l) => l.hidden).length,
        pendingReports: new Set([...reports.values()].map((r) => r.listId)).size,
        comments: comments.size,
      }
    },
    async ensureIndexes() {},
  }
}

// ─── MongoDB ────────────────────────────────────────────────────────────
export const createMongoSocial = (db, { ObjectId }) => {
  const profiles = db.collection('profiles')
  const lists = db.collection('lists')
  const likes = db.collection('likes')
  const follows = db.collection('follows')
  const reports = db.collection('reports')
  const comments = db.collection('comments')
  const notifs = db.collection('notifications')
  const pushSubs = db.collection('push_subs')

  const oid = (id) => { try { return new ObjectId(String(id)) } catch { return null } }
  const toList = (d) => { if (!d) return null; const { _id, ...rest } = d; return { ...rest, id: String(_id) } }
  const toComment = (d) => { if (!d) return null; const { _id, ...rest } = d; return { ...rest, id: String(_id) } }
  const toProfile = (d) => { if (!d) return null; const { _id, ...rest } = d; return { ...rest, userId: String(_id) } }
  const isDup = (e) => e?.code === 11000

  return {
    kind: 'mongo',

    async getProfile(userId) { return toProfile(await profiles.findOne({ _id: String(userId) })) },
    async getProfileByHandle(handle) { return toProfile(await profiles.findOne({ handle })) },
    async getProfilesByIds(ids) {
      if (!ids.length) return []
      return (await profiles.find({ _id: { $in: ids.map(String) } }).toArray()).map(toProfile)
    },
    async createProfile(p) {
      try {
        const { userId, ...rest } = p
        await profiles.insertOne({ _id: String(userId), ...rest })
        return toProfile({ _id: String(userId), ...rest })
      } catch (e) { if (isDup(e)) throw dup('handle_taken'); throw e }
    },
    async updateProfile(userId, patch) {
      try { return toProfile(await profiles.findOneAndUpdate({ _id: String(userId) }, { $set: patch }, { returnDocument: 'after' })) }
      catch (e) { if (isDup(e)) throw dup('handle_taken'); throw e }
    },

    async createList(doc) {
      const { insertedId } = await lists.insertOne({ ...doc, likes: 0, hidden: false })
      return toList({ ...doc, _id: insertedId, likes: 0, hidden: false })
    },
    async getList(id) { const _id = oid(id); return _id ? toList(await lists.findOne({ _id })) : null },
    async updateList(id, patch) { const _id = oid(id); return _id ? toList(await lists.findOneAndUpdate({ _id }, { $set: patch }, { returnDocument: 'after' })) : null },
    async deleteList(id) {
      const _id = oid(id)
      if (!_id) return
      const cs = await comments.find({ target: `list:${id}` }, { projection: { _id: 1 } }).toArray()
      await Promise.all([
        lists.deleteOne({ _id }), likes.deleteMany({ listId: String(id) }), reports.deleteMany({ listId: String(id) }),
        comments.deleteMany({ target: `list:${id}` }),
        cs.length ? reports.deleteMany({ listId: { $in: cs.map((c) => `c:${c._id}`) } }) : null,
      ])
    },
    async listsByOwner(ownerId) { return (await lists.find({ ownerId: String(ownerId) }).sort({ updatedAt: -1 }).limit(200).toArray()).map(toList) },
    async countListsByOwner(ownerId) { return lists.countDocuments({ ownerId: String(ownerId) }) },
    async queryLists({ ownerIds = null, sort = 'new', sinceMs = 0, limit = 24 }) {
      const filter = { visibility: 'public', hidden: false, 'items.0': { $exists: true }, updatedAt: { $gte: sinceMs } }
      if (ownerIds) filter.ownerId = { $in: ownerIds.map(String) }
      const order = sort === 'popular' ? { likes: -1, updatedAt: -1 } : { updatedAt: -1 }
      return (await lists.find(filter).sort(order).limit(limit).toArray()).map(toList)
    },
    async incListLikes(id, n) { const _id = oid(id); if (_id) await lists.updateOne({ _id, likes: { $gte: n < 0 ? 1 : 0 } }, { $inc: { likes: n } }) },

    async addLike(userId, listId) {
      try { await likes.insertOne({ _id: `${userId}|${listId}`, userId: String(userId), listId: String(listId), at: Date.now() }); return true }
      catch (e) { if (isDup(e)) return false; throw e }
    },
    async removeLike(userId, listId) { return (await likes.deleteOne({ _id: `${userId}|${listId}` })).deletedCount > 0 },
    async countLikesMany(keys) {
      const out = new Map(keys.map((k) => [k, 0]))
      if (!keys.length) return out
      const rows = await likes.aggregate([{ $match: { listId: { $in: keys } } }, { $group: { _id: '$listId', n: { $sum: 1 } } }]).toArray()
      for (const r of rows) out.set(r._id, r.n)
      return out
    },
    async likedSet(userId, listIds) {
      if (!listIds.length) return new Set()
      return new Set((await likes.find({ userId: String(userId), listId: { $in: listIds.map(String) } }).toArray()).map((l) => l.listId))
    },

    async addFollow(a, b) {
      try { await follows.insertOne({ _id: `${a}|${b}`, follower: String(a), followee: String(b), at: Date.now() }); return true }
      catch (e) { if (isDup(e)) return false; throw e }
    },
    async removeFollow(a, b) { return (await follows.deleteOne({ _id: `${a}|${b}` })).deletedCount > 0 },
    async isFollowing(a, b) { return !!(await follows.findOne({ _id: `${a}|${b}` }, { projection: { _id: 1 } })) },
    async followingIds(a) { return (await follows.find({ follower: String(a) }).limit(MAX_FOLLOWING).toArray()).map((f) => f.followee) },
    async countFollowers(b) { return follows.countDocuments({ followee: String(b) }) },
    async countFollowing(a) { return follows.countDocuments({ follower: String(a) }) },

    async addComment(doc) {
      const { insertedId } = await comments.insertOne({ ...doc, hidden: false })
      return toComment({ ...doc, _id: insertedId, hidden: false })
    },
    async getComment(id) { const _id = oid(id); return _id ? toComment(await comments.findOne({ _id })) : null },
    async updateComment(id, patch) { const _id = oid(id); return _id ? toComment(await comments.findOneAndUpdate({ _id }, { $set: patch }, { returnDocument: 'after' })) : null },
    async deleteComment(id) {
      const _id = oid(id)
      if (!_id) return
      await Promise.all([comments.deleteOne({ _id }), reports.deleteMany({ listId: `c:${id}` }), likes.deleteMany({ listId: `c:${id}` })])
    },
    async findUserComment(userId, target) { return toComment(await comments.findOne({ target, authorId: String(userId) })) },
    async listComments(target, { limit = 20, before = Infinity } = {}) {
      const filter = { target, hidden: false }
      if (Number.isFinite(before)) filter.createdAt = { $lt: before }
      return (await comments.find(filter).sort({ createdAt: -1 }).limit(limit).toArray()).map(toComment)
    },
    async commentSummary(target) {
      const [row] = await comments.aggregate([
        { $match: { target, hidden: false } },
        { $group: { _id: null, count: { $sum: 1 }, rated: { $sum: { $cond: [{ $gt: ['$rating', 0] }, 1, 0] } }, sum: { $sum: { $ifNull: ['$rating', 0] } } } },
      ]).toArray()
      if (!row) return { count: 0, rated: 0, avg: null }
      return { count: row.count, rated: row.rated, avg: row.rated ? Math.round((row.sum / row.rated) * 10) / 10 : null }
    },

    async addNotification(n) {
      try {
        const doc = { ...n, userId: String(n.userId), _id: `${n.userId}|${n.key}`, readAt: null }
        await notifs.insertOne(doc)
        const { _id, ...rest } = doc
        return { ...rest, id: _id }
      } catch (e) { if (isDup(e)) return null; throw e }
    },
    async listNotifications(userId, limit = 30) {
      return (await notifs.find({ userId: String(userId) }).sort({ createdAt: -1 }).limit(limit).toArray()).map((d) => { const { _id, ...rest } = d; return { ...rest, id: String(_id) } })
    },
    async countUnread(userId) { return notifs.countDocuments({ userId: String(userId), readAt: null }) },
    async markRead(userId, at) { await notifs.updateMany({ userId: String(userId), readAt: null }, { $set: { readAt: at } }) },
    async pruneNotifications(beforeMs) { await notifs.deleteMany({ createdAt: { $lt: beforeMs } }) },
    async followerIds(userId, limit = 500) { return (await follows.find({ followee: String(userId) }).limit(limit).toArray()).map((f) => f.follower) },
    async addPushSub(sub) { await pushSubs.replaceOne({ _id: sub.endpoint }, { ...sub, userId: String(sub.userId), _id: sub.endpoint }, { upsert: true }) },
    async removePushSub(endpoint, userId) { await pushSubs.deleteOne(userId ? { _id: endpoint, userId: String(userId) } : { _id: endpoint }) },
    async pushSubsOf(userId) { return (await pushSubs.find({ userId: String(userId) }).limit(10).toArray()).map(({ _id, ...rest }) => rest) },

    async addReport(r) {
      let added = true
      try { await reports.insertOne({ _id: `${r.listId}|${r.reporter}`, ...r }) } catch (e) { if (isDup(e)) added = false; else throw e }
      return { added, distinct: await reports.countDocuments({ listId: r.listId }) }
    },
    async reportedLists(limit = 50) {
      const rows = await reports.aggregate([
        { $group: { _id: '$listId', count: { $sum: 1 }, last: { $max: '$at' }, reasons: { $push: '$reason' } } },
        { $sort: { count: -1, last: -1 } }, { $limit: limit },
      ]).toArray()
      return rows.map((r) => ({ listId: r._id, count: r.count, last: r.last, reasons: (r.reasons || []).filter(Boolean) }))
    },
    async clearReports(listId) { await reports.deleteMany({ listId: String(listId) }) },

    async deleteUserData(userId) {
      const uid = String(userId)
      const mine = await lists.find({ ownerId: uid }, { projection: { _id: 1 } }).toArray()
      for (const l of mine) await this.deleteList(String(l._id))
      const given = await likes.find({ userId: uid }, { projection: { listId: 1 } }).toArray()
      for (const l of given) await this.incListLikes(l.listId, -1)
      await Promise.all([
        likes.deleteMany({ userId: uid }),
        follows.deleteMany({ $or: [{ follower: uid }, { followee: uid }] }),
        reports.deleteMany({ reporter: uid }),
        comments.deleteMany({ authorId: uid }),
        notifs.deleteMany({ $or: [{ userId: uid }, { actorId: uid }] }),
        pushSubs.deleteMany({ userId: uid }),
        profiles.deleteOne({ _id: uid }),
      ])
    },

    async stats() {
      const [pr, pub, priv, lk, fl, hid, pend, cm] = await Promise.all([
        profiles.estimatedDocumentCount(),
        lists.countDocuments({ visibility: 'public' }), lists.countDocuments({ visibility: 'private' }),
        likes.estimatedDocumentCount(), follows.estimatedDocumentCount(),
        lists.countDocuments({ hidden: true }),
        reports.distinct('listId').then((a) => a.length),
        comments.estimatedDocumentCount(),
      ])
      return { profiles: pr, lists: pub, privateLists: priv, likes: lk, follows: fl, hiddenLists: hid, pendingReports: pend, comments: cm }
    },

    async ensureIndexes() {
      await Promise.all([
        profiles.createIndex({ handle: 1 }, { unique: true }),
        lists.createIndex({ ownerId: 1, updatedAt: -1 }),
        lists.createIndex({ visibility: 1, hidden: 1, updatedAt: -1 }),
        lists.createIndex({ visibility: 1, hidden: 1, likes: -1 }),
        likes.createIndex({ userId: 1, listId: 1 }),
        likes.createIndex({ listId: 1 }),
        follows.createIndex({ follower: 1 }),
        follows.createIndex({ followee: 1 }),
        reports.createIndex({ listId: 1 }),
        comments.createIndex({ target: 1, hidden: 1, createdAt: -1 }),
        comments.createIndex({ target: 1, authorId: 1 }),
        comments.createIndex({ authorId: 1 }),
        notifs.createIndex({ userId: 1, createdAt: -1 }),
        notifs.createIndex({ userId: 1, readAt: 1 }),
        notifs.createIndex({ createdAt: 1 }),
        pushSubs.createIndex({ userId: 1 }),
      ])
    },
  }
}
