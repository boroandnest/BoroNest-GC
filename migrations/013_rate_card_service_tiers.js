// Q1 follow-up · Adds an optional serviceTiers dimension to rate_cards —
// Build / Build+Approvals / Turnkey, each with a disclosed fee basis and a
// list of additive add-on costs (expediter, approvals coordination, design
// management). These are genuinely additive line items, same mechanism as
// card.adders, never a second hardcoded pricing engine: the psf bands in
// concepts stay the only source for the construction-cost number, so the
// site and the quote engine can never show two different totals for the
// same inputs.
import { ensureCollection } from '../lib/db/migrate.js';

const decimal = { bsonType: 'decimal' };

export default {
  id: '013_rate_card_service_tiers',
  description: 'rate_cards.serviceTiers — Build / Build+Approvals / Turnkey packages, additive add-ons only',
  async up(db) {
    await ensureCollection(db, 'rate_cards', { validator: { $jsonSchema: {
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
        serviceTiers: { bsonType: 'array' },
        createdBy: { bsonType: ['string', 'null'] },
        createdAt: { bsonType: 'date' }
      }
    } } });
    // Backfill existing cards so every document has the field once this
    // migration has run, even though it's optional in the validator above.
    await db.collection('rate_cards').updateMany(
      { serviceTiers: { $exists: false } },
      { $set: { serviceTiers: [] } }
    );

    // rate_quotes gets one new optional field — which tier (if any) the
    // prospect had selected when they got this range. Everything already
    // required stays required; this is purely additive.
    await ensureCollection(db, 'rate_quotes', { validator: { $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'publicRef', 'rateCardVersion', 'conceptKey', 'sqft', 'borough', 'condition', 'model', 'status', 'createdAt'],
      properties: {
        id: { bsonType: 'string' },
        publicRef: { bsonType: 'string' },
        rateCardVersion: { bsonType: ['int', 'long'] },
        conceptKey: { bsonType: 'string' },
        sqft: { bsonType: ['int', 'long'] },
        borough: { bsonType: 'string' },
        condition: { bsonType: 'string' },
        floors: { bsonType: ['int', 'long', 'null'] },
        flags: { bsonType: 'object' },
        model: { bsonType: 'string' },
        result: { bsonType: 'object' },
        serviceTierKey: { bsonType: ['string', 'null'] },
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
  }
};
