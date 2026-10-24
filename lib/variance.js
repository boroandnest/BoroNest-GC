// T33 · Desk quote versus live. Pure: no database, no clock of its own.
//
// Two different questions, deliberately kept apart because they have different
// audiences and opposite uses:
//
//   vs the REVISED baseline — "are we running over what was agreed?"
//       The quote plus every signed change order that legitimately raised the
//       ceiling. This is the number an owner is entitled to, and the one that
//       says whether the job is in trouble.
//
//   vs the QUOTE ALONE — "how good is our desk estimating?"
//       The live quote with no change orders added. Staff only, for the same
//       reason Phase 2 keeps absorbedLosses internal: it measures us, not the
//       job, and an owner shown it would read a learning signal as an overrun.
//       Note it is the LIVE quote, not the first one ever issued — a re-quote
//       after a second site visit replaces the number we are judged against,
//       and the superseded row stays in the history for anyone asking why.
//
// A signed owner-requested change order is not an overrun. It is work the owner
// asked for and agreed to pay for, so it moves the baseline. A bn_error change
// order is absorbed by B&N and touches neither number — the client is never
// charged for our mistake, and it must not appear in their variance either.
//
// Sign does not determine meaning. Under budget is negative and good news; a
// contingency draw is positive and bad. Every variance leaves here with an
// explicit `intent`, because letting a component read the arrow is how a
// dashboard tells an owner their savings are a problem.

import { Decimal, toMoney, toMoneyString } from './money.js';
import { daysBetween } from './dates.js';

const ZERO = new Decimal(0);

// `good` when the job is cheaper or faster than promised, `bad` when it is
// over, `flat` when it lands exactly.
function intentOf(delta) {
  if (delta.isZero()) return 'flat';
  return delta.greaterThan(0) ? 'bad' : 'good';
}
const directionOf = (d) => (d.isZero() ? 'flat' : d.greaterThan(0) ? 'up' : 'down');

function varianceRow(live, baseline) {
  const delta = live.minus(baseline);
  const pct = baseline.isZero()
    ? null
    : delta.dividedBy(baseline).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
  return {
    baseline: toMoneyString(baseline),
    live: toMoneyString(live),
    // Signed, so the caller can show "over by" or "under by" without recomputing.
    delta: toMoneyString(delta),
    abs: toMoneyString(delta.abs()),
    pct,
    intent: intentOf(delta),
    direction: directionOf(delta),
    over: delta.greaterThan(0)
  };
}

export function computeVariance({ quote, project = {}, changeOrders = [], today } = {}) {
  if (!quote) return null;

  const signed = changeOrders.filter(c => c.status === 'signed');
  const billable = signed.filter(c => c.reason !== 'bn_error');

  // Only change orders that raise the ceiling move the baseline. One drawn
  // against contingency spends a reserve the quote already contained, so
  // counting it again would forgive an overrun twice.
  const ceilingAdjustments = billable
    .filter(c => !c.againstContingency)
    .reduce((a, c) => a.plus(toMoney(c.costDelta)), ZERO);

  const absorbed = signed
    .filter(c => c.reason === 'bn_error')
    .reduce((a, c) => a.plus(toMoney(c.costDelta)), ZERO);

  const quoted = toMoney(quote.amount);
  const revisedBaseline = quoted.plus(ceilingAdjustments);
  const live = toMoney(project.actualSpend ?? 0);

  // --- schedule ------------------------------------------------------------
  // Unknown is not zero. With no quoted duration or no recorded start there is
  // no variance to state, and inventing one from the quote date would measure
  // how long the owner took to decide.
  const scheduleImpactDays = signed
    .filter(c => c.reason !== 'bn_error')
    .reduce((a, c) => a + (Number(c.scheduleImpactDays) || 0), 0);

  let schedule = { known: false, reason: null, quotedDays: quote.durationDays ?? null, scheduleImpactDays };
  if (quote.durationDays === null || quote.durationDays === undefined) {
    schedule.reason = 'no_duration_quoted';
  } else if (!project.startedAt) {
    schedule.reason = 'no_start_date';
    schedule.revisedDays = quote.durationDays + scheduleImpactDays;
  } else {
    const start = String(project.startedAt).slice(0, 10);
    const end = project.completedAt ? String(project.completedAt).slice(0, 10) : today;
    const elapsed = daysBetween(start, end);
    const revisedDays = quote.durationDays + scheduleImpactDays;
    const deltaDays = elapsed - revisedDays;
    schedule = {
      known: true,
      reason: null,
      quotedDays: quote.durationDays,
      scheduleImpactDays,
      revisedDays,
      elapsedDays: elapsed,
      deltaDays,
      absDays: Math.abs(deltaDays),
      complete: !!project.completedAt,
      intent: deltaDays === 0 ? 'flat' : deltaDays > 0 ? 'bad' : 'good',
      direction: deltaDays === 0 ? 'flat' : deltaDays > 0 ? 'up' : 'down'
    };
  }

  return {
    quote: {
      id: quote.id,
      amount: toMoneyString(quoted),
      quotedAt: quote.quotedAt,
      durationDays: quote.durationDays ?? null,
      scopeSummary: quote.scopeSummary || null
    },
    ceilingAdjustments: toMoneyString(ceilingAdjustments),
    absorbedLosses: toMoneyString(absorbed),
    signedCount: billable.length,
    // The owner's number.
    vsRevised: varianceRow(live, revisedBaseline),
    // Ours.
    vsQuote: varianceRow(live, quoted),
    schedule
  };
}

// Role projection. vsQuote and absorbedLosses measure B&N's estimating, not the
// job, so they are staff-only — the same cut Phase 2 makes in
// lib/co/financials.js. Trades and building reps get nothing: a quote is the
// client's commercial position.
export function varianceFor(variance, role) {
  if (!variance) return null;
  if (role === 'bn_staff') return variance;
  if (role === 'client' || role === 'management') {
    const { vsQuote, absorbedLosses, ...rest } = variance;
    return rest;
  }
  return undefined;
}
