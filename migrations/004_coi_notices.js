// T10 · coi_notices: one row per (certificate, tier). The unique index is what makes the sweep idempotent.
import { ensureCollection } from '../lib/db/migrate.js';

export default {
  id: '004_coi_notices',
  description: 'coi_notices unique (coiId, tier)',
  async up(db) {
    const n = await ensureCollection(db, 'coi_notices', {
      validator: { $jsonSchema: { bsonType: 'object', required: ['coiId', 'tier', 'sentOn'], properties: { tier: { enum: ['day30', 'day7', 'expired'] } } } }
    });
    await n.createIndex({ coiId: 1, tier: 1 }, { unique: true });
  }
};
