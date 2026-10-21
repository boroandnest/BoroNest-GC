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

// ---------------------------------------------------------------- T8
await test('T8 contingency bar matches the T1 fixture and moves the moment a CO is signed', async () => {
  const V = JSON.parse(readFileSync(new URL('../shared/fixtures/gmp.vectors.json', import.meta.url)));
  const c = V.contingency[0];
  const client = await member('client');
  const sub = await member('subcontractor', { trades: 'tile' });
  await verify(A, sub);
  const rep = await member('building-rep');
  const p = await projectWith(A, { client, gmpCeiling: c.ceiling, contingency: c.contingency, members: [{ m: sub, role: 'subcontractor', scopeTrades: 'tile' }, { m: rep, role: 'building-rep' }] });
  const before = (await client.call(`/api/projects/${p.id}`)).json.financials;
  assert.equal(before.contingencyRemaining, '32000.00');
  assert.equal(before.pctRemaining, '100.00');

  for (const [i, co] of c.signed_cos.entries()) {
    const r = await A.call(`/api/projects/${p.id}/changes`, { method: 'POST', body: { title: `CO ${i}`, reason: 'owner_request', costDelta: co.delta, againstContingency: co.against_contingency } });
    assert.equal(r.status, 201, r.text);
    const s2 = await client.call(`/api/projects/${p.id}/changes/${r.json.changeOrder.id}/sign`, { method: 'POST', body: { signedName: 'Pat Client' } });
    assert.equal(s2.status, 200);
    if (i === 0) assert.equal((await client.call(`/api/projects/${p.id}`)).json.financials.contingencyRemaining, '25800.00', 'bar moves immediately');
  }
  const f = (await client.call(`/api/projects/${p.id}`)).json.financials;
  assert.equal(f.contingencyUsed, c.expect.contingency_used);
  assert.equal(f.contingencyRemaining, c.expect.contingency_remaining);
  assert.equal(f.adjustedCeiling, c.expect.adjusted_ceiling);
  assert.equal(f.pctRemaining, c.expect.pct_remaining);
  assert.equal(f.band, 'forest');
  assert.equal(f.absorbedLosses, undefined);

  for (const m of [sub, rep]) {
    const r = await m.call(`/api/projects/${p.id}`);
    assert.equal(r.status, 200);
    assert.equal(r.json.financials, undefined);
    assert.ok(!/contingency/i.test(r.text), 'no contingency value in props for trade/building roles');
  }
});

// ---------------------------------------------------------------- T9 + P1
const FAIRFIELD = {
  name: `Fairfield Views ${RUN}`, address: '100 Fairfield Ave, Bronx NY', managingAgent: 'Veritas Property Management LLC',
  certHolderName: 'FAIRFIELD VIEWS INC.', certHolderCo: 'C/O VERITAS PROPERTY MANAGEMENT LLC', certHolderAddr: '1 Example Plaza, Bronx NY 10463',
  requiredAiStatic: ['FAIRFIELD VIEWS INC.', 'VERITAS PROPERTY MANAGEMENT LLC'],
  requiredAiTokens: ['{resident_name}, Apt {unit}', '{resident_phone}'],
  coiLeadDays: 4, coiLeadIsBusinessDays: true, coiRecipients: ['coi@veritas.example'],
  requiredGl: '1000000', requiresWc: true, requiredAuto: '1000000', requiredEl: '500000'
};
const AI_OK = ['FAIRFIELD VIEWS INC.', 'VERITAS PROPERTY MANAGEMENT LLC', 'Ana Ruiz, Apt 4C', '718-555-0142'];

async function submitCoi(m, projectId, fields = {}) {
  const f = new FormData();
  f.append('file', new Blob(['%PDF-1.4 acord 25'], { type: 'application/pdf' }), 'acord.pdf');
  const all = { glLimit: '2000000', wcPresent: 'true', autoLimit: '1000000', elLimit: '500000', additionalInsured: AI_OK.join('\n'), certHolderText: 'FAIRFIELD VIEWS INC. C/O VERITAS PROPERTY MANAGEMENT LLC', effectiveOn: '2026-01-01', expiresOn: '2027-12-31', ...fields };
  for (const [k, v] of Object.entries(all)) if (v !== undefined) f.append(k, v);
  const r = await m.call(`/api/projects/${projectId}/cois`, { method: 'POST', body: f });
  assert.equal(r.status, 201, r.text);
  return r.json.coi;
}
const verifyCoi = (id, corrections) => A.call(`/api/admin/cois/${id}/verify`, { method: 'POST', body: { status: 'verified', corrections } });

