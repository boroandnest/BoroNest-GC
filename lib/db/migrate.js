// Mongo stand-in for the spec's SQL migrations. Each file in /migrations exports
// { id, description, up(db) } and runs once; applied ids are recorded in `_migrations`.
// Validators added here are enforced by MongoDB itself on every write, from any client.
import { MIGRATIONS } from '../../migrations/index.js';

export async function runMigrations(db, { log = console.log } = {}) {
  const applied = db.collection('_migrations');
  const done = new Set((await applied.find({}, { projection: { _id: 1 } }).toArray()).map(d => d._id));
  const ran = [];
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    // Claim first so two app instances starting together don't both run it.
    try {
      await applied.insertOne({ _id: m.id, description: m.description, startedAt: new Date() });
    } catch (e) {
      if (e.code === 11000) continue;
      throw e;
    }
    try {
      await m.up(db);
      await applied.updateOne({ _id: m.id }, { $set: { finishedAt: new Date() } });
      ran.push(m.id);
      log(`[migrate] applied ${m.id}`);
    } catch (e) {
      await applied.deleteOne({ _id: m.id });
      throw new Error(`migration ${m.id} failed: ${e.message}`);
    }
  }
  return ran;
}

// Create the collection if needed and (re)apply its validator. Idempotent.
export async function ensureCollection(db, name, { validator, validationLevel = 'strict' } = {}) {
  const exists = (await db.listCollections({ name }, { nameOnly: true }).toArray()).length > 0;
  if (!exists) {
    await db.createCollection(name, validator ? { validator, validationLevel, validationAction: 'error' } : {});
  } else if (validator) {
    await db.command({ collMod: name, validator, validationLevel, validationAction: 'error' });
  }
  return db.collection(name);
}
