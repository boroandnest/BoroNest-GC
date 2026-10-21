// Server-side scope rollups (money returned as fixed 2dp strings). Accepts lines whose money is Decimal128, Decimal, string or (legacy
// Phase 1) number; every sum is Decimal via lib/money.
import { toMoney, toMoneyString, Decimal } from '../money.js';

const m = (v) => (v === undefined || v === null || v === '' ? new Decimal(0) : toMoney(v));

export function scopeTotals(lines) {
  const byTrade = new Map();
  let base = new Decimal(0);
  let tariff = new Decimal(0);
  let total = new Decimal(0);
  for (const l of lines) {
    const lt = m(l.lineTotal);
    const exposure = m(l.tariffExposure);
    const bc = l.baseCost !== undefined && l.baseCost !== null ? m(l.baseCost) : lt.minus(exposure);
    base = base.plus(bc);
    tariff = tariff.plus(exposure);
    total = total.plus(lt);
    const key = l.trade || 'other';
    const t = byTrade.get(key) || { trade: key, count: 0, total: new Decimal(0) };
    t.count += 1;
    t.total = t.total.plus(lt);
    byTrade.set(key, t);
  }
  return {
    byTrade: [...byTrade.values()].map(t => ({ ...t, total: toMoneyString(t.total) })),
    baseTotal: toMoneyString(base),
    tariffTotal: toMoneyString(tariff),
    scopeTotal: toMoneyString(total)
  };
}
