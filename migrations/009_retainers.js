// T15 · Retainers, retainer periods and material pass-throughs (PHASE2_PATCH P2).
// The unique (retainerId, periodStart) index makes period generation idempotent.
import { ensureCollection } from '../lib/db/migrate.js';

const decimal = { bsonType: 'decimal' };
const date = { bsonType: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' };

export default {
  id: '009_retainers',
  description: 'retainers, retainer_periods, material_passthroughs',
  async up(db) {
    const r = await ensureCollection(db, 'retainers', { validator: { $jsonSchema: {
      bsonType: 'object', required: ['id', 'projectId', 'label', 'monthlyAmount', 'startsOn', 'billDay', 'status'],
      properties: {
        monthlyAmount: decimal, startsOn: date, endsOn: { bsonType: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
        billDay: { bsonType: ['int', 'long'], minimum: 1, maximum: 28 },
        status: { enum: ['active', 'paused', 'ended'] },
        guaranteeKind: { enum: ['no_violation_growth', 'response_sla', null] },
        guaranteeCreditPct: decimal
      }
    } } });
    await r.createIndex({ id: 1 }, { unique: true });
    await r.createIndex({ projectId: 1 });

    const p = await ensureCollection(db, 'retainer_periods', { validator: { $jsonSchema: {
      bsonType: 'object', required: ['id', 'retainerId', 'projectId', 'periodStart', 'periodEnd', 'baseAmount', 'amount', 'status'],
      properties: {
        periodStart: date, periodEnd: date, baseAmount: decimal, amount: decimal, creditApplied: decimal,
        status: { enum: ['pending', 'invoiced', 'paid', 'disputed'] },
        deliverablesMet: { bsonType: ['bool', 'null'] }
      }
    } } });
    await p.createIndex({ retainerId: 1, periodStart: 1 }, { unique: true });
    await p.createIndex({ projectId: 1, periodStart: 1 });

    const m = await ensureCollection(db, 'material_passthroughs', { validator: { $jsonSchema: {
      bsonType: 'object', required: ['id', 'projectId', 'periodStart', 'vendor', 'description', 'cost', 'markupPct', 'billed'],
      properties: { cost: decimal, markupPct: decimal, billed: decimal, periodStart: date }
    } } });
    await m.createIndex({ id: 1 }, { unique: true });
    await m.createIndex({ projectId: 1, periodStart: 1 });
  }
};
