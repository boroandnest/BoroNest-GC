import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeVariance, varianceFor } from './variance.js';

const TODAY = '2026-10-22';
const quote = (over = {}) => ({ id: 'q1', projectId: 'p1', amount: '200000.00', durationDays: 90, quotedAt: '2026-06-01', quotedBy: 'u1', ...over });
const co = (over = {}) => ({ id: 'c', projectId: 'p1', status: 'signed', reason: 'owner_request', costDelta: '0.00', againstContingency: false, ...over });

test('no quote on file yields nothing rather than a zero baseline', () => {
  assert.equal(computeVariance({ quote: null, project: { actualSpend: '10.00' }, today: TODAY }), null);
});

test('spend under the quote is good news, not an alert', () => {
  const v = computeVariance({ quote: quote(), project: { actualSpend: '188000.00' }, today: TODAY });
  assert.equal(v.vsRevised.delta, '-12000.00');
  assert.equal(v.vsRevised.abs, '12000.00');
  assert.equal(v.vsRevised.intent, 'good', 'under budget must never read as a problem');
  assert.equal(v.vsRevised.direction, 'down');
  assert.equal(v.vsRevised.over, false);
  assert.equal(v.vsRevised.pct, '-6.00');
});

test('spend over the revised baseline is bad news', () => {
  const v = computeVariance({ quote: quote(), project: { actualSpend: '215000.00' }, today: TODAY });
  assert.equal(v.vsRevised.delta, '15000.00');
  assert.equal(v.vsRevised.intent, 'bad');
  assert.equal(v.vsRevised.over, true);
});

test('a signed owner change order moves the baseline, so it is not an overrun', () => {
  const v = computeVariance({
    quote: quote(),
    changeOrders: [co({ costDelta: '20000.00', reason: 'owner_request' })],
    project: { actualSpend: '215000.00' },
    today: TODAY
  });
  assert.equal(v.ceilingAdjustments, '20000.00');
  assert.equal(v.vsRevised.baseline, '220000.00');
  assert.equal(v.vsRevised.intent, 'good', 'agreed extra work is not an overrun');
  // against the original quote we are still $15k above the desk number
  assert.equal(v.vsQuote.delta, '15000.00');
  assert.equal(v.vsQuote.intent, 'bad');
});

test('a change order drawn against contingency does not move the baseline', () => {
  const v = computeVariance({
    quote: quote(),
    changeOrders: [co({ costDelta: '20000.00', againstContingency: true })],
    project: { actualSpend: '215000.00' },
    today: TODAY
  });
  assert.equal(v.ceilingAdjustments, '0.00', 'the reserve was already inside the quote');
  assert.equal(v.vsRevised.baseline, '200000.00');
  assert.equal(v.vsRevised.intent, 'bad');
});

test('a bn_error change order is absorbed and reaches neither variance', () => {
  const v = computeVariance({
    quote: quote(),
    changeOrders: [co({ costDelta: '18000.00', reason: 'bn_error' })],
    project: { actualSpend: '200000.00' },
    today: TODAY
  });
  assert.equal(v.absorbedLosses, '18000.00');
  assert.equal(v.ceilingAdjustments, '0.00');
  assert.equal(v.vsRevised.baseline, '200000.00');
  assert.equal(v.vsRevised.delta, '0.00');
  assert.equal(v.vsRevised.intent, 'flat');
  assert.equal(v.signedCount, 0, 'our own correction is not a client change order');
});

test('an unsigned change order changes nothing', () => {
  const v = computeVariance({
    quote: quote(),
    changeOrders: [co({ status: 'pending_signature', costDelta: '50000.00' })],
    project: { actualSpend: '200000.00' },
    today: TODAY
  });
  assert.equal(v.vsRevised.baseline, '200000.00');
  assert.equal(v.ceilingAdjustments, '0.00');
});

test('money stays exact through the baseline arithmetic', () => {
  const v = computeVariance({
    quote: quote({ amount: '100000.10' }),
    changeOrders: [co({ costDelta: '0.20' })],
    project: { actualSpend: '100000.30' },
    today: TODAY
  });
  assert.equal(v.vsRevised.baseline, '100000.30');
  assert.equal(v.vsRevised.delta, '0.00', 'no float drift');
  assert.equal(v.vsRevised.intent, 'flat');
});

// --- schedule ---------------------------------------------------------------

test('no start date means the schedule is unknown, never zero', () => {
  const v = computeVariance({ quote: quote(), project: { actualSpend: '0' }, today: TODAY });
  assert.equal(v.schedule.known, false);
  assert.equal(v.schedule.reason, 'no_start_date');
  assert.equal(v.schedule.deltaDays, undefined);
});

test('no quoted duration means the schedule is unknown', () => {
  const v = computeVariance({ quote: quote({ durationDays: null }), project: { startedAt: '2026-07-01' }, today: TODAY });
  assert.equal(v.schedule.known, false);
  assert.equal(v.schedule.reason, 'no_duration_quoted');
});

test('running long is bad; finishing early is good', () => {
  const late = computeVariance({ quote: quote(), project: { startedAt: '2026-06-15', actualSpend: '0' }, today: TODAY });
  assert.equal(late.schedule.known, true);
  assert.equal(late.schedule.elapsedDays, 129);
  assert.equal(late.schedule.revisedDays, 90);
  assert.equal(late.schedule.deltaDays, 39);
  assert.equal(late.schedule.intent, 'bad');

  const early = computeVariance({
    quote: quote(),
    project: { startedAt: '2026-06-15', completedAt: '2026-08-20', actualSpend: '0' },
    today: TODAY
  });
  assert.equal(early.schedule.complete, true);
  assert.equal(early.schedule.deltaDays, 66 - 90);
  assert.equal(early.schedule.intent, 'good', 'finishing early must not read as a problem');
});

test("a signed change order's schedule impact extends the agreed duration", () => {
  const v = computeVariance({
    quote: quote(),
    changeOrders: [co({ costDelta: '0.00', scheduleImpactDays: 45 })],
    project: { startedAt: '2026-06-15', actualSpend: '0' },
    today: TODAY
  });
  assert.equal(v.schedule.scheduleImpactDays, 45);
  assert.equal(v.schedule.revisedDays, 135);
  assert.equal(v.schedule.deltaDays, 129 - 135);
  assert.equal(v.schedule.intent, 'good', 'inside the extended schedule the owner agreed to');
});

// --- projection -------------------------------------------------------------

test('estimating accuracy is staff-only; the client sees the agreed baseline', () => {
  const v = computeVariance({ quote: quote(), changeOrders: [co({ costDelta: '20000.00' })], project: { actualSpend: '215000.00' }, today: TODAY });

  const staff = varianceFor(v, 'bn_staff');
  assert.ok(staff.vsQuote && staff.absorbedLosses !== undefined);

  for (const role of ['client', 'management']) {
    const out = varianceFor(v, role);
    assert.equal(out.vsQuote, undefined, `${role} must not see how far off our desk number was`);
    assert.equal(out.absorbedLosses, undefined);
    assert.ok(out.vsRevised, `${role} still sees the agreed baseline`);
  }

  for (const role of ['subcontractor', 'expediter', 'building-rep']) {
    assert.equal(varianceFor(v, role), undefined, `${role} must not see the quote at all`);
  }
});

test('the staff projection carries no key the client projection also needs', () => {
  const v = computeVariance({ quote: quote(), project: { actualSpend: '1.00' }, today: TODAY });
  const client = JSON.stringify(varianceFor(v, 'client'));
  assert.ok(!client.includes('vsQuote'));
  assert.ok(!client.includes('absorbedLosses'));
});
