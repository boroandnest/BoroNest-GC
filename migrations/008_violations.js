// T16 · Violation register (pulled forward from Phase 3 by PHASE2_PATCH P3).
// Four separate closure timestamps; evidence status is an enum, not a "verified" boolean.
// buildings gain unit_count with explicit verification + source.
import { ensureCollection } from '../lib/db/migrate.js';
import { buildingValidator } from './003_coi.js';

const ts = { bsonType: ['date', 'null'] };

export const violationValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['id', 'buildingId', 'class', 'description', 'evidenceStatus', 'createdAt'],
    properties: {
      class: { enum: ['A', 'B', 'C', 'I'] },
      description: { bsonType: 'string', minLength: 1 },
      evidenceStatus: { enum: ['reported', 'documented', 'professionally_assessed', 'disputed', 'unknown', 'superseded'] },
      workCompletedAt: ts, clientAcceptedAt: ts, certifiedFiledAt: ts, agencyClosedAt: ts,
      issuedOn: { bsonType: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      correctBy: { bsonType: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      photoIds: { bsonType: 'array', items: { bsonType: 'string' } }
    }
  }
};

export default {
  id: '008_violations',
  description: 'violations register + building unit counts',
  async up(db) {
    const v = await ensureCollection(db, 'violations', { validator: violationValidator });
    await v.createIndex({ id: 1 }, { unique: true });
    await v.createIndex({ buildingId: 1, agencyClosedAt: 1 });
    await v.createIndex({ buildingId: 1, hpdId: 1 }, { unique: true, partialFilterExpression: { hpdId: { $type: 'string' } } });
    const unitFields = {
      unitCount: { bsonType: ['int', 'long', 'null'], minimum: 0 },
      unitCountVerified: { bsonType: 'bool' },
      unitCountSource: { bsonType: ['string', 'null'] }
    };
    const schema = structuredClone(buildingValidator);
    Object.assign(schema.$jsonSchema.properties, unitFields);
    await ensureCollection(db, 'buildings', { validator: schema });
  }
};
