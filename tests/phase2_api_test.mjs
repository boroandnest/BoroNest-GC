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

// ---------------------------------------------------------------- T5
await test('T5 worksheet: rollup equals lib/money, stale flag at 130 days, tariff + domestic alternative', async () => {
  const { toMoney, toMoneyString } = await import('../lib/money.js');
  const tpl = (await A.call(`/api/templates/${ctx.buildout.id}`)).json.template;
  const old = new Date(Date.now() - 130 * 86400000).toISOString();
  for (const t of tpl.tasks) {
    if (t.key === 'demo') t.costUpdated = old;
    if (t.key === 'millwork') { t.altDomesticMfr = 'Brooklyn Millworks'; t.specifiedMfr = 'Arper'; t.specifiedProduct = 'Desk system'; }
  }
  const { id, createdAt, createdBy, updatedAt, updatedBy, ...body } = tpl;
  assert.equal((await A.call(`/api/templates/${id}`, { method: 'PUT', body })).status, 200);
  assert.equal((await A.call(`/api/projects/${ctx.project.id}/estimate`, { method: 'POST', body: { templateId: id } })).status, 200);

  assert.equal((await ctx.client.call(`/api/projects/${ctx.project.id}/estimate`)).status, 403);
  const w = (await A.call(`/api/projects/${ctx.project.id}/estimate`)).json;
  const demo = w.rows.find(r => r.title === 'Selective demo');
  assert.equal(demo.staleCost, true);
  assert.ok(demo.costAgeDays >= 130);
  assert.equal(w.staleCount, 1);
  const mw = w.rows.find(r => r.title === 'Reception millwork');
  assert.equal(mw.hasTariff, true);
  assert.equal(mw.tariffExposure, '3625.00');
  assert.equal(mw.altDomesticMfr, 'Brooklyn Millworks');

  let total = toMoney(0), tariff = toMoney(0);
  for (const r of w.rows) { total = total.plus(r.lineTotal); tariff = tariff.plus(r.tariffExposure); }
  assert.equal(w.rollup.scopeTotal, toMoneyString(total));
  assert.equal(w.rollup.tariffTotal, toMoneyString(tariff));
  assert.equal(w.rollup.contingency, '32000.00');
  assert.equal(w.rollup.proposedCeiling, toMoneyString(total.plus('32000')));
});

// ---------------------------------------------------------------- T6
await test('T6 a blocked line cannot start: rejected by the API (409) AND by MongoDB on a raw write', async () => {
  const lines = (await A.call(`/api/projects/${ctx.project.id}/scope`)).json.lines;
  ctx.elecLine = lines.find(l => l.templateTaskKey === 'rough_elec');
  ctx.plumbLine = lines.find(l => l.templateTaskKey === 'rough_plumb');
  const r = await A.call(`/api/projects/${ctx.project.id}/changes`, { method: 'POST', body: {
    title: 'Relocate panel', reason: 'unforeseen_condition', againstContingency: true, scheduleImpactDays: 2,
    lines: [{ scopeLineId: ctx.elecLine.id, costDelta: '6200.00' }]
  } });
  assert.equal(r.status, 201, r.text);
  ctx.co1 = r.json.changeOrder;
  assert.equal(ctx.co1.status, 'pending_signature');
  assert.equal(ctx.co1.costDelta, '6200.00');

  const blocked = await A.call(`/api/projects/${ctx.project.id}/scope/${ctx.elecLine.id}`, { method: 'PATCH', body: { status: 'in_progress' } });
  assert.equal(blocked.status, 409, blocked.text);
  assert.equal(blocked.json.code, 'blocked_by_change_order');

  const { client, db: d } = await db();
  try {
    await assert.rejects(d.collection('scope_lines').updateOne({ id: ctx.elecLine.id }, { $set: { status: 'in_progress' } }), (e) => e.code === 121);
    await assert.rejects(d.collection('scope_lines').updateOne({ id: ctx.elecLine.id }, { $set: { status: 'complete' } }), (e) => e.code === 121);
    assert.equal((await d.collection('scope_blocks').countDocuments({ coId: ctx.co1.id, clearedAt: null })), 1);
  } finally { await client.close(); }
});

