// T6 · Change orders + database-enforced work blocking.
//
// Postgres spec: co_reason / co_status enums, change_orders, co_scope_lines, scope_blocks and a
// block_unsigned_work() trigger. Mongo mapping:
//   - change_orders: one document per CO with its scope lines embedded (atomic create/sign/void).
//     Enums are enforced by the collection validator.
//   - scope_blocks: audit trail of every block and how it cleared.
//   - scope_lines.openBlocks: ids of unsigned, non-void COs blocking the line. The scope_lines
//     validator below is the trigger: MongoDB rejects ANY write (from this app, a script, a shell)
//     that leaves a line in_progress/complete while openBlocks is non-empty.
// Phase 1 change orders (description/costImpact/Proposed) are converted to this model.
import { Decimal128 } from 'mongodb';
import { ensureCollection } from '../lib/db/migrate.js';

export const CO_REASONS = ['owner_request', 'unforeseen_condition', 'code_requirement', 'design_change', 'value_engineering', 'bn_error'];
export const CO_STATUSES = ['draft', 'pending_signature', 'signed', 'void'];

export const changeOrderValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['id', 'projectId', 'number', 'title', 'reason', 'status', 'costDelta', 'lines'],
    properties: {
      number: { bsonType: ['int', 'long'], minimum: 1 },
      reason: { enum: CO_REASONS },
      status: { enum: CO_STATUSES },
      costDelta: { bsonType: 'decimal' },
      againstContingency: { bsonType: 'bool' },
      scheduleImpactDays: { bsonType: ['int', 'long'] },
      affectsPermit: { bsonType: 'bool' },
      lines: {
        bsonType: 'array',
        items: { bsonType: 'object', required: ['scopeLineId', 'trade'], properties: { costDelta: { bsonType: 'decimal' }, block: { bsonType: 'bool' } } }
      },
      signedAt: { bsonType: 'date' },
      signatureIp: { bsonType: 'string' }
    }
  }
};

// A signed CO must carry its signature; nothing else may claim to be signed.
const signedNeedsSignature = { $or: [{ status: { $ne: 'signed' } }, { signedAt: { $exists: true }, signedName: { $exists: true } }] };

// The work block. Lines without openBlocks (all Phase 1 lines) are unaffected.
export const scopeLineValidator = {
  $or: [
    { status: { $nin: ['in_progress', 'complete'] } },
    { openBlocks: { $exists: false } },
    { openBlocks: { $size: 0 } }
  ]
};

export default {
  id: '002_change_orders',
  description: 'change_orders v2, scope_blocks, scope_lines work-block validator',
  async up(db) {
    // Convert Phase 1 change orders first so the validator never sees the old shape.
    const cos = db.collection('change_orders');
    const legacy = await cos.find({ number: { $exists: false } }).sort({ createdAt: 1 }).toArray();
    const counters = new Map();
    for (const c of legacy) {
      const n = (counters.get(c.projectId) || 0) + 1;
      counters.set(c.projectId, n);
      const status = c.status === 'Approved' ? 'signed' : c.status === 'Rejected' ? 'void' : 'pending_signature';
      await cos.updateOne({ _id: c._id }, {
        $set: {
          number: n,
          title: String(c.description || 'Change order').slice(0, 200),
          description: c.description || '',
          reason: 'owner_request',
          status,
          costDelta: Decimal128.fromString(String(Number(c.costImpact) || 0)),
          againstContingency: false,
          scheduleImpactDays: 0,
          affectsPermit: false,
          lines: [],
          legacy: true,
          ...(status === 'signed' ? { signedAt: c.createdAt || new Date(), signedName: 'Approved before e-signature (legacy record)' } : {})
        },
        $unset: { costImpact: '' }
      });
    }

    const co = await ensureCollection(db, 'change_orders', { validator: { $and: [changeOrderValidator, signedNeedsSignature] } });
    await co.createIndex({ id: 1 }, { unique: true });
    await co.createIndex({ projectId: 1, number: 1 }, { unique: true });

    const blocks = await ensureCollection(db, 'scope_blocks');
    await blocks.createIndex({ coId: 1, scopeLineId: 1 }, { unique: true });
    await blocks.createIndex({ scopeLineId: 1, clearedAt: 1 });

    const lines = await ensureCollection(db, 'scope_lines', { validator: scopeLineValidator });
    await lines.createIndex({ projectId: 1, seq: 1 });
    await lines.createIndex({ openBlocks: 1 });
  }
};
