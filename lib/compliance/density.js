// AEP violation density (PHASE2_PATCH P3). Pure.
//
// OPEN means the agency has not closed it (agencyClosedAt is null). Work completed, client accepted
// and certification filed are separate, earlier events — none of them reduces density. Conflating
// them is how a portfolio believes it escaped AEP and then gets designated.
// A building with no (or zero) unit count returns 'unknown' and NO density figure: a density built
// on a guessed unit count is worse than none.
import { Decimal } from '../money.js';

export const AEP_OVER = new Decimal('3.0');
export const AEP_APPROACHING = new Decimal('2.5');

const isOpen = (v, at) => !v.agencyClosedAt || (at && new Date(v.agencyClosedAt) > at);

export function computeDensity(building, violations) {
  const open = violations.filter(v => isOpen(v));
  const openViolations = open.length;
  const openClassC = open.filter(v => v.class === 'C').length;
  const awaitingClosure = open.filter(v => v.workCompletedAt).length;
  const units = building.unitCount;
  const base = { openViolations, openClassC, awaitingClosure, unitCount: units ?? null, unitCountVerified: !!building.unitCountVerified, unitCountSource: building.unitCountSource || null };
  if (!units || units <= 0) return { ...base, density: null, aepStatus: 'unknown' };
  const ratio = new Decimal(openViolations).dividedBy(units);
  const aepStatus = ratio.greaterThanOrEqualTo(AEP_OVER) ? 'over_threshold' : ratio.greaterThanOrEqualTo(AEP_APPROACHING) ? 'approaching' : 'clear';
  return { ...base, density: ratio.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2), aepStatus };
}

// Open violations as of a moment (for retainer guarantees): issued on/before it and not yet closed then.
// The HPD issue date is authoritative; when it was entered into our register does not matter (otherwise
// late data entry could hide growth). createdAt is only a fallback for rows with no issue date.
export function openCountAt(violations, at) {
  const t = new Date(at);
  return violations.filter(v => new Date(v.issuedOn || v.createdAt || 0) <= t && isOpen(v, t)).length;
}

export const EVIDENCE_STATUSES = ['reported', 'documented', 'professionally_assessed', 'disputed', 'unknown', 'superseded'];
export const VIOLATION_CLASSES = ['A', 'B', 'C', 'I'];
export const CLOSURE_STEPS = ['workCompletedAt', 'clientAcceptedAt', 'certifiedFiledAt', 'agencyClosedAt'];