await test('T9/P1 per-unit additional insured resolves at project creation; missing resident name is refused', async () => {
  const b = await A.call('/api/buildings', { method: 'POST', body: FAIRFIELD });
  assert.equal(b.status, 201, b.text);
  ctx.building = b.json.building;
  const bad = await A.call('/api/projects', { method: 'POST', body: { name: 'x', address: 'y', buildingId: ctx.building.id, unit: { unit: '4C', resident_phone: '718-555-0142' } } });
  assert.equal(bad.status, 422);
  assert.match(bad.json.error, /resident name/);

  ctx.coiClient = await member('client');
  ctx.coiSub = await member('subcontractor', { trades: 'Plumbing', licenses: 'LIC-778899 exp 2027' });
  await verify(A, ctx.coiSub);
  ctx.coiRep = await member('building-rep');
  const r = await A.call('/api/projects', { method: 'POST', body: { name: `Apt 4C ${RUN}`, address: '100 Fairfield Ave 4C', clientEmail: ctx.coiClient.email, gmpCeiling: 60000, buildingId: ctx.building.id, unit: { unit: '4C', resident_name: 'Ana Ruiz', resident_phone: '718-555-0142' } } });
  assert.equal(r.status, 200, r.text);
  ctx.coiProject = r.json.project;
  for (const [m, role, scopeTrades] of [[ctx.coiSub, 'subcontractor', 'plumbing'], [ctx.coiRep, 'building-rep']]) {
    await A.call(`/api/projects/${ctx.coiProject.id}/invite`, { method: 'POST', body: { email: m.email, role, scopeTrades } });
    const inv = (await m.call('/api/invitations')).json.invitations.find(i => i.projectId === ctx.coiProject.id);
    await m.call(`/api/invitations/${inv.id}/accept`, { method: 'POST' });
  }
  const req = (await ctx.coiSub.call(`/api/projects/${ctx.coiProject.id}/cois`)).json.requirements;
  assert.deepEqual(req.additionalInsured, AI_OK);
  assert.deepEqual(req.certificateHolder, { name: 'FAIRFIELD VIEWS INC.', careOf: 'C/O VERITAS PROPERTY MANAGEMENT LLC', address: '1 Example Plaza, Bronx NY 10463' });
  assert.ok(!req.additionalInsured.includes(req.certificateHolder.careOf), 'holder is separate from AI');
  await A.call(`/api/projects/${ctx.coiProject.id}/scope`, { method: 'POST', body: { trade: 'plumbing', title: 'Replace riser', quantity: '1', unitCost: '3400' } });
  ctx.coiLine = (await A.call(`/api/projects/${ctx.coiProject.id}/scope`)).json.lines[0];
});

const assign = () => A.call(`/api/projects/${ctx.coiProject.id}/scope/${ctx.coiLine.id}/assign`, { method: 'POST', body: { subUserId: ctx.coiSub.user.id } });
async function setStart(date) {
  const { client, db: d } = await db();
  try { await d.collection('scope_lines').updateOne({ id: ctx.coiLine.id }, { $set: { plannedStart: date } }); } finally { await client.close(); }
}
const { addBusinessDays, today } = await import('../lib/dates.js');

await test('T9 assigning a sub with no COI is refused', async () => {
  const r = await assign();
  assert.equal(r.status, 409, r.text);
  assert.equal(r.json.code, 'coi_required');
  assert.deepEqual(r.json.reasons, ['no_coi']);
});

await test('T9 a COI missing one required AI entity fails compliance', async () => {
  await setStart(addBusinessDays(today(), 10));
  const c = await submitCoi(ctx.coiSub, ctx.coiProject.id, { additionalInsured: AI_OK.filter(x => !x.includes('Ruiz')).join('\n') });
  assert.equal((await assign()).json.reasons.includes('not_verified'), true, 'unverified does not count');
  assert.equal((await verifyCoi(c.id)).status, 200);
  const r = await assign();
  assert.equal(r.status, 409);
  assert.deepEqual(r.json.reasons, ['additional_insured_missing']);
  assert.deepEqual(r.json.missingAi, ['Ana Ruiz, Apt 4C']);
});

await test('T9 a COI expiring yesterday fails', async () => {
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const c = await submitCoi(ctx.coiSub, ctx.coiProject.id, { expiresOn: yesterday });
  await verifyCoi(c.id);
  const r = await assign();
  assert.equal(r.status, 409);
  assert.ok(r.json.reasons.includes('expired') || r.json.reasons.includes('additional_insured_missing'));
  const staff = (await A.call(`/api/projects/${ctx.coiProject.id}/cois`)).json.cois.find(x => x.id === c.id);
  assert.ok(staff.compliance.reasons.includes('expired'));
});

