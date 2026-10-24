// T33 · Desk quotes — the number given to an owner after a site visit.
//
// A quote is evidence, not a working figure. Comparing live cost against a
// current estimate compares a number to itself, because the estimate moves as
// the job moves; the only thing worth measuring against is what was actually
// promised. So a quote is written once and superseded, never edited — the same
// rule statutory dates follow.
//
// MongoDB validators see the resulting document, not the fact that a write was
// an update, so "never edited" cannot be enforced in the database the way the
// work block in 002 can be. It is enforced by a single writer (lib/quotes.js),
// which has no update path, and by a test asserting no route issues one. The
// partial unique index below is the part the database can hold: at most one
// live quote per project, so a re-quote must supersede rather than race.
import { ensureCollection } from '../lib/db/migrate.js';

export default {
  id: '010_desk_quotes',
  description: 'desk_quotes — frozen post-site-visit quotes with supersede chain',
  async up(db) {
    const q = await ensureCollection(db, 'desk_quotes', { validator: { $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'projectId', 'amount', 'quotedAt', 'quotedBy'],
      properties: {
        id: { bsonType: 'string' },
        projectId: { bsonType: 'string' },
        amount: { bsonType: 'decimal' },
        // Schedule quoted at the visit. Null when none was given.
        durationDays: { bsonType: ['int', 'long', 'null'], minimum: 0 },
        quotedAt: { bsonType: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
        quotedBy: { bsonType: 'string' },
        scopeSummary: { bsonType: ['string', 'null'] },
        // What the number was based on, so "why was it this" survives.
        basis: { bsonType: ['object', 'null'] },
        supersededBy: { bsonType: ['string', 'null'] },
        supersededReason: { bsonType: ['string', 'null'] },
        createdAt: { bsonType: 'date' }
      }
    } } });
    await q.createIndex({ id: 1 }, { unique: true });
    // One live quote per project. A re-quote supersedes the old row in the same
    // write path, so this index is what stops two live quotes existing at once.
    await q.createIndex(
      { projectId: 1 },
      { unique: true, partialFilterExpression: { supersededBy: null } }
    );
    await q.createIndex({ projectId: 1, quotedAt: -1 });
  }
};
