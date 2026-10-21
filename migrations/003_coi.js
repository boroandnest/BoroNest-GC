// T9 + P1 · COI vault and the subcontractor assignment gate.
//
// Postgres spec: buildings, cois, coi_compliant(), gate_sub_assignment() trigger, coi_submitted_in_time().
// Mongo mapping:
//   - buildings / cois validators enforce shape, enums and that a verified COI records who verified it.
//     P1 is applied from the start: certificate holder is separate from additional insured, AI is
//     static entities + per-unit token templates, auto + employer's liability, 4-business-day lead time.
//   - The compliance rules themselves live in lib/coi/compliance.js (pure, unit-tested) and run in the
//     single assignment path (lib/coi/gate.js).
//   - The database guarantees every assignment carries the COI that justified it: the scope_lines
//     validator rejects any write that sets assignedSub without assignedCoiId. A raw write cannot
//     assign a sub "around" the gate without forging a COI reference.
import { ensureCollection } from '../lib/db/migrate.js';
import { scopeLineValidator } from './002_change_orders.js';

const decimal = { bsonType: 'decimal' };
const strArray = { bsonType: 'array', items: { bsonType: 'string' } };

export const buildingValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['id', 'name', 'requiredAiStatic', 'requiredAiTokens', 'coiLeadDays'],
    properties: {
      id: { bsonType: 'string' },
      name: { bsonType: 'string', minLength: 1 },
      certHolderName: { bsonType: 'string' }, certHolderCo: { bsonType: 'string' }, certHolderAddr: { bsonType: 'string' },
      requiredAiStatic: strArray,
      requiredAiTokens: strArray,
      coiLeadDays: { bsonType: ['int', 'long'], minimum: 0 },
      coiLeadIsBusinessDays: { bsonType: 'bool' },
      coiRecipients: strArray,
      requiredGl: decimal, requiredAuto: decimal, requiredEl: decimal,
      requiresWc: { bsonType: 'bool' }
    }
  }
};

export const coiValidator = {
  $and: [
    {
      $jsonSchema: {
        bsonType: 'object',
        required: ['id', 'holderId', 'projectId', 'status', 'additionalInsured', 'expiresOn', 'submittedAt', 'fileId'],
        properties: {
          status: { enum: ['pending', 'verified', 'rejected'] },
          glLimit: decimal, autoLimit: decimal, elLimit: decimal,
          wcPresent: { bsonType: 'bool' },
          additionalInsured: strArray,
          certHolderText: { bsonType: 'string' },
          expiresOn: { bsonType: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          effectiveOn: { bsonType: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          submittedAt: { bsonType: 'date' }
        }
      }
    },
    { $or: [{ status: { $ne: 'verified' } }, { verifiedAt: { $type: 'date' }, verifiedBy: { $type: 'string' } }] }
  ]
};

// Block rule (T6) AND assignment rule (T9).
export const scopeLineValidatorV2 = {
  $and: [
    scopeLineValidator,
    { $or: [{ assignedSub: { $exists: false } }, { assignedSub: null }, { assignedCoiId: { $type: 'string' } }] }
  ]
};

export default {
  id: '003_coi',
  description: 'buildings, cois, scope_lines assignment rule',
  async up(db) {
    const b = await ensureCollection(db, 'buildings', { validator: buildingValidator });
    await b.createIndex({ id: 1 }, { unique: true });
    const c = await ensureCollection(db, 'cois', { validator: coiValidator });
    await c.createIndex({ id: 1 }, { unique: true });
    await c.createIndex({ projectId: 1, holderId: 1, submittedAt: -1 });
    await c.createIndex({ status: 1, expiresOn: 1 });
    await ensureCollection(db, 'scope_lines', { validator: scopeLineValidatorV2 });
    await db.collection('projects').createIndex({ buildingId: 1 });
  }
};
