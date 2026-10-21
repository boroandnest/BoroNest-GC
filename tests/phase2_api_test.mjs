// End-to-end checks for Phase 2 (PHASE2_EXECUTE.md T3–T16 + PHASE2_PATCH.md).
//   MONGO_URL=… DB_NAME=<the server's DB> BASE_URL=… ADMIN_PASSWORD=… node tests/phase2_api_test.mjs
// Never run against production: it creates users, projects and money records.
import assert from 'node:assert/strict';
import { admin, member, verify, projectWith, db, harness, RUN } from './helpers.mjs';

const { test, finish } = harness();
const A = await admin();
const ctx = {};

// ---------------------------------------------------------------- T3
await test('T3 staff saves a template; non-staff get no rows', async () => {
  const r = await A.call('/api/templates', { method: 'POST', body: {
    name: `Room ${RUN}`,
    params: [
      { name: 'length', kind: 'input', label: 'Length', defaultVal: '12' },
      { name: 'width', kind: 'input', label: 'Width', defaultVal: '10' },
      { name: 'height', kind: 'input', label: 'Height', defaultVal: '9' },
      { name: 'waste', kind: 'constant', label: 'Waste', constVal: '1.1' },
      { name: 'wall_area', kind: 'calculated', label: 'Wall area', formula: 'perimeter * height' },
      { name: 'perimeter', kind: 'calculated', label: 'Perimeter', formula: '2 * (length + width)' }
    ],
    tasks: [{ key: 'drywall', trade: 'carpentry', title: 'Drywall', quantityFormula: 'round(wall_area * waste / 32, 0)', unit: 'sheet', unitCost: '14.50' }]
  } });
  assert.equal(r.status, 201, r.text);
  assert.equal(r.json.template.params.find(p => p.name === 'waste').constVal, '1.1');
  ctx.roomTemplate = r.json.template;

  const client = await member('client');
  const list = await client.call('/api/templates');
  assert.equal(list.status, 403);
  assert.ok(!('templates' in (list.json || {})), 'no rows for non-staff');
  assert.equal((await client.call(`/api/templates/${ctx.roomTemplate.id}`)).status, 403);
});

await test('T3 cycle rejected at save, naming both params', async () => {
  const r = await A.call('/api/templates', { method: 'POST', body: { name: 'cyc', params: [
    { name: 'l', kind: 'input', label: 'l', defaultVal: '1' },
    { name: 'area', kind: 'calculated', label: 'a', formula: 'l * h' },
    { name: 'h', kind: 'calculated', label: 'h', formula: 'area / l' }
  ], tasks: [] } });
  assert.equal(r.status, 422);
  assert.equal(r.json.code, 'param_cycle');
  assert.deepEqual([...r.json.cycle].sort(), ['area', 'h']);
});

await test('T3 undefined reference rejected at save', async () => {
  const r = await A.call('/api/templates', { method: 'POST', body: { name: 'undef', params: [{ name: 'a', kind: 'calculated', label: 'a', formula: 'b * 2' }], tasks: [] } });
  assert.equal(r.status, 422);
  assert.equal(r.json.code, 'undefined_reference');
});

await test('T3 kind-field rule is enforced by MongoDB itself (raw write bypassing the app)', async () => {
  const { client, db: d } = await db();
  try {
    await assert.rejects(
      d.collection('scope_templates').insertOne({ id: `raw-${RUN}`, name: 'raw', params: [{ name: 'x', kind: 'input', label: 'x', formula: '1' }], tasks: [] }),
      (e) => e.code === 121 // DocumentValidationFailure
    );
  } finally { await client.close(); }
});

finish();