await test('T9/P1 auto and employer\'s liability are checked when required', async () => {
  const c = await submitCoi(ctx.coiSub, ctx.coiProject.id, { autoLimit: '250000', elLimit: '100000' });
  await verifyCoi(c.id);
  const staff = (await A.call(`/api/projects/${ctx.coiProject.id}/cois`)).json.cois.find(x => x.id === c.id);
  assert.deepEqual(staff.compliance.reasons.sort(), ['auto_limit_below_requirement', 'employers_liability_below_requirement']);
});

await test('P1 lead time: submitted 3 business days before work fails, 4 passes', async () => {
  const c = await submitCoi(ctx.coiSub, ctx.coiProject.id);
  await verifyCoi(c.id);
  await setStart(addBusinessDays(today(), 3));
  const late = await assign();
  assert.equal(late.status, 409, late.text);
  assert.ok(late.json.reasons.includes('submitted_too_late'));
  await setStart(addBusinessDays(today(), 4));
  const ok = await assign();
  assert.equal(ok.status, 200, ok.text);
  assert.equal(ok.json.assignedCoiId, c.id);
  ctx.goodCoi = c;
});

await test('T9 MongoDB rejects an assignment written without a COI reference', async () => {
  const { client, db: d } = await db();
  try {
    await assert.rejects(d.collection('scope_lines').updateOne({ id: ctx.coiLine.id }, { $set: { assignedSub: 'someone' }, $unset: { assignedCoiId: '' } }), (e) => e.code === 121);
  } finally { await client.close(); }
});

await test('T9 trade licence numbers never reach non-staff', async () => {
  for (const m of [ctx.coiClient, ctx.coiRep]) {
    for (const p of [`/api/projects/${ctx.coiProject.id}`, `/api/projects/${ctx.coiProject.id}/cois`, `/api/projects/${ctx.coiProject.id}/parties`]) {
      const r = await m.call(p);
      assert.equal(r.status, 200, `${p} ${r.status}`);
      assert.ok(!r.text.includes('LIC-778899'), `licence leaked at ${p}`);
      assert.ok(!r.text.includes('glLimit'), `limits leaked at ${p}`);
    }
  }
  const chips = (await ctx.coiClient.call(`/api/projects/${ctx.coiProject.id}/cois`)).json.chips;
  assert.equal(chips.length, 1);
});

await test('T9 COI files are not reachable without a signed URL', async () => {
  const { client, db: d } = await db();
  let file;
  try { file = await d.collection('files').findOne({ id: (await d.collection('cois').findOne({ id: ctx.goodCoi.id })).fileId }); } finally { await client.close(); }
  for (const m of [ctx.coiSub, A, ctx.coiClient]) assert.equal((await m.call(`/api/files/${file.id}`)).status, 403, 'generic file route refuses private kinds');
  assert.equal((await ctx.coiClient.call(`/api/projects/${ctx.coiProject.id}/cois/${ctx.goodCoi.id}/file`)).status, 404);
  const signed = await ctx.coiSub.call(`/api/projects/${ctx.coiProject.id}/cois/${ctx.goodCoi.id}/file`);
  assert.equal(signed.status, 200);
  const anon = await fetch(new URL(signed.json.url, 'http://localhost:3100'));
  assert.equal(anon.status, 200, 'signed URL works without a session');
  assert.equal(await anon.text(), '%PDF-1.4 acord 25');
  const u = new URL(signed.json.url, 'http://localhost:3100'); u.searchParams.delete('sig');
  assert.equal((await fetch(u)).status, 403);
  const t = new URL(signed.json.url, 'http://localhost:3100'); t.searchParams.set('exp', '1');
  assert.equal((await fetch(t)).status, 403);
});

