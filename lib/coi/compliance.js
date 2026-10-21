// COI compliance — pure. (PHASE2_EXECUTE T9 + PHASE2_PATCH P1)
//
// A certificate is compliant for a building when it is:
//   verified by staff, effective, not expired, GL limit >= requirement, WC present when required,
//   auto liability >= requirement (when required), employer's liability >= requirement (when required),
//   and EVERY required additional insured (static entities + per-unit entries resolved at project
//   creation) appears on it.
// The certificate HOLDER is a separate entity (with a c/o address) and is not an additional insured.
import { toMoney } from '../money.js';
import { iso, subtractBusinessDays, addDays } from '../dates.js';

export class CoiError extends Error {
  constructor(code, detail) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'CoiError';
    this.code = code;
    this.detail = detail;
  }
}

export const AI_TOKENS = ['resident_name', 'resident_phone', 'unit', 'building_name'];

// '{resident_name}, Apt {unit}' + { resident_name: 'Ana Ruiz', unit: '4C' } -> 'Ana Ruiz, Apt 4C'.
// A missing value THROWS: a blank AI line gets the COI rejected and the crew loses a day.
export function resolveAI(building, unit = {}) {
  const ctx = { building_name: building.name, ...unit };
  const dynamic = (building.requiredAiTokens || []).map(t =>
    String(t).replace(/\{(\w+)\}/g, (_, k) => {
      if (!AI_TOKENS.includes(k)) throw new CoiError('unknown_token', k);
      const v = ctx[k];
      if (v === undefined || v === null || String(v).trim() === '') throw new CoiError('missing_token_value', k);
      return String(v).trim();
    })
  );
  return [...(building.requiredAiStatic || []), ...dynamic];
}

// "Fairfield Views, Inc." == "FAIRFIELD VIEWS INC" — case, punctuation and spacing don't matter.
export function normalizeEntity(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}

const amount = (v) => (v === undefined || v === null || v === '' ? null : toMoney(v));

// building: requirements; requiredAi: resolveAI() output stored on the project; asOf: 'YYYY-MM-DD'.
export function coiCompliant(coi, building, requiredAi = [], asOf = iso(new Date())) {
  const reasons = [];
  if (!coi) return { ok: false, reasons: ['no_coi'] };
  if (coi.status !== 'verified' || !coi.verifiedAt) reasons.push('not_verified');
  if (!coi.expiresOn || iso(coi.expiresOn) < iso(asOf)) reasons.push('expired');
  if (coi.effectiveOn && iso(coi.effectiveOn) > iso(asOf)) reasons.push('not_yet_effective');

  const reqGl = amount(building.requiredGl);
  if (reqGl && reqGl.greaterThan(0) && !(amount(coi.glLimit)?.greaterThanOrEqualTo(reqGl))) reasons.push('gl_limit_below_requirement');
  if (building.requiresWc && !coi.wcPresent) reasons.push('workers_comp_missing');
  const reqAuto = amount(building.requiredAuto);
  if (reqAuto && reqAuto.greaterThan(0) && !(amount(coi.autoLimit)?.greaterThanOrEqualTo(reqAuto))) reasons.push('auto_limit_below_requirement');
  const reqEl = amount(building.requiredEl);
  if (reqEl && reqEl.greaterThan(0) && !(amount(coi.elLimit)?.greaterThanOrEqualTo(reqEl))) reasons.push('employers_liability_below_requirement');

  const named = new Set((coi.additionalInsured || []).map(normalizeEntity));
  const missingAi = requiredAi.filter(e => !named.has(normalizeEntity(e)));
  if (missingAi.length) reasons.push('additional_insured_missing');

  const warnings = [];
  if (building.certHolderName && coi.certHolderText && !normalizeEntity(coi.certHolderText).includes(normalizeEntity(building.certHolderName))) {
    warnings.push('certificate_holder_mismatch');
  }
  return { ok: reasons.length === 0, reasons, missingAi, warnings };
}

// P1 lead-time gate: the COI must have been submitted `coiLeadDays` (business) days before work.
export function coiSubmittedInTime(submittedAt, workDate, building) {
  const lead = building?.coiLeadDays;
  if (lead === undefined || lead === null) return true;
  if (!submittedAt) return false;
  const deadline = building.coiLeadIsBusinessDays === false ? addDays(workDate, -lead) : subtractBusinessDays(workDate, lead);
  return iso(submittedAt) <= deadline;
}

export const REASON_TEXT = {
  no_coi: 'No certificate on file',
  not_verified: 'Not yet verified by Boro & Nest',
  expired: 'Expired',
  not_yet_effective: 'Not yet in effect',
  gl_limit_below_requirement: 'General liability limit below the building requirement',
  workers_comp_missing: "Workers' compensation missing",
  auto_limit_below_requirement: 'Auto liability limit below the building requirement',
  employers_liability_below_requirement: "Employer's liability limit below the building requirement",
  additional_insured_missing: 'A required additional insured is not named',
  submitted_too_late: 'Submitted after the building\'s lead-time deadline'
};
