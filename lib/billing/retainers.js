// Recurring retainer billing (PHASE2_PATCH P2). Pure.
//
// Periods are calendar months anchored on bill_day: a retainer starting 2026-11-01 with bill_day 1
// bills 11-01..11-30, 12-01..12-31, ... until ends_on (inclusive). starts_on must fall ON bill_day,
// so there are no stub periods and nothing is prorated.
//
// Performance guarantee: a period whose deliverables were not met bills at
//   monthly_amount * (1 - guarantee_credit_pct / 100)
// automatically, and the credit is shown to the client — that is what makes the guarantee credible.
import { toMoney, round2, toMoneyString, Decimal } from '../money.js';
import { toDate, iso, addDays } from '../dates.js';
import { openCountAt } from '../compliance/density.js';

export class BillingError extends Error {
  constructor(message) { super(message); this.name = 'BillingError'; }
}

function addMonths(isoDate, n, day) {
  const d = toDate(isoDate);
  return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, day)));
}

export function validateRetainer(r) {
  const billDay = Math.trunc(+(r.billDay ?? 1));
  if (!(billDay >= 1 && billDay <= 28)) throw new BillingError('bill_day must be between 1 and 28');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.startsOn || '')) throw new BillingError('starts_on is required (YYYY-MM-DD)');
  if (toDate(r.startsOn).getUTCDate() !== billDay) throw new BillingError(`starts_on must fall on the bill day (day ${billDay})`);
  if (r.endsOn && (!/^\d{4}-\d{2}-\d{2}$/.test(r.endsOn) || r.endsOn < r.startsOn)) throw new BillingError('ends_on must be a date on or after starts_on');
  if (toMoney(r.monthlyAmount || 0).lessThanOrEqualTo(0)) throw new BillingError('monthly_amount must be greater than zero');
  const credit = toMoney(r.guaranteeCreditPct || 0);
  if (credit.lessThan(0) || credit.greaterThan(100)) throw new BillingError('guarantee_credit_pct must be 0–100');
  return billDay;
}

// All periods that START on or before `through` (and before ends_on). Deterministic, so re-running
// produces the same (retainerId, periodStart) keys — the unique index makes generation idempotent.
export function generatePeriods(r, through) {
  const billDay = validateRetainer(r);
  const out = [];
  for (let k = 0; k < 600; k++) {
    const start = addMonths(r.startsOn, k, billDay);
    if (start > through) break;
    if (r.endsOn && start > r.endsOn) break;
    let end = addDays(addMonths(r.startsOn, k + 1, billDay), -1);
    if (r.endsOn && end > r.endsOn) end = r.endsOn;
    out.push({ periodStart: start, periodEnd: end, baseAmount: round2(r.monthlyAmount) });
  }
  return out;
}

export function periodAmount(r, deliverablesMet) {
  const base = round2(r.monthlyAmount);
  if (deliverablesMet !== false || !r.guaranteeKind) return { amount: base, creditApplied: new Decimal(0) };
  const amount = round2(base.times(new Decimal(100).minus(toMoney(r.guaranteeCreditPct || 0))).dividedBy(100));
  return { amount, creditApplied: round2(base.minus(amount)) };
}

// Evaluates an automatically-measurable guarantee for a closed period. null = needs a person.
//   no_violation_growth: open violations at period end <= at period start, or, when
//   guarantee_metric.max_density is set, density at period end <= max_density.
export function evaluateGuarantee(r, period, { violations = [], unitCount = null } = {}) {
  if (r.guaranteeKind !== 'no_violation_growth') return null;
  const endAt = `${period.periodEnd}T23:59:59Z`;
  const openEnd = openCountAt(violations, endAt);
  const maxDensity = r.guaranteeMetric?.max_density;
  if (maxDensity !== undefined && maxDensity !== null) {
    if (!unitCount) return null; // no verified denominator: a person decides
    return new Decimal(openEnd).dividedBy(unitCount).lessThanOrEqualTo(toMoney(maxDensity));
  }
  const openStart = openCountAt(violations, `${period.periodStart}T00:00:00Z`);
  return openEnd <= openStart;
}

export function passthroughBilled(cost, markupPct) {
  return round2(toMoney(cost).times(new Decimal(100).plus(toMoney(markupPct ?? 10))).dividedBy(100));
}

export const money = (v) => toMoneyString(v);