// ---------------------------------------------------------------- T10
await test('T10 sweep: correct tier at exactly 30 and 7 days; twice in one day sends one set', async () => {
  const { client, db: d } = await db();
  try {
    const plus = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
    const c30 = await submitCoi(ctx.coiSub, ctx.coiProject.id); await verifyCoi(c30.id);
    const c7 = await submitCoi(ctx.coiSub, ctx.coiProject.id); await verifyCoi(c7.id);
    // superseding logic would skip these (a later cert exists), so pin the far-dated good COI out of the way
    await d.collection('cois').updateMany({ projectId: ctx.coiProject.id, id: { $nin: [c30.id, c7.id] } }, { $set: { status: 'rejected' }, $unset: { verifiedAt: '', verifiedBy: '' } });
    await d.collection('cois').updateOne({ id: c30.id }, { $set: { expiresOn: plus(30) } });
    await d.collection('cois').updateOne({ id: c7.id }, { $set: { expiresOn: plus(7) } });
    ctx.c7 = c7;

    const unauth = await fetch('http://localhost:3100/api/cron/coi-sweep', { method: 'POST' });
    assert.equal(unauth.status, 401);
    const run = () => fetch('http://localhost:3100/api/cron/coi-sweep', { method: 'POST', headers: { authorization: 'Bearer test-cron-secret' } }).then(r => r.json());
    const first = await run();
    assert.equal(first.ok, true);
    const n30 = await d.collection('coi_notices').findOne({ coiId: c30.id });
    const n7 = await d.collection('coi_notices').findOne({ coiId: c7.id });
    assert.equal(n30.tier, 'day30', '30 days out -> day30');
    // c7 is superseded by c30 (later expiry) for notices; un-supersede it to check the 7-day tier
    await d.collection('cois').updateOne({ id: c30.id }, { $set: { status: 'rejected' }, $unset: { verifiedAt: '', verifiedBy: '' } });
    await run();
    const n7b = await d.collection('coi_notices').findOne({ coiId: c7.id });
    assert.equal(n7 ? n7.tier : n7b.tier, 'day7', '7 days out -> day7');
    const before = await d.collection('coi_notices').countDocuments({});
    const again = await run();
    assert.equal(await d.collection('coi_notices').countDocuments({}), before, 'second run same day sends nothing new');
    assert.equal(again.summary.notices, 0);
    assert.ok(await d.collection('project_events').findOne({ kind: 'coi_expiry_notice', 'payload.coiId': c7.id }));
  } finally { await client.close(); }
});

await test('T10 expired COI unassigns a future-dated line and only flags an in-progress one', async () => {
  const { client, db: d } = await db();
  try {
    const plus = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
    // two lines assigned on the strength of c7
    await A.call(`/api/projects/${ctx.coiProject.id}/scope`, { method: 'POST', body: { trade: 'plumbing', title: 'Fixture set', quantity: '1', unitCost: '900' } });
    const lines = (await A.call(`/api/projects/${ctx.coiProject.id}/scope`)).json.lines;
    const future = lines.find(l => l.title === 'Fixture set');
    const current = lines.find(l => l.id === ctx.coiLine.id);
    await d.collection('cois').updateOne({ id: ctx.c7.id }, { $set: { submittedAt: new Date(Date.now() - 30 * 86400000) } });
    await d.collection('scope_lines').updateOne({ id: future.id }, { $set: { plannedStart: plus(20) } });
    await d.collection('scope_lines').updateOne({ id: current.id }, { $set: { plannedStart: plus(20) } });
    for (const l of [future, current]) {
      const r = await A.call(`/api/projects/${ctx.coiProject.id}/scope/${l.id}/assign`, { method: 'POST', body: { subUserId: ctx.coiSub.user.id } });
      assert.equal(r.status, 200, r.text);
      assert.equal(r.json.assignedCoiId, ctx.c7.id);
    }
    await d.collection('scope_lines').updateOne({ id: current.id }, { $set: { status: 'in_progress', plannedStart: plus(-3) } });
    await d.collection('cois').updateOne({ id: ctx.c7.id }, { $set: { expiresOn: plus(-1) } });

    const r = await fetch('http://localhost:3100/api/cron/coi-sweep', { method: 'POST', headers: { authorization: 'Bearer test-cron-secret' } }).then(x => x.json());
    assert.equal(r.summary.unassigned, 1);
    assert.equal(r.summary.flagged, 1);
    const f = await d.collection('scope_lines').findOne({ id: future.id });
    assert.equal(f.assignedSub, null);
    assert.equal(f.unassignedReason, 'coi_expired');
    const c = await d.collection('scope_lines').findOne({ id: current.id });
    assert.equal(c.assignedSub, ctx.coiSub.user.id, 'in-progress work is not reverted');
    assert.equal(c.status, 'in_progress');
    assert.equal(c.coiLapsed, true);
    assert.ok(await d.collection('project_events').findOne({ kind: 'coi_lapsed_unassigned', 'payload.lineId': future.id }));
    assert.ok(await d.collection('project_events').findOne({ kind: 'coi_lapsed_in_progress', 'payload.lineId': current.id }));
  } finally { await client.close(); }
});

// ---------------------------------------------------------------- T11
const Stripe = (await import('stripe')).default;
const WHSEC = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret';
async function webhook(event, { sign = true, secret = WHSEC } = {}) {
  const payload = JSON.stringify(event);
  const headers = { 'content-type': 'application/json' };
  if (sign) headers['stripe-signature'] = Stripe.webhooks.generateTestHeaderString({ payload, secret });
  const r = await fetch('http://localhost:3100/api/stripe/webhook', { method: 'POST', headers, body: payload });
  return { status: r.status, json: await r.json().catch(() => null) };
}

