// T31 · Presentations and their share links.
//
// A presentation goes to someone with no account — an owner, or a prospective
// partner — so the link IS the credential. It is treated like one:
//
//   * only a SHA-256 hash of the token is stored, exactly as Phase 1 does for
//     sessions, so a database read cannot reopen anyone's deck;
//   * every link expires (36 hours, per the owner) and can be revoked;
//   * every view is recorded, because a deck sent to a prospective partner is
//     a document leaving the building and someone will eventually ask where it
//     went.
//
// The deck itself stores no figures. It stores which SECTIONS to build, and
// the content is projected from live data at view time through the same
// role-gated functions the app uses. That way a revoked permission or a
// corrected violation count cannot keep living inside a shared snapshot.
import { ensureCollection } from '../lib/db/migrate.js';

export default {
  id: '011_presentations',
  description: 'presentations, presentation_shares, presentation_views',
  async up(db) {
    const p = await ensureCollection(db, 'presentations', { validator: { $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'kind', 'title', 'sections', 'createdBy', 'createdAt'],
      properties: {
        id: { bsonType: 'string' },
        // An owner deck is about one project and may carry that client's money.
        // A partner deck is portfolio-level and must never identify a client.
        kind: { enum: ['owner', 'partner'] },
        projectId: { bsonType: ['string', 'null'] },
        title: { bsonType: 'string' },
        sections: { bsonType: 'array', items: { bsonType: 'string' } },
        // Figures staff typed in (competitor comparison, ARV comps). Each one
        // carries a savings label and, when unverified, its basis — enforced in
        // lib/savings.js, not here, because the rule is about meaning.
        manualFigures: { bsonType: ['array', 'null'] },
        notes: { bsonType: ['string', 'null'] },
        createdBy: { bsonType: 'string' },
        createdAt: { bsonType: 'date' }
      }
    } } });
    await p.createIndex({ id: 1 }, { unique: true });
    await p.createIndex({ projectId: 1, createdAt: -1 });

    const s = await ensureCollection(db, 'presentation_shares', { validator: { $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'presentationId', 'tokenHash', 'expiresAt', 'createdBy', 'createdAt'],
      properties: {
        id: { bsonType: 'string' },
        presentationId: { bsonType: 'string' },
        // The token itself is never stored. Losing the database does not hand
        // anyone a working link.
        tokenHash: { bsonType: 'string' },
        audience: { bsonType: ['string', 'null'] },
        recipientNote: { bsonType: ['string', 'null'] },
        expiresAt: { bsonType: 'date' },
        revokedAt: { bsonType: ['date', 'null'] },
        revokedBy: { bsonType: ['string', 'null'] },
        createdBy: { bsonType: 'string' },
        createdAt: { bsonType: 'date' }
      }
    } } });
    await s.createIndex({ id: 1 }, { unique: true });
    await s.createIndex({ tokenHash: 1 }, { unique: true });
    await s.createIndex({ presentationId: 1, createdAt: -1 });
    // Expired links are kept, not deleted: the audit answers "who did we send
    // this to" long after the link stops working.
    await s.createIndex({ expiresAt: 1 });

    const v = await ensureCollection(db, 'presentation_views', { validator: { $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'shareId', 'at'],
      properties: {
        id: { bsonType: 'string' },
        shareId: { bsonType: 'string' },
        presentationId: { bsonType: ['string', 'null'] },
        at: { bsonType: 'date' },
        ip: { bsonType: ['string', 'null'] },
        userAgent: { bsonType: ['string', 'null'] }
      }
    } } });
    await v.createIndex({ id: 1 }, { unique: true });
    await v.createIndex({ shareId: 1, at: -1 });
  }
};
