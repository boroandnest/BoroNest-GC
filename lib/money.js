// Money primitives. Decimal.js throughout; never a JS float for a dollar figure.
// Locked by shared/fixtures/gmp.vectors.json (lib/money.test.js + lib/money.storage.test.js).
// Server-side only: client components render strings produced here, they never compute.
import Decimal from 'decimal.js';

// Half-up (ties away from zero), never banker's. No exponent notation in string output.
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP, toExpNeg: -9e15, toExpPos: 9e15 });

export { Decimal };

const ZERO = new Decimal(0);
const HUNDRED = new Decimal(100);

// Accepts decimal strings (preferred), Decimal, Mongo Decimal128 (via its string form) or integers.
export function toMoney(v) {
  if (v instanceof Decimal) return v;
  if (v === null || v === undefined || v === '') return ZERO;
  if (typeof v === 'object' && typeof v.toString === 'function') return new Decimal(v.toString());
  return new Decimal(v);
}

export function round2(v) {
  return toMoney(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

// Fixed two-decimal string for display / storage ("1234.50", "-0.01", "0.00").
export function toMoneyString(v) {
  const r = round2(v);
  const [int, frac = ''] = r.abs().toString().split('.');
  return `${r.isNegative() && !r.isZero() ? '-' : ''}${int}.${(frac + '00').slice(0, 2)}`;
}

export function lineTotal(qty, unitCost) {
  return round2(toMoney(qty).times(toMoney(unitCost)));
}

// Tariff exposure on a base cost at a percentage (25.00 = 25%).
export function tariffExposure(base, pct) {
  return round2(toMoney(base).times(toMoney(pct)).dividedBy(HUNDRED));
}

// Contingency burn-down from signed change orders.
// { ceiling, contingency, signedCos: [{ delta, againstContingency }] }
export function contingency({ ceiling, contingency: reserve, signedCos = [] }) {
  const reserveD = round2(reserve);
  let used = ZERO;
  let adjustments = ZERO;
  for (const co of signedCos) {
    if (co.againstContingency) used = used.plus(toMoney(co.delta));
    else adjustments = adjustments.plus(toMoney(co.delta));
  }
  const remainingRaw = reserveD.minus(used);
  const remaining = remainingRaw.isNegative() ? ZERO : remainingRaw;
  const pctRemaining = reserveD.isZero() ? ZERO : remaining.dividedBy(reserveD).times(HUNDRED);
  return {
    contingencyUsed: round2(used),
    contingencyRemaining: round2(remaining),
    ceilingAdjustments: round2(adjustments),
    adjustedCeiling: round2(toMoney(ceiling).plus(adjustments)),
    pctRemaining: round2(pctRemaining)
  };
}