await test('T11 unsigned or mis-signed webhook POSTs are rejected with 400', async () => {
  const ev = { id: `evt_${RUN}_x`, type: 'account.updated', data: { object: { id: 'acct_x', payouts_enabled: true } } };
  assert.equal((await webhook(ev, { sign: false })).status, 400);
  assert.equal((await webhook(ev, { secret: 'whsec_wrong' })).status, 400);
});

await test('T11 signed account.updated syncs payouts_enabled; nothing bank/tax is stored', async () => {
  const { client, db: d } = await db();
  try {
    const acct = `acct_${RUN}`;
    await d.collection('users').updateOne({ id: ctx.sub.user.id }, { $set: { payouts: { stripeAccountId: acct, payoutsEnabled: false } } });
    const ev = { id: `evt_${RUN}_1`, type: 'account.updated', livemode: false, data: { object: {
      id: acct, object: 'account', payouts_enabled: true, details_submitted: true, charges_enabled: false,
      external_accounts: { data: [{ object: 'bank_account', routing_number: '110000000', last4: '6789', account_holder_name: 'Sub Co' }] },
      individual: { ssn_last_4_provided: true, id_number_provided: true, first_name: 'Pat' }, business_profile: { name: 'Sub Co' }
    } } };
    const r = await webhook(ev);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    const st = await ctx.sub.call('/api/stripe/onboard');
    assert.equal(st.json.payoutsEnabled, true);
    assert.equal((await webhook(ev)).json.duplicate, true, 'retries are idempotent');
    assert.equal(await d.collection('payment_events').countDocuments({ eventId: ev.id }), 1);

    const tr = { id: `evt_${RUN}_2`, type: 'transfer.created', account: undefined, data: { object: { id: 'tr_1', object: 'transfer', amount: 620000, currency: 'usd', destination: acct, metadata: { milestoneId: 'ms-x', projectId: 'p-x' }, destination_payment: 'py_1' } } };
    assert.equal((await webhook(tr)).status, 200);
    const row = await d.collection('payment_events').findOne({ eventId: tr.id });
    assert.equal(row.amount.toString(), '6200.00');
    const all = JSON.stringify(await d.collection('payment_events').find({}).toArray()) + JSON.stringify(await d.collection('users').find({}).toArray());
    for (const needle of ['110000000', '6789', 'routing', 'ssn', 'Pat', 'bank_account', 'external_accounts']) assert.ok(!all.includes(needle), `${needle} stored`);
  } finally { await client.close(); }
});

await test('T11 onboarding is payee-only; without STRIPE_SECRET_KEY it reports not configured', async () => {
  assert.equal((await ctx.client.call('/api/stripe/onboard', { method: 'POST' })).status, 403);
  const r = await ctx.sub.call('/api/stripe/onboard', { method: 'POST' });
  if (process.env.STRIPE_SECRET_KEY) assert.equal(r.status, 200); else assert.equal(r.status, 503);
});

await test('T11 STRIPE_SECRET_KEY / secret key material is absent from the client bundle', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const root = new URL('../.next/static', import.meta.url).pathname;
  assert.ok(fs.existsSync(root), 'build first');
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) { stack.push(full); continue; }
      const text = fs.readFileSync(full, 'utf8');
      for (const needle of ['STRIPE_SECRET', 'STRIPE_WEBHOOK_SECRET', 'sk_live_', 'sk_test_', 'whsec_']) assert.ok(!text.includes(needle), `${needle} in ${full}`);
    }
  }
});

// ---------------------------------------------------------------- T12
// The release job runs in-process against the same database with a Stripe double that behaves like
// Stripe: the same idempotency key always returns the same transfer.
let fakeTransferSeq = 0;
function fakeStripe() {
  const byKey = new Map();
  const f = { calls: 0, transfers: byKey, transfers_api: null };
  f.transfers = { create: async (params, opts) => {
    f.calls++;
    await new Promise(r => setTimeout(r, 20));
    if (!opts?.idempotencyKey) throw new Error('missing idempotency key');
    if (!byKey.has(opts.idempotencyKey)) byKey.set(opts.idempotencyKey, { id: `tr_${++fakeTransferSeq}_${RUN}`, ...params });
    return byKey.get(opts.idempotencyKey);
  } };
  f.byKey = byKey;
  return f;
}

