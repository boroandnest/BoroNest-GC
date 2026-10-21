// Pure change-order money + copy. No database.
import { toMoney, toMoneyString, contingency as contingencyMath, Decimal } from '../money.js';

export const CO_REASONS = ['owner_request', 'unforeseen_condition', 'code_requirement', 'design_change', 'value_engineering', 'bn_error'];

// Client-facing copy: the reason is shown as prose, never as the enum value.
export const REASON_PROSE = {
  owner_request: 'You asked for this change',
  unforeseen_condition: 'Found when we opened the wall',
  code_requirement: 'Required by code or the inspector',
  design_change: 'The design was updated',
  value_engineering: 'A lower-cost way to get the same result',
  bn_error: 'A correction on our side — at no cost to you',
  scope_revision: 'Scope revision'
};

// ---------- financials (the project_financials "view") ----------
// Full record including absorbedLosses — staff only. Use projectFinancialsFor() for other roles.
export function computeFinancials(project, changeOrders) {
  const signed = changeOrders.filter(c => c.status === 'signed');
  const billable = signed.filter(c => c.reason !== 'bn_error');
  const c = contingencyMath({
    ceiling: project.gmpCeiling ?? 0,
    contingency: project.contingency ?? 0,
    signedCos: billable.map(co => ({ delta: toMoney(co.costDelta), againstContingency: !!co.againstContingency }))
  });
  const absorbed = signed.filter(co => co.reason === 'bn_error').reduce((a, co) => a.plus(toMoney(co.costDelta)), new Decimal(0));
  const pending = changeOrders.filter(co => co.status === 'pending_signature').reduce((a, co) => a.plus(toMoney(co.costDelta)), new Decimal(0));
  const pct = c.pctRemaining;
  return {
    gmpCeiling: toMoneyString(project.gmpCeiling ?? 0),
    contingency: toMoneyString(project.contingency ?? 0),
    contingencyUsed: toMoneyString(c.contingencyUsed),
    contingencyRemaining: toMoneyString(c.contingencyRemaining),
    pctRemaining: toMoneyString(pct),
    // Bar colour is decided here, not in the component: forest > 40%, sand 15–40%, alert < 15%.
    band: pct.greaterThan(40) ? 'forest' : pct.greaterThanOrEqualTo(15) ? 'sand' : 'alert',
    ceilingAdjustments: toMoneyString(c.ceilingAdjustments),
    adjustedCeiling: toMoneyString(c.adjustedCeiling),
    pendingChangeOrders: toMoneyString(pending),
    signedCount: billable.length,
    absorbedLosses: toMoneyString(absorbed)
  };
}

// Client / management view: everything except absorbedLosses (estimating accuracy is internal).
export function projectFinancialsFor(financials, role) {
  if (role === 'bn_staff') return financials;
  if (role === 'client' || role === 'management') {
    const { absorbedLosses, ...rest } = financials;
    return rest;
  }
  return undefined;
}
