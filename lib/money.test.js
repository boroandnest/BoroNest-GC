// Parity suite (application side). Reads shared/fixtures/gmp.vectors.json — one test per case.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { round2, lineTotal, tariffExposure, contingency, toMoney, toMoneyString } from './money.js';

const V = JSON.parse(readFileSync(new URL('../shared/fixtures/gmp.vectors.json', import.meta.url)));
const eq = (actual, expected, msg) => assert.equal(toMoneyString(actual), expected, msg);

for (const c of V.rounding) {
  test(`round2 ${c.in} -> ${c.out}`, () => eq(round2(c.in), c.out));
}

for (const c of V.line_total) {
  test(`lineTotal ${c.qty} x ${c.unit_cost}`, () => eq(lineTotal(c.qty, c.unit_cost), c.out));
}

for (const c of V.tariff) {
  test(`tariff ${c.base} @ ${c.pct}%`, () => {
    const exposure = tariffExposure(c.base, c.pct);
    eq(exposure, c.exposure, 'exposure');
    eq(toMoney(c.base).plus(exposure), c.total, 'total');
  });
}

for (const c of V.contingency) {
  test(`contingency: ${c.label}`, () => {
    const r = contingency({
      ceiling: c.ceiling,
      contingency: c.contingency,
      signedCos: c.signed_cos.map(co => ({ delta: co.delta, againstContingency: co.against_contingency }))
    });
    eq(r.contingencyUsed, c.expect.contingency_used, 'used');
    eq(r.contingencyRemaining, c.expect.contingency_remaining, 'remaining');
    eq(r.ceilingAdjustments, c.expect.ceiling_adjustments, 'adjustments');
    eq(r.adjustedCeiling, c.expect.adjusted_ceiling, 'adjusted ceiling');
    eq(r.pctRemaining, c.expect.pct_remaining, 'pct remaining');
  });
}