await test('T12 verify opens a 24h window; a sub sees only their own milestones, a client sees all', async () => {
  const { client, db: d } = await db();
  try {
    await d.collection('users').updateOne({ id: ctx.sub.user.id }, { $set: { payouts: { stripeAccountId: `acct_${RUN}`, payoutsEnabled: true } } });
  } finally { await client.close(); }
  ctx.sub2 = await member('subcontractor', { trades: 'hvac' });
  await verify(A, ctx.sub2);
  const inv = await A.call(`/api/projects/${ctx.project.id}/invite`, { method: 'POST', body: { email: ctx.sub2.email, role: 'subcontractor', scopeTrades: 'hvac' } });
  assert.equal(inv.status, 200);
  const mine = (await ctx.sub2.call('/api/invitations')).json.invitations.find(i => i.projectId === ctx.project.id);
  await ctx.sub2.call(`/api/invitations/${mine.id}/accept`, { method: 'POST' });

  const mk = (title, amount, payeeId) => A.call(`/api/projects/${ctx.project.id}/milestones`, { method: 'POST', body: { title, amount, payeeId, trigger: 'Inspection passed' } });
  ctx.msA = (await mk('Electrical rough-in passed', '6200.00', ctx.sub.user.id)).json.milestone;
  ctx.msB = (await mk('Electrical trim-out', '4100.50', ctx.sub.user.id)).json.milestone;
  ctx.msC = (await mk('HVAC set', '9800.00', ctx.sub2.user.id)).json.milestone;
  ctx.msD = (await mk('No payouts', '100.00', ctx.sub2.user.id)).json.milestone;
  assert.ok(ctx.msA && ctx.msC, 'created');

  const v = await A.call(`/api/projects/${ctx.project.id}/milestones/${ctx.msA.id}/verify`, { method: 'POST', body: {} });
  assert.equal(v.status, 200, v.text);
  const eta = new Date(v.json.milestone.releaseEta).getTime() - new Date(v.json.milestone.verifiedAt).getTime();
  assert.equal(eta, 24 * 3600000);
  assert.equal(v.json.milestone.releaseStatus, 'in_window');

  const subView = (await ctx.sub.call(`/api/projects/${ctx.project.id}/milestones`)).json.milestones;
  assert.deepEqual(subView.map(m => m.id).sort(), [ctx.msA.id, ctx.msB.id].sort(), 'sub sees only own');
  const sub2View = (await ctx.sub2.call(`/api/projects/${ctx.project.id}`)).json.milestones;
  assert.ok(sub2View.every(m => [ctx.msC.id, ctx.msD.id].includes(m.id)));
  const clientView = (await ctx.client.call(`/api/projects/${ctx.project.id}/milestones`)).json.milestones;
  for (const m of [ctx.msA, ctx.msB, ctx.msC]) assert.ok(clientView.some(x => x.id === m.id), 'client sees all');
  const repView = await ctx.rep.call(`/api/projects/${ctx.project.id}/milestones`);
  assert.ok(!repView.text.includes('"amount"') && !repView.text.includes('6200'), 'building rep sees no money');
});

await test('T12 run the release job twice (and concurrently) against a due milestone — exactly one transfer', async () => {
  const { client, db: d } = await db();
  try {
    await d.collection('milestones').updateOne({ id: ctx.msA.id }, { $set: { releaseEta: new Date(Date.now() - 60000) } });
    const { releaseDueMilestones } = await import('../lib/payments/release.js');
    const stripe = fakeStripe();
    const [r1, r2] = await Promise.all([releaseDueMilestones({ stripe }), releaseDueMilestones({ stripe })]);
    const r3 = await releaseDueMilestones({ stripe });
    assert.equal(r1.released + r2.released + r3.released, 1);
    assert.equal(stripe.calls, 1, 'Stripe called once');
    assert.deepEqual([...stripe.byKey.keys()], [`ms_${ctx.msA.id}`]);
    const m = await d.collection('milestones').findOne({ id: ctx.msA.id });
    assert.equal(m.releaseStatus, 'released');
    assert.match(m.stripeTransferId, /^tr_\d+_/);
    assert.equal([...stripe.byKey.values()][0].amount, 620000, 'exact cents');

    // crash-after-Stripe simulation: forget the recorded transfer, re-run — Stripe returns the same one
    await d.collection('milestones').updateOne({ id: ctx.msA.id }, { $set: { releaseStatus: 'in_window' }, $unset: { stripeTransferId: '' } });
    await releaseDueMilestones({ stripe });
    assert.equal(stripe.byKey.size, 1, 'idempotency key prevented a second transfer');
    assert.equal((await d.collection('milestones').findOne({ id: ctx.msA.id })).stripeTransferId, m.stripeTransferId);
    await assert.rejects(d.collection('milestones').updateOne({ id: ctx.msB.id }, { $set: { releaseStatus: 'released' } }), (e) => e.code === 121, 'released without transfer id is impossible');
  } finally { await client.close(); }
});

