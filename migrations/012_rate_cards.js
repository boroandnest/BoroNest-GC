// Q1 · Versioned rate cards for the public/staff quote engine.
// One document per card version — concepts, modifiers, adders and trade splits
// embedded, so a save is atomic and a card is never half-written. Exactly one
// card is published at a time (partial unique index); a published card's
// trade-split set must sum to 100 per profile, enforced in lib/quote/card.js
// at publish time since Mongo validators cannot sum across array elements.
import { ensureCollection } from '../lib/db/migrate.js';

const decimal = { bsonType: 'decimal' };

export default {
  id: '012_rate_cards',
  description: 'rate_cards — versioned pricing for the quote engine',
  async up(db) {
    const c = await ensureCollection(db, 'rate_cards', { validator: { $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'version', 'effectiveFrom', 'published', 'contingencyLo', 'contingencyHi', 'minCommercial', 'concepts', 'modifiers', 'adders', 'tradeSplits'],
      properties: {
        id: { bsonType: 'string' },
        version: { bsonType: ['int', 'long'] },
        effectiveFrom: { bsonType: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
        effectiveTo: { bsonType: ['string', 'null'] },
        published: { bsonType: 'bool' },
        contingencyLo: decimal, contingencyHi: decimal,
        minCommercial: decimal,
        minResidential: { bsonType: ['decimal', 'null'] },
        notes: { bsonType: ['string', 'null'] },
        concepts: { bsonType: 'array' },
        modifiers: { bsonType: 'array' },
        adders: { bsonType: 'array' },
        tradeSplits: { bsonType: 'array' },
        createdBy: { bsonType: ['string', 'null'] },
        createdAt: { bsonType: 'date' }
      }
    } } });
    await c.createIndex({ id: 1 }, { unique: true });
    await c.createIndex({ version: 1 }, { unique: true });
    // The one card /quote reads.
    await c.createIndex({ published: 1 }, { unique: true, partialFilterExpression: { published: true } });

    const q = await ensureCollection(db, 'rate_quotes', { validator: { $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'publicRef', 'rateCardVersion', 'conceptKey', 'sqft', 'borough', 'condition', 'model', 'status', 'createdAt'],
      properties: {
        id: { bsonType: 'string' },
        publicRef: { bsonType: 'string' },
        // Never nullable, never back-filled: a quote without a card version is
        // unreproducible and therefore undefendable.
        rateCardVersion: { bsonType: ['int', 'long'] },
        conceptKey: { bsonType: 'string' },
        sqft: { bsonType: ['int', 'long'] },
        borough: { bsonType: 'string' },
        condition: { bsonType: 'string' },
        floors: { bsonType: ['int', 'long', 'null'] },
        flags: { bsonType: 'object' },
        model: { bsonType: 'string' },
        result: { bsonType: 'object' },
        contactName: { bsonType: ['string', 'null'] },
        contactEmail: { bsonType: ['string', 'null'] },
        contactPhone: { bsonType: ['string', 'null'] },
        company: { bsonType: ['string', 'null'] },
        leaseStatus: { bsonType: ['string', 'null'] },
        targetOpen: { bsonType: ['string', 'null'] },
        source: { bsonType: ['string', 'null'] },
        status: { enum: ['draft', 'captured', 'contacted', 'review_sold', 'converted', 'disqualified', 'lost'] },
        projectId: { bsonType: ['string', 'null'] },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: ['date', 'null'] }
      }
    } } });
    await q.createIndex({ id: 1 }, { unique: true });
    await q.createIndex({ publicRef: 1 }, { unique: true });
    await q.createIndex({ status: 1, createdAt: -1 });
    await q.createIndex({ contactEmail: 1 });
  }
};
