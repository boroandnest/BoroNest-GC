// T12 · Milestone verification + release. Phase 1 milestones gain release fields; the validator
// guarantees a released milestone always records its Stripe transfer, and the unique partial index
// guarantees no transfer id is ever attached to two milestones.
import { ensureCollection } from '../lib/db/migrate.js';

export default {
  id: '006_milestone_release',
  description: 'milestones release fields, released => stripeTransferId',
  async up(db) {
    const ms = await ensureCollection(db, 'milestones', {
      validator: {
        $and: [
          { $jsonSchema: { bsonType: 'object', properties: {
            releaseStatus: { enum: ['awaiting_verification', 'in_window', 'disputed', 'releasing', 'released', 'transfer_failed', 'not_applicable'] },
            amount: { bsonType: ['decimal', 'double', 'int', 'long'] }
          } } },
          { $or: [{ releaseStatus: { $ne: 'released' } }, { stripeTransferId: { $type: 'string' } }] }
        ]
      }
    });
    await ms.createIndex({ id: 1 }, { unique: true });
    await ms.createIndex({ stripeTransferId: 1 }, { unique: true, partialFilterExpression: { stripeTransferId: { $type: 'string' } } });
    await ms.createIndex({ releaseEta: 1, releaseStatus: 1 });
  }
};
