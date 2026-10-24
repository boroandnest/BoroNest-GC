// Q1 · Rate card invariants that Mongo's validator cannot express (it cannot
// sum across array elements). Checked before any publish.

import { toMoney } from '../money.js';

export class CardError extends Error {
  constructor(code, detail) {
    super(`${code}${detail ? `: ${detail}` : ''}`);
    this.code = code;
    this.detail = detail;
  }
}

// Each (profile) trade-split set must sum to exactly 100.00, or the line
// items on a proposal don't reconcile to the total and a client comparing
// bids finds it before we do.
export function validateTradeSplits(tradeSplits = []) {
  const byProfile = new Map();
  for (const s of tradeSplits) {
    if (!byProfile.has(s.profile)) byProfile.set(s.profile, toMoney(0));
    byProfile.set(s.profile, byProfile.get(s.profile).plus(toMoney(s.pct)));
  }
  const bad = [...byProfile.entries()].filter(([, sum]) => !sum.equals(100));
  if (bad.length) throw new CardError('splits_not_100', bad.map(([p, s]) => `${p}=${s.toFixed(2)}`).join(', '));
  return true;
}

// A card may be published only when every profile it will be asked to price
// has a complete, reconciling trade-split set.
export function assertPublishable(card) {
  if (!card.tradeSplits?.length) throw new CardError('no_trade_splits');
  validateTradeSplits(card.tradeSplits);
  return true;
}