await test('T6 signing the CO clears the block and the update succeeds', async () => {
  const s = await ctx.client.call(`/api/projects/${ctx.project.id}/changes/${ctx.co1.id}/sign`, { method: 'POST', body: { signedName: 'Pat Client' } });
  assert.equal(s.status, 200, s.text);
  const ok = await A.call(`/api/projects/${ctx.project.id}/scope/${ctx.elecLine.id}`, { method: 'PATCH', body: { status: 'in_progress' } });
  assert.equal(ok.status, 200, ok.text);
  const again = await ctx.client.call(`/api/projects/${ctx.project.id}/changes/${ctx.co1.id}/sign`, { method: 'POST', body: { signedName: 'Pat Client' } });
  assert.equal(again.status, 409, 'cannot sign twice');
});

await test('T6 voiding the CO also clears the block', async () => {
  const r = await A.call(`/api/projects/${ctx.project.id}/changes`, { method: 'POST', body: { title: 'Extra cleanout', reason: 'owner_request', lines: [{ scopeLineId: ctx.plumbLine.id, costDelta: '900' }] } });
  assert.equal(r.status, 201);
  assert.equal((await A.call(`/api/projects/${ctx.project.id}/scope/${ctx.plumbLine.id}`, { method: 'PATCH', body: { status: 'in_progress' } })).status, 409);
  assert.equal((await A.call(`/api/projects/${ctx.project.id}/changes/${r.json.changeOrder.id}/void`, { method: 'POST', body: { reason: 'client withdrew' } })).status, 200);
  assert.equal((await A.call(`/api/projects/${ctx.project.id}/scope/${ctx.plumbLine.id}`, { method: 'PATCH', body: { status: 'in_progress' } })).status, 200);
});

await test('T6 blocking a line already in progress pauses it atomically', async () => {
  const r = await A.call(`/api/projects/${ctx.project.id}/changes`, { method: 'POST', body: { title: 'Add GFCI', reason: 'code_requirement', lines: [{ scopeLineId: ctx.plumbLine.id, costDelta: '300' }] } });
  assert.equal(r.status, 201, r.text);
  const line = (await A.call(`/api/projects/${ctx.project.id}/scope`)).json.lines.find(l => l.id === ctx.plumbLine.id);
  assert.equal(line.status, 'paused');
  ctx.co3 = r.json.changeOrder;
});

await test('T6 project_financials is staff-only and exposes absorbed losses', async () => {
  for (const m of [ctx.client, ctx.sub, ctx.rep]) {
    const r = await m.call(`/api/projects/${ctx.project.id}/financials`);
    assert.equal(r.status, 403);
    assert.ok(!r.text.includes('absorbedLosses'));
  }
  const f = (await A.call(`/api/projects/${ctx.project.id}/financials`)).json.financials;
  assert.equal(f.contingencyUsed, '6200.00');
  assert.equal(f.absorbedLosses, '0.00');
});

// ---------------------------------------------------------------- T7
await test('T7 sub fetching a CO on another trade gets 404, not a filtered 200', async () => {
  const r = await ctx.sub.call(`/api/projects/${ctx.project.id}/changes/${ctx.co3.id}`); // plumbing-only CO
  assert.equal(r.status, 404);
  const list = await ctx.sub.call(`/api/projects/${ctx.project.id}/changes`);
  assert.ok(!list.json.changeOrders.some(c => c.id === ctx.co3.id));
});

await test('T7 sub sees scope_revision, never bn_error, and only own-scope cost', async () => {
  const r = await A.call(`/api/projects/${ctx.project.id}/changes`, { method: 'POST', body: {
    title: 'Re-pull home runs', description: 'We under-measured the conduit run', reason: 'bn_error',
    lines: [{ scopeLineId: ctx.elecLine.id, costDelta: '1800' }, { scopeLineId: ctx.plumbLine.id, costDelta: '700' }]
  } });
  assert.equal(r.status, 201, r.text);
  ctx.coErr = r.json.changeOrder;
  const d = await ctx.sub.call(`/api/projects/${ctx.project.id}/changes/${ctx.coErr.id}`);
  assert.equal(d.status, 200);
  assert.equal(d.json.changeOrder.reason, 'scope_revision');
  assert.equal(d.json.changeOrder.costDelta, '1800.00');
  for (const t of [d.text, (await ctx.sub.call(`/api/projects/${ctx.project.id}/changes`)).text, (await ctx.sub.call(`/api/projects/${ctx.project.id}`)).text]) {
    assert.ok(!t.includes('bn_error'), 'bn_error leaked');
    assert.ok(!t.includes('under-measured'), 'internal description leaked');
  }
});