await test('T12 a dispute inside the window prevents release; resolving lets the next run release', async () => {
  const { client, db: d } = await db();
  try {
    const { releaseDueMilestones } = await import('../lib/payments/release.js');
    await A.call(`/api/projects/${ctx.project.id}/milestones/${ctx.msB.id}/verify`, { method: 'POST', body: {} });
    assert.equal((await ctx.sub.call(`/api/projects/${ctx.project.id}/milestones/${ctx.msB.id}/dispute`, { method: 'POST', body: { reason: 'x' } })).status, 403, 'only client disputes');
    const disp = await ctx.client.call(`/api/projects/${ctx.project.id}/milestones/${ctx.msB.id}/dispute`, { method: 'POST', body: { reason: 'Trim not finished in bathroom' } });
    assert.equal(disp.status, 200, disp.text);
    await d.collection('milestones').updateOne({ id: ctx.msB.id }, { $set: { releaseEta: new Date(Date.now() - 60000) } });
    const stripe = fakeStripe();
    assert.equal((await releaseDueMilestones({ stripe })).released, 0);
    assert.equal(stripe.calls, 0);
    assert.equal((await ctx.client.call(`/api/projects/${ctx.project.id}/milestones/${ctx.msB.id}/dispute`, { method: 'POST', body: {} })).status, 409, 'outside window');
    assert.equal((await A.call(`/api/projects/${ctx.project.id}/milestones/${ctx.msB.id}/resolve`, { method: 'POST', body: { note: 'Finished' } })).status, 200);
    const r = await releaseDueMilestones({ stripe });
    assert.equal(r.released, 1);
    assert.equal([...stripe.byKey.values()][0].amount, 410050);
  } finally { await client.close(); }
});

await test('T12 payouts_enabled=false -> logged failure + alert, no blind retry', async () => {
  const { client, db: d } = await db();
  try {
    const { releaseDueMilestones } = await import('../lib/payments/release.js');
    await A.call(`/api/projects/${ctx.project.id}/milestones/${ctx.msD.id}/verify`, { method: 'POST', body: {} });
    await d.collection('milestones').updateOne({ id: ctx.msD.id }, { $set: { releaseEta: new Date(Date.now() - 60000) } });
    const alerts = [];
    const stripe = fakeStripe();
    const r = await releaseDueMilestones({ stripe, notify: async (x) => alerts.push(x) });
    assert.equal(r.failed, 1);
    assert.equal(stripe.calls, 0);
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].reason, 'payouts_not_enabled');
    const m = await d.collection('milestones').findOne({ id: ctx.msD.id });
    assert.equal(m.releaseStatus, 'transfer_failed');
    assert.ok(await d.collection('payment_events').findOne({ type: 'transfer_failed', milestoneId: ctx.msD.id }));
    assert.ok(await d.collection('project_events').findOne({ kind: 'transfer_failed', 'payload.milestoneId': ctx.msD.id }));
    const again = await releaseDueMilestones({ stripe, notify: async (x) => alerts.push(x) });
    assert.equal(again.due, 0, 'not retried automatically');
    assert.equal(alerts.length, 1);
    assert.equal((await A.call(`/api/projects/${ctx.project.id}/milestones/${ctx.msD.id}/retry`, { method: 'POST' })).status, 200, 'staff can re-queue');
  } finally { await client.close(); }
});

// ---------------------------------------------------------------- T13
await test('T13 migration applied; confidence outside 0–1 rejected by MongoDB; non-staff get no rows', async () => {
  const { client, db: d } = await db();
  try {
    assert.ok(await d.collection('_migrations').findOne({ _id: '007_ai_predictions', finishedAt: { $type: 'date' } }));
    const base = { agent: 'risk', taskType: 'schedule_slip', projectId: null, prediction: { slipDays: 3 }, envelope: { rationale: 'x' }, createdAt: new Date() };
    for (const bad of [1.2, -0.01]) await assert.rejects(d.collection('ai_predictions').insertOne({ id: `p-${RUN}-${bad}`, ...base, confidence: bad }), (e) => e.code === 121);
    await d.collection('ai_predictions').insertOne({ id: `p-${RUN}-ok`, ...base, confidence: 0.72 });
  } finally { await client.close(); }
  assert.equal((await A.call('/api/admin/ai-predictions', { method: 'POST', body: { agent: 'risk', taskType: 't', prediction: {}, envelope: { rationale: 'r' }, confidence: '1.5' } })).status, 422);
  assert.equal((await A.call('/api/admin/ai-predictions', { method: 'POST', body: { agent: 'risk', taskType: 't', prediction: {}, envelope: { rationale: 'r' }, confidence: '0.65' } })).status, 201);
  for (const m of [ctx.client, ctx.sub, ctx.rep]) {
    const r = await m.call('/api/admin/ai-predictions');
    assert.equal(r.status, 403);
    assert.ok(!r.text.includes('prediction'));
  }
  assert.ok((await A.call('/api/admin/ai-predictions')).json.predictions.length >= 2);
});

