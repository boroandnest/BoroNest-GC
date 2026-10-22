import { test } from 'node:test';
import assert from 'node:assert/strict';
import { figure, allLabelled, mixSummary, SavingsError, SAVINGS_LABELS } from './savings.js';

test('a figure cannot be built without a label', () => {
  assert.throws(() => figure({ amount: '1000.00' }), (e) => e instanceof SavingsError && e.code === 'missing_label');
  assert.throws(() => figure({ amount: '1000.00', label: 'savings' }), { code: 'unknown_label' });
});

test('an unverified figure must state its basis', () => {
  // This is the Waterford guard: a hypothesis with no reasoning is a guess
  // wearing a label.
  assert.throws(() => figure({ amount: '687000.00', label: 'risk_hypothesis', caption: 'Fines avoided' }), { code: 'missing_basis' });
  assert.throws(() => figure({ amount: '1.00', label: 'estimated_capacity' }), { code: 'missing_basis' });

  const ok = figure({ amount: '687000.00', label: 'risk_hypothesis', caption: 'Fines avoided', basis: '12 class C violations × HPD daily penalty over the 90-day cure window' });
  assert.equal(ok.verified, false);
  assert.equal(ok.tone, 'warn');
  assert.match(ok.basis, /class C/);
});

test('a verified figure needs no basis and carries its meaning', () => {
  const f = figure({ amount: '16400.00', label: 'observed', caption: 'Under the agreed baseline' });
  assert.equal(f.verified, true);
  assert.equal(f.tone, 'ok');
  assert.equal(f.amount, '16400.00');
  assert.match(f.meaning, /Measured from our own records/);
});

test('money keeps 2dp and does not drift', () => {
  assert.equal(figure({ amount: '1000', label: 'observed' }).amount, '1000.00');
  assert.equal(figure({ amount: '0.1', label: 'observed' }).amount, '0.10');
  assert.throws(() => figure({ amount: 'lots', label: 'observed' }), { code: 'not_a_number' });
});

test('every label is either verified or not, with no third state', () => {
  for (const [key, def] of Object.entries(SAVINGS_LABELS)) {
    assert.equal(typeof def.verified, 'boolean', key);
    assert.ok(def.meaning.length > 20, `${key} needs a plain-language meaning`);
  }
  assert.equal(SAVINGS_LABELS.realized_cash.verified, true);
  assert.equal(SAVINGS_LABELS.risk_hypothesis.verified, false, 'an avoided cost is never cash');
  assert.equal(SAVINGS_LABELS.estimated_capacity.verified, false);
});

test('allLabelled rejects a deck carrying a bare figure', () => {
  const good = [figure({ amount: '1.00', label: 'observed' })];
  assert.equal(allLabelled(good), true);
  assert.equal(allLabelled([...good, { amount: '2.00' }]), false);
  assert.equal(allLabelled([...good, { amount: '2.00', label: 'risk_hypothesis' }]), false, 'unverified without basis');
});

test('a mixed deck says so, so a total is never read as cash', () => {
  const cash = figure({ amount: '10.00', label: 'realized_cash' });
  const hypo = figure({ amount: '20.00', label: 'risk_hypothesis', basis: 'because' });
  assert.match(mixSummary([cash]), /measured from records/);
  assert.match(mixSummary([hypo]), /None of it is cash that moved/);
  assert.match(mixSummary([cash, hypo]), /1 of 2 figures are modelled or avoided-cost/);
  assert.equal(mixSummary([]), null);
});
