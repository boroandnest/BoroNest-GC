// GMP worksheet rollup + stale-cost flags. Server-side only; the page renders these strings.
import { toMoney, toMoneyString, round2, Decimal } from './money.js';
import { scopeTotals } from './scope/totals.js';

export const STALE_COST_DAYS = 120;

export function isStaleCost(costUpdated, now = new Date()) {
  if (!costUpdated) return false;
  const t = new Date(costUpdated).getTime();
  return !isNaN(t) && now.getTime() - t > STALE_COST_DAYS * 86400000;
}

export function costAgeDays(costUpdated, now = new Date()) {
  if (!costUpdated) return null;
  return Math.floor((now.getTime() - new Date(costUpdated).getTime()) / 86400000);
}

// lines: scope lines (any money representation); contingency: project reserve.
export function estimateRollup(lines, contingency) {
  const t = scopeTotals(lines);
  const reserve = round2(contingency ?? 0);
  return {
    baseTotal: t.baseTotal,
    tariffTotal: t.tariffTotal,
    scopeTotal: t.scopeTotal,
    contingency: toMoneyString(reserve),
    proposedCeiling: toMoneyString(toMoney(t.scopeTotal).plus(reserve)),
    byTrade: t.byTrade
  };
}

const money = (v) => (v === undefined || v === null ? null : toMoneyString(toMoney(v)));

export function worksheetRow(line, now = new Date()) {
  const tariffPct = line.tariffPct === undefined || line.tariffPct === null ? new Decimal(0) : toMoney(line.tariffPct);
  return {
    id: line.id,
    seq: line.seq,
    trade: line.trade,
    title: line.title,
    quantity: line.quantity === undefined || line.quantity === null ? null : toMoney(line.quantity).toString(),
    unit: line.unit || '',
    unitCost: money(line.unitCost),
    tariffPct: tariffPct.toString(),
    hasTariff: tariffPct.greaterThan(0),
    tariffExposure: money(line.tariffExposure ?? 0),
    lineTotal: money(line.lineTotal),
    specifiedMfr: line.specifiedMfr || '',
    specifiedProduct: line.specifiedProduct || '',
    sourcingOrigin: line.sourcingOrigin || '',
    altDomesticMfr: line.altDomesticMfr || '',
    costUpdated: line.costUpdated || null,
    costAgeDays: costAgeDays(line.costUpdated, now),
    staleCost: isStaleCost(line.costUpdated, now),
    plannedStart: line.plannedStart || null,
    plannedEnd: line.plannedEnd || null,
    status: line.status,
    orphaned: !!line.orphaned
  };
}
