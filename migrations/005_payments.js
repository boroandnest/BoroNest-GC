// T11 · payment_events (webhook log, idempotent on Stripe event id) + payee lookup index.
import { ensureCollection } from '../lib/db/migrate.js';

export default {
  id: '005_payments',
  description: 'payment_events, users.payouts index',
  async up(db) {
    const e = await ensureCollection(db, 'payment_events', {
      validator: { $jsonSchema: { bsonType: 'object', required: ['type', 'at'], properties: { amount: { bsonType: ['decimal', 'null'] } } } }
    });
    await e.createIndex({ eventId: 1 }, { unique: true, partialFilterExpression: { eventId: { $type: 'string' } } });
    await e.createIndex({ milestoneId: 1, at: -1 });
    await db.collection('users').createIndex({ 'payouts.stripeAccountId': 1 }, { sparse: true });
  }
};
