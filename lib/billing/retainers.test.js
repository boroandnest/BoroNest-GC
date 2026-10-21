import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePeriods, periodAmount, evaluateGuarantee, passthroughBilled, validateRetainer } from './retainers.js';
import { toMoneyString } from '../money.js';

// Waterford: $22,500/month for four months, then $14,800/month for eight.
const CRISIS = { label: 'Crisis response', monthlyAmount: '22500.00', startsOn: '2026-11-01', endsOn: '2027-02-28', billDay: 1 };
const STEADY = { label: 'Steady state', monthlyAmount: '14800.00', startsOn: '2027-03-01', endsOn: '2027-10-31', billDay: 1, guaranteeKind: 'no_violation_growth', guaranteeCreditPct: '20' };

test('monthly periods generate from starts_on and bill_day (Waterford: 4 + 8)', () => {
  const a = generatePeriods(CRISIS, '2030-01-01');
  const b = generatePeriods(STEADY, '2030-01-01');
  assert.equal(a.length, 4);
  assert.equal(b.length, 8);
  assert.deepEqual(a.map(p => [p.periodStart, p.periodEnd]), [['2026-11-01', '2026-11-30'], ['2026-12-01', '2026-12-31'], ['2027-01-01', '2027-01-31'], ['2027-02-01', '2027-02-28']]);
  assert.equal(b.at(-1).periodEnd, '2027-10-31');
  const total = [...a, ...b].reduce((s, p) => s.plus(p.baseAmount), a[0].baseAmount.minus(a[0].baseAmount));
  assert.equal(toMoneyString(total), '208400.00'); // 4 x 22,500 + 8 x 14,800
});

test('generation is deterministic (re-running yields the same keys) and only up to `through`', () => {
  assert.deepEqual(generatePeriods(CRISIS, '2026-12-15').map(p => p.periodStart), ['2026-11-01', '2026-12-01']);
  assert.deepEqual(generatePeriods(CRISIS, '2026-12-15'), generatePeriods(CRISIS, '2026-12-15'));
  const open = { ...STEADY, endsOn: null };
  assert.equal(generatePeriods(open, '2028-02-15').length, 12);
});

test('bill day 15: periods run 15th to 14th', () => {
  const p = generatePeriods({ monthlyAmount: '100', startsOn: '2026-01-15', billDay: 15 }, '2026-03-20');
  assert.deepEqual(p.map(x => [x.periodStart, x.periodEnd]), [['2026-01-15', '2026-02-14'], ['2026-02-15', '2026-03-14'], ['2026-03-15', '2026-04-14']]);
});

test('starts_on must fall on bill_day; bill_day 1–28', () => {
  assert.throws(() => validateRetainer({ ...CRISIS, startsOn: '2026-11-03' }), /must fall on the bill day/);
  assert.throws(() => validateRetainer({ ...CRISIS, billDay: 31 }), /between 1 and 28/);
});

test('a period with deliverables_met = false bills at the credited amount', () => {
  assert.equal(toMoneyString(periodAmount(STEADY, false).amount), '11840.00');
  assert.equal(toMoneyString(periodAmount(STEADY, false).creditApplied), '2960.00');
  assert.equal(toMoneyString(periodAmount(STEADY, true).amount), '14800.00');
  assert.equal(toMoneyString(periodAmount(STEADY, null).amount), '14800.00');
  assert.equal(toMoneyString(periodAmount(CRISIS, false).amount), '22500.00', 'no guarantee, no credit');
});

test('no_violation_growth guarantee evaluated against the violation register', () => {
  const period = { periodStart: '2027-03-01', periodEnd: '2027-03-31' };
  const base = [{ issuedOn: '2027-01-10', createdAt: '2027-01-10' }, { issuedOn: '2027-02-10', createdAt: '2027-02-10' }];
  assert.equal(evaluateGuarantee(STEADY, period, { violations: base }), true);
  assert.equal(evaluateGuarantee(STEADY, period, { violations: [...base, { issuedOn: '2027-03-15', createdAt: '2027-03-15' }] }), false);
  const closedOne = [...base, { issuedOn: '2027-03-15', createdAt: '2027-03-15' }].map((v, i) => (i === 0 ? { ...v, agencyClosedAt: '2027-03-20' } : v));
  assert.equal(evaluateGuarantee(STEADY, period, { violations: closedOne }), true);
  const dens = { ...STEADY, guaranteeMetric: { max_density: '1.0' } };
  assert.equal(evaluateGuarantee(dens, period, { violations: base, unitCount: 2 }), true);
  assert.equal(evaluateGuarantee(dens, period, { violations: base, unitCount: 1 }), false);
  assert.equal(evaluateGuarantee(dens, period, { violations: base, unitCount: null }), null);
  assert.equal(evaluateGuarantee({ ...STEADY, guaranteeKind: 'response_sla' }, period, {}), null);
  // entered into the register late (createdAt after the period) but ISSUED inside it: still growth
  const lateEntry = [...base, { issuedOn: '2027-03-15', createdAt: '2027-05-02' }];
  assert.equal(evaluateGuarantee(STEADY, period, { violations: lateEntry }), false);
});

test('materials pass through at cost plus stated markup', () => {
  assert.equal(toMoneyString(passthroughBilled('1234.56', '10')), '1358.02');
  assert.equal(toMoneyString(passthroughBilled('500', undefined)), '550.00');
});
