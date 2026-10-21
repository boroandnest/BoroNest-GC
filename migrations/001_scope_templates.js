// T3 · Parametric scope templates.
// Postgres spec: scope_templates + template_tasks + template_params tables. In Mongo the params and
// tasks are embedded arrays on one template document, so a save is atomic. The per-kind field rule
// (spec constraint param_kind_fields) is a collection validator — MongoDB rejects violating writes
// from any client, not just this app. Access is staff-only at the API (templates are pricing IP).
import { ensureCollection } from '../lib/db/migrate.js';

const decimal = { bsonType: 'decimal' };

export const templateValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['id', 'name', 'params', 'tasks'],
    properties: {
      id: { bsonType: 'string' },
      name: { bsonType: 'string', minLength: 1 },
      params: {
        bsonType: 'array',
        items: {
          bsonType: 'object',
          required: ['name', 'kind', 'label'],
          properties: {
            name: { bsonType: 'string', pattern: '^[a-z_][a-z0-9_]*$' },
            kind: { enum: ['input', 'constant', 'calculated'] },
            label: { bsonType: 'string' },
            defaultVal: decimal,
            constVal: decimal,
            formula: { bsonType: 'string', maxLength: 256 }
          },
          oneOf: [
            { properties: { kind: { enum: ['input'] } }, required: ['defaultVal'], not: { required: ['formula'] } },
            { properties: { kind: { enum: ['constant'] } }, required: ['constVal'], not: { required: ['formula'] } },
            { properties: { kind: { enum: ['calculated'] } }, required: ['formula'] }
          ]
        }
      },
      tasks: {
        bsonType: 'array',
        items: {
          bsonType: 'object',
          required: ['key', 'trade', 'title'],
          properties: {
            key: { bsonType: 'string', pattern: '^[a-z_][a-z0-9_]*$' },
            quantityFormula: { bsonType: 'string', maxLength: 256 },
            quantity: decimal,
            unitCost: decimal,
            tariffPct: decimal,
            productionRate: decimal,
            crewSize: { bsonType: ['int', 'long'], minimum: 1 },
            inspectionLeadDays: { bsonType: ['int', 'long'], minimum: 0 },
            needsInspection: { bsonType: 'bool' },
            dependsOn: { bsonType: 'array', items: { bsonType: 'string' } },
            costUpdated: { bsonType: 'date' }
          }
        }
      }
    }
  }
};

export default {
  id: '001_scope_templates',
  description: 'scope_templates with embedded params/tasks and kind-field validator',
  async up(db) {
    const col = await ensureCollection(db, 'scope_templates', { validator: templateValidator });
    await col.createIndex({ id: 1 }, { unique: true });
    await col.createIndex({ name: 1 });
  }
};
