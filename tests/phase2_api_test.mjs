// End-to-end checks for Phase 2 (PHASE2_EXECUTE.md T3–T16 + PHASE2_PATCH.md).
//   MONGO_URL=… DB_NAME=<the server's DB> BASE_URL=… ADMIN_PASSWORD=… node tests/phase2_api_test.mjs
// Never run against production: it creates users, projects and money records.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { admin, member, verify, projectWith, db, harness, RUN } from './helpers.mjs';

const BUILDOUT = JSON.parse(readFileSync(new URL('../shared/fixtures/buildout.template.json', import.meta.url)));

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

// ---------------------------------------------------------------- T4
await test('T4 20-task template instantiates onto a project with quantities, schedule and tariff', async () => {
  const body = structuredClone(BUILDOUT);
  delete body.id;
  body.name = `Buildout ${RUN}`;
  body.tasks.find(t => t.key === 'millwork').tariffPct = '25';
  const saved = await A.call('/api/templates', { method: 'POST', body });
  assert.equal(saved.status, 201, saved.text);
  ctx.buildout = saved.json.template;

  ctx.client = await member('client');
  ctx.sub = await member('subcontractor', { trades: 'Electrical' });
  await verify(A, ctx.sub);
  ctx.rep = await member('building-rep');
  ctx.project = await projectWith(A, { client: ctx.client, gmpCeiling: 420000, contingency: 32000, members: [
    { m: ctx.sub, role: 'subcontractor', scopeTrades: 'electrical' }, { m: ctx.rep, role: 'building-rep' }
  ] });

  assert.equal((await ctx.client.call(`/api/projects/${ctx.project.id}/estimate`, { method: 'POST', body: { templateId: ctx.buildout.id } })).status, 403);
  const r = await A.call(`/api/projects/${ctx.project.id}/estimate`, { method: 'POST', body: { templateId: ctx.buildout.id, startDate: '2026-11-02' } });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.inserted, 20);

  const scope = (await A.call(`/api/projects/${ctx.project.id}/scope`)).json.lines;
  assert.equal(scope.length, 20);
  const by = Object.fromEntries(scope.map(l => [l.templateTaskKey, l]));
  assert.equal(by.framing.quantity, '144');
  assert.equal(by.drywall.quantity, '99');
  assert.equal(by.millwork.baseCost, '14500.00');
  assert.equal(by.millwork.tariffExposure, '3625.00');
  assert.equal(by.millwork.lineTotal, '18125.00', 'tariff folded into line_total');
  assert.ok(by.demo.plannedStart === '2026-11-02' && by.framing.plannedStart > by.demo.plannedEnd);
  ctx.firstIds = scope.map(l => l.id).sort();
});

await test('T4 re-instantiating with one changed input updates every dependent line in place', async () => {
  const before = Object.fromEntries((await A.call(`/api/projects/${ctx.project.id}/scope`)).json.lines.map(l => [l.templateTaskKey, l.quantity]));
  const r = await A.call(`/api/projects/${ctx.project.id}/estimate`, { method: 'POST', body: { templateId: ctx.buildout.id, inputs: { treatment_rooms: '6' } } });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual([r.json.inserted, r.json.updated], [0, 20]);
  const after = (await A.call(`/api/projects/${ctx.project.id}/scope`)).json.lines;
  assert.deepEqual(after.map(l => l.id).sort(), ctx.firstIds, 'line identity preserved');
  const a = Object.fromEntries(after.map(l => [l.templateTaskKey, l.quantity]));
  for (const k of ['framing', 'blocking', 'rough_plumb', 'insulation', 'drywall', 'paint', 'doors', 'fixtures', 'hvac_units']) assert.notEqual(before[k], a[k], k);
  for (const k of ['demo', 'abatement', 'hvac_duct', 'ceiling', 'millwork']) assert.equal(before[k], a[k], k);
});

await test('T4 instantiated lines keep the Phase 1 pricing gate (sub: own trade; rep: no $)', async () => {
  const sub = await ctx.sub.call(`/api/projects/${ctx.project.id}/scope`);
  assert.ok(sub.json.lines.length > 0 && sub.json.lines.every(l => l.trade === 'electrical'));
  assert.equal(sub.json.totals, undefined);
  const rep = await ctx.rep.call(`/api/projects/${ctx.project.id}/scope`);
  assert.equal(rep.json.lines.length, 20);
  for (const k of ['unitCost', 'lineTotal', 'baseCost', 'tariffExposure', 'tariffPct']) assert.ok(!rep.text.includes(`"${k}"`), `${k} leaked`);
  const cl = await ctx.client.call(`/api/projects/${ctx.project.id}/scope`);
  assert.match(cl.json.totals.scopeTotal, /^\d+\.\d{2}$/);
});

finish();