// ---------------------------------------------------------------- T16 (P3)
await test('T16 79 open violations across 18 units -> 4.39 over_threshold; client sees it, sub sees none', async () => {
  const r = await A.call(`/api/buildings/${ctx.building.id}`, { method: 'PUT', body: { unitCount: 18, unitCountVerified: true, unitCountSource: 'HPD registration' } });
  assert.equal(r.status, 200, r.text);
  const rows = Array.from({ length: 79 }, (_, i) => ({ hpdId: `HPD-${RUN}-${i}`, class: i % 4 === 0 ? 'C' : 'B', unit: `${1 + (i % 18)}A`, description: 'Peeling paint', issuedOn: '2026-06-01' }));
  const imp = await A.call(`/api/buildings/${ctx.building.id}/violations`, { method: 'POST', body: rows });
  assert.equal(imp.status, 201, imp.text);
  assert.equal(imp.json.inserted, 79);
  assert.equal((await A.call(`/api/buildings/${ctx.building.id}/violations`, { method: 'POST', body: rows.slice(0, 3) })).json.skipped, 3, 're-import is idempotent');

  const c = await ctx.coiClient.call(`/api/projects/${ctx.coiProject.id}/compliance`);
  assert.equal(c.status, 200, c.text);
  assert.equal(c.json.density.density, '4.39');
  assert.equal(c.json.density.aepStatus, 'over_threshold');
  assert.equal((await ctx.coiClient.call(`/api/buildings/${ctx.building.id}/violations`)).status, 200);
  for (const path of [`/api/projects/${ctx.coiProject.id}/compliance`, `/api/buildings/${ctx.building.id}/violations`]) {
    const s2 = await ctx.coiSub.call(path);
    assert.equal(s2.status, 404, `${path} ${s2.status}`);
    assert.ok(!s2.text.includes('density'));
  }
  const subProject = await ctx.coiSub.call(`/api/projects/${ctx.coiProject.id}`);
  assert.ok(!subProject.text.includes('Ana Ruiz') && !subProject.text.includes('718-555'), 'resident PII not sent to subs');
});

await test('T16 work complete does not change density; only agency closure does; awaiting_closure counts the gap', async () => {
  const reg = (await A.call(`/api/buildings/${ctx.building.id}/violations`)).json;
  const five = reg.violations.slice(0, 5);
  for (const v of five) {
    for (const step of ['workCompletedAt', 'certifiedFiledAt']) assert.equal((await A.call(`/api/buildings/${ctx.building.id}/violations/${v.id}`, { method: 'PATCH', body: { step } })).status, 200);
  }
  assert.equal((await ctx.coiClient.call(`/api/buildings/${ctx.building.id}/violations/${five[0].id}`, { method: 'PATCH', body: { step: 'clientAcceptedAt' } })).status, 200, 'client records acceptance');
  assert.equal((await ctx.coiClient.call(`/api/buildings/${ctx.building.id}/violations/${five[0].id}`, { method: 'PATCH', body: { step: 'agencyClosedAt' } })).status, 403, 'client cannot close');
  let d = (await ctx.coiClient.call(`/api/projects/${ctx.coiProject.id}/compliance`)).json.density;
  assert.equal(d.density, '4.39', 'unchanged by finished work');
  assert.equal(d.awaitingClosure, 5);
  for (const v of five.slice(0, 2)) await A.call(`/api/buildings/${ctx.building.id}/violations/${v.id}`, { method: 'PATCH', body: { step: 'agencyClosedAt' } });
  d = (await ctx.coiClient.call(`/api/projects/${ctx.coiProject.id}/compliance`)).json.density;
  assert.equal(d.openViolations, 77);
  assert.equal(d.density, '4.28');
  assert.equal(d.awaitingClosure, 3);
});

await test('T16 null unit_count returns unknown, never a computed density', async () => {
  await A.call(`/api/buildings/${ctx.building.id}`, { method: 'PUT', body: { unitCount: '' } });
  const d = (await ctx.coiClient.call(`/api/projects/${ctx.coiProject.id}/compliance`)).json.density;
  assert.equal(d.aepStatus, 'unknown');
  assert.equal(d.density, null);
  await A.call(`/api/buildings/${ctx.building.id}`, { method: 'PUT', body: { unitCount: 18, unitCountVerified: true } });
});

finish();
