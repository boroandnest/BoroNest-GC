import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeFinancials, projectFinancialsFor } from './financials.js';

const V = JSON.parse(readFileSync(new URL('../../shared/fixtures/gmp.vectors.json', import.meta.url)));

// The financials "view" must agree with the T1 parity fixture for the same inputs.
for (const c of V.contingency) {
  test(`financials match T1 fixture: ${c.label}`, () => {
    const cos = c.signed_cos.map((co, i) => ({ status: 'signed', reason: 'owner_request', costDelta: co.delta, againstContingency: co.against_contingency }));
    cos.push({ status: 'pending_signature', reason: 'owner_request', costDelta: '999.00', againstContingency: true }); // unsigned: ignored
    const f = computeFinancials({ gmpCeiling: c.ceiling, contingency: c.contingency }, cos);
    assert.equal(f.contingencyUsed, c.expect.contingency_used);
    assert.equal(f.contingencyRemaining, c.expect.contingency_remaining);
    assert.equal(f.ceilingAdjustments, c.expect.ceiling_adjustments);
    assert.equal(f.adjustedCeiling, c.expect.adjusted_ceiling);
    assert.equal(f.pctRemaining, c.expect.pct_remaining);
  });
}

test('bn_error is absorbed by B&N, never charged to contingency or ceiling', () => {
  const f = computeFinancials({ gmpCeiling: '100000', contingency: '10000' }, [
    { status: 'signed', reason: 'bn_error', costDelta: '2500', againstContingency: true },
    { status: 'signed', reason: 'owner_request', costDelta: '1000', againstContingency: true }
  ]);
  assert.equal(f.contingencyUsed, '1000.00');
  assert.equal(f.absorbedLosses, '2500.00');
  assert.equal(projectFinancialsFor(f, 'client').absorbedLosses, undefined);
  assert.equal(projectFinancialsFor(f, 'subcontractor'), undefined);
  assert.equal(projectFinancialsFor(f, 'building-rep'), undefined);
});

test('band: forest > 40%, sand 15–40%, alert < 15%', () => {
  const band = (used) => computeFinancials({ gmpCeiling: '1', contingency: '100' }, [{ status: 'signed', reason: 'owner_request', costDelta: used, againstContingency: true }]).band;
  assert.equal(band('59'), 'forest');
  assert.equal(band('60'), 'sand');
  assert.equal(band('85'), 'sand');
  assert.equal(band('86'), 'alert');
});