await test('T7 building rep response has no costDelta key at all', async () => {
  for (const path of [`/api/projects/${ctx.project.id}/changes`, `/api/projects/${ctx.project.id}/changes/${ctx.co1.id}`, `/api/projects/${ctx.project.id}`]) {
    const r = await ctx.rep.call(path);
    assert.equal(r.status, 200, `${path} ${r.status}`);
    for (const k of ['costDelta', 'costImpact', 'reason', 'signatureIp']) assert.ok(!r.text.includes(`"${k}"`), `${k} in ${path}`);
  }
  const list = (await ctx.rep.call(`/api/projects/${ctx.project.id}/changes`)).json.changeOrders;
  assert.ok(list.every(c => c.scheduleImpactDays > 0), 'schedule-impacting only');
});

await test('T7 only client and management can reach the sign endpoint', async () => {
  const pending = ctx.co3.id;
  assert.equal((await A.call(`/api/projects/${ctx.project.id}/changes/${pending}/sign`, { method: 'POST', body: { signedName: 'Staff' } })).status, 403);
  assert.equal((await ctx.sub.call(`/api/projects/${ctx.project.id}/changes/${pending}/sign`, { method: 'POST', body: { signedName: 'Sub' } })).status, 403);
  assert.equal((await ctx.rep.call(`/api/projects/${ctx.project.id}/changes/${pending}/sign`, { method: 'POST', body: { signedName: 'Rep' } })).status, 403);
  const outsider = await member('client');
  assert.equal((await outsider.call(`/api/projects/${ctx.project.id}/changes/${pending}/sign`, { method: 'POST', body: { signedName: 'X' } })).status, 404);
  ctx.mgmt = await member('management');
  const inv = await A.call(`/api/projects/${ctx.project.id}/invite`, { method: 'POST', body: { email: ctx.mgmt.email, role: 'management' } });
  assert.equal(inv.status, 200);
  const mine = (await ctx.mgmt.call('/api/invitations')).json.invitations.find(i => i.projectId === ctx.project.id);
  await ctx.mgmt.call(`/api/invitations/${mine.id}/accept`, { method: 'POST' });
  const ok = await ctx.mgmt.call(`/api/projects/${ctx.project.id}/changes/${pending}/sign`, { method: 'POST', body: { signedName: 'Morgan Manager' } });
  assert.equal(ok.status, 200, ok.text);
});

await test('T7 signing records the server-derived IP, not a client-forged one', async () => {
  const r = await ctx.client.call(`/api/projects/${ctx.project.id}/changes/${ctx.coErr.id}/sign`, {
    method: 'POST', body: { signedName: 'Pat Client', signatureIp: '9.9.9.9' },
    headers: { 'x-forwarded-for': '6.6.6.6, 203.0.113.9' } // client forged 6.6.6.6; our ingress appended 203.0.113.9
  });
  assert.equal(r.status, 200, r.text);
  const staffView = (await A.call(`/api/projects/${ctx.project.id}/changes/${ctx.coErr.id}`)).json.changeOrder;
  assert.equal(staffView.signatureIp, '203.0.113.9');
  assert.equal(staffView.signedName, 'Pat Client');
  const clientView = await ctx.client.call(`/api/projects/${ctx.project.id}/changes/${ctx.coErr.id}`);
  assert.equal(clientView.json.changeOrder.costDelta, '0.00', 'bn_error costs the client nothing');
  const { client, db: d } = await db();
  try {
    const ev = await d.collection('project_events').findOne({ kind: 'change_order_signed', 'payload.coId': ctx.coErr.id });
    assert.equal(ev.payload.signatureIp, '203.0.113.9');
  } finally { await client.close(); }
});

finish();
