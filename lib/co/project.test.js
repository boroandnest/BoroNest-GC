import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectChangeOrder } from './project.js';

const CO = {
  id: 'co1', number: 3, title: 'Move panel', description: 'We under-measured the run', reason: 'bn_error', status: 'pending_signature',
  costDelta: '6200.00', againstContingency: false, scheduleImpactDays: 2, affectsPermit: true, signatureIp: '1.2.3.4',
  lines: [{ scopeLineId: 'l1', trade: 'electrical', title: 'Panel', costDelta: '4200.00' }, { scopeLineId: 'l2', trade: 'plumbing', title: 'Re-route', costDelta: '2000.00' }]
};

test('sub sees own trade only, own scope cost, scope_revision — never bn_error', () => {
  const p = projectChangeOrder(CO, { role: 'subcontractor', trades: ['Electrical'] });
  assert.equal(p.reason, 'scope_revision');
  assert.equal(p.costDelta, '4200.00');
  assert.deepEqual(p.lines.map(l => l.trade), ['electrical']);
  assert.ok(!JSON.stringify(p).includes('bn_error'));
  assert.ok(!JSON.stringify(p).includes('under-measured'));
  assert.equal(projectChangeOrder(CO, { role: 'subcontractor', trades: ['hvac'] }), null);
});

test('building rep gets schedule impact only — no cost, no reason keys at all', () => {
  const p = projectChangeOrder(CO, { role: 'building-rep' });
  for (const k of ['costDelta', 'reason', 'reasonText', 'lines', 'description']) assert.ok(!(k in p), k);
  assert.equal(p.scheduleImpactDays, 2);
  assert.equal(projectChangeOrder({ ...CO, scheduleImpactDays: 0 }, { role: 'building-rep' }), null);
});

test('expediter gets permit-affecting COs only, no cost', () => {
  assert.ok(!('costDelta' in projectChangeOrder(CO, { role: 'expediter' })));
  assert.equal(projectChangeOrder({ ...CO, affectsPermit: false }, { role: 'expediter' }), null);
});

test('client sees prose not enum, can sign; bn_error costs them nothing; staff cannot sign', () => {
  const c = projectChangeOrder(CO, { role: 'client' });
  assert.equal(c.canSign, true);
  assert.ok(!('reason' in c));
  assert.match(c.reasonText, /no cost to you/);
  assert.equal(c.costDelta, '0.00');
  assert.ok(!('signatureIp' in c));
  const s = projectChangeOrder(CO, { role: 'bn_staff' });
  assert.equal(s.canSign, false);
  assert.equal(s.reason, 'bn_error');
  assert.equal(s.costDelta, '6200.00');
});

test('unknown roles see nothing', () => {
  assert.equal(projectChangeOrder(CO, { role: 'designer' }), null);
});
