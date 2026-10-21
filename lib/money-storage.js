// How money is persisted in MongoDB: as Decimal128, never as a double.
// A double cannot hold most decimals exactly (1.005 is 1.00499999…), so float arithmetic on it
// (Math.round(x * 100) / 100 → 1.00) disagrees with the half-up result (1.01).
// Write with toDecimal128, read with fromDecimal128, compute with lib/money.
import { Decimal128 } from 'mongodb';
import { toMoney, toMoneyString } from './money.js';

export function toDecimal128(v) {
  return Decimal128.fromString(toMoneyString(v));
}

// For non-money decimals that must keep more places (quantities, percentages).
export function toDecimal128Exact(v) {
  return Decimal128.fromString(toMoney(v).toString());
}

export function fromDecimal128(v) {
  return toMoney(v);
}
