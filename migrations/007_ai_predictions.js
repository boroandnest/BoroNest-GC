// T13 · Prediction log (Phase 3 groundwork). Table only — no agents yet.
// confidence in [0, 1] is enforced by MongoDB; prediction + envelope (rationale, sources,
// what_would_increase_confidence) are required objects; outcome is null until resolved.
import { ensureCollection } from '../lib/db/migrate.js';

export const aiPredictionValidator = {
  $and: [
    { $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'agent', 'taskType', 'confidence', 'prediction', 'envelope', 'createdAt'],
      properties: {
        agent: { bsonType: 'string', minLength: 1 },
        taskType: { bsonType: 'string', minLength: 1 },
        projectId: { bsonType: ['string', 'null'] },
        confidence: { bsonType: ['decimal', 'double', 'int'] },
        prediction: { bsonType: 'object' },
        envelope: { bsonType: 'object', required: ['rationale'] },
        outcome: { bsonType: ['bool', 'null'] },
        resolvedAt: { bsonType: ['date', 'null'] },
        resolvedBy: { bsonType: ['string', 'null'] },
        createdAt: { bsonType: 'date' }
      }
    } },
    { confidence: { $gte: 0, $lte: 1 } },
    { $or: [{ outcome: null }, { outcome: { $exists: false } }, { resolvedAt: { $type: 'date' } }] }
  ]
};

export default {
  id: '007_ai_predictions',
  description: 'ai_predictions with confidence 0..1 check',
  async up(db) {
    const c = await ensureCollection(db, 'ai_predictions', { validator: aiPredictionValidator });
    await c.createIndex({ id: 1 }, { unique: true });
    await c.createIndex({ agent: 1, resolvedAt: 1 }, { partialFilterExpression: { outcome: { $type: 'bool' } } });
    await c.createIndex({ projectId: 1, createdAt: -1 });
  }
};
