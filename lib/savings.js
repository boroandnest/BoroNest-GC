// Savings labels (PHASE2_PATCH P5, required here by T31).
//
// The Waterford figure was wrong by 84% because a number that excluded
// $687,000 of remediation was presented as if it were cash saved. The fix is
// not more careful arithmetic — it is that no figure may be shown without
// saying what kind of claim it is.
//
// So a figure cannot be constructed without a label. `figure()` throws rather
// than defaulting, because a default would be chosen once and then inherited
// silently by every number after it, which is exactly how the original error
// happened.

import { toMoney, toMoneyString } from './money.js';

export const SAVINGS_LABELS = {
  realized_cash: {
    label: 'Realized cash',
    short: 'Realized',
    // Money that actually moved, or that we hold a record of not having to pay.
    meaning: 'Money that actually moved. Traceable to an invoice, a credit or a payment.',
    tone: 'ok',
    verified: true
  },
  observed: {
    label: 'Observed',
    short: 'Observed',
    meaning: 'Measured from our own records for this job. Not a projection.',
    tone: 'ok',
    verified: true
  },
  estimated_capacity: {
    label: 'Estimated capacity',
    short: 'Estimated',
    meaning: 'What the approach can deliver, modelled. Not what this job delivered.',
    tone: 'warn',
    verified: false
  },
  risk_hypothesis: {
    label: 'Risk hypothesis',
    short: 'Hypothesis',
    // Avoided-cost claims: fines not levied, shed rent not accrued. Real
    // reasoning, but nothing changed hands, and the counterfactual cannot be
    // proven.
    meaning: 'An avoided cost. Nothing changed hands, and the outcome it avoids did not happen.',
    tone: 'warn',
    verified: false
  },
  unverified: {
    label: 'Unverified',
    short: 'Unverified',
    meaning: 'Supplied from outside, or not yet checked against a record.',
    tone: 'neutral',
    verified: false
  }
};

export const LABEL_KEYS = Object.keys(SAVINGS_LABELS);

export class SavingsError extends Error {
  constructor(code, detail) {
    super(`${code}${detail ? `: ${detail}` : ''}`);
    this.code = code;
    this.detail = detail;
  }
}

// A money figure that knows what kind of claim it is.
//
// `basis` is required for anything unverified: a hypothesis with no stated
// reasoning is a guess wearing a label, and the label is supposed to make the
// reasoning visible, not excuse its absence.
export function figure({ amount, label, caption, basis = null } = {}) {
  if (!label) throw new SavingsError('missing_label', caption || 'figure');
  const def = SAVINGS_LABELS[label];
  if (!def) throw new SavingsError('unknown_label', label);
  let money;
  try { money = toMoney(amount); } catch { throw new SavingsError('not_a_number', String(amount)); }
  if (!def.verified && !basis) throw new SavingsError('missing_basis', label);
  return {
    amount: toMoneyString(money),
    label,
    labelText: def.label,
    labelShort: def.short,
    meaning: def.meaning,
    tone: def.tone,
    verified: def.verified,
    caption: caption || null,
    basis
  };
}

// True when every figure in a deck is labelled and every unverified one states
// its basis. A deck that fails this must not be shared.
export function allLabelled(figures = []) {
  return figures.every(f => f && LABEL_KEYS.includes(f.label) && (SAVINGS_LABELS[f.label].verified || !!f.basis));
}

// A deck mixing verified and unverified figures must say so in one line, so a
// reader cannot take the total as cash.
export function mixSummary(figures = []) {
  const unverified = figures.filter(f => !SAVINGS_LABELS[f.label]?.verified);
  if (!figures.length) return null;
  if (!unverified.length) return 'Every figure here is measured from records for this job.';
  if (unverified.length === figures.length) return 'Every figure here is modelled or avoided-cost. None of it is cash that moved.';
  return `${unverified.length} of ${figures.length} figures are modelled or avoided-cost, not cash that moved.`;
}
