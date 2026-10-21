import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAI, coiCompliant, coiSubmittedInTime, CoiError } from './compliance.js';

// Veritas Property Management requirements for Fairfield Views Inc. (PHASE2_PATCH P1)
const FAIRFIELD = {
  name: 'Fairfield Views Inc.',
  certHolderName: 'FAIRFIELD VIEWS INC.', certHolderCo: 'C/O VERITAS PROPERTY MANAGEMENT LLC', certHolderAddr: '1 Example Plaza, Bronx NY',
  requiredAiStatic: ['FAIRFIELD VIEWS INC.', 'VERITAS PROPERTY MANAGEMENT LLC'],
  requiredAiTokens: ['{resident_name}, Apt {unit}', '{resident_phone}'],
  coiLeadDays: 4, coiLeadIsBusinessDays: true,
  requiredGl: '1000000.00', requiresWc: true, requiredAuto: '1000000.00', requiredEl: '500000.00'
};
const UNIT = { resident_name: 'Ana Ruiz', unit: '4C', resident_phone: '718-555-0142' };
const AI = resolveAI(FAIRFIELD, UNIT);

const good = () => ({
  status: 'verified', verifiedAt: new Date('2026-10-01'), effectiveOn: '2026-01-01', expiresOn: '2027-01-01',
  glLimit: '2000000', wcPresent: true, autoLimit: '1000000', elLimit: '500000',
  additionalInsured: ['Fairfield Views, Inc', 'VERITAS PROPERTY MANAGEMENT LLC', 'ANA RUIZ, APT 4C', '718-555-0142'],
  certHolderText: 'FAIRFIELD VIEWS INC. C/O VERITAS PROPERTY MANAGEMENT LLC'
});

test('token-based AI resolves {resident_name}, Apt {unit} at project creation', () => {
  assert.deepEqual(AI, ['FAIRFIELD VIEWS INC.', 'VERITAS PROPERTY MANAGEMENT LLC', 'Ana Ruiz, Apt 4C', '718-555-0142']);
});

test('a missing resident name throws rather than emitting a blank AI line', () => {
  assert.throws(() => resolveAI(FAIRFIELD, { unit: '4C', resident_phone: '1' }), (e) => e instanceof CoiError && e.code === 'missing_token_value' && e.detail === 'resident_name');
  assert.throws(() => resolveAI(FAIRFIELD, { ...UNIT, resident_name: '  ' }), { code: 'missing_token_value' });
  assert.throws(() => resolveAI({ requiredAiTokens: ['{tenant_ssn}'] }, {}), { code: 'unknown_token' });
});

test('certificate holder is separate from additional insured', () => {
  assert.ok(!AI.includes(FAIRFIELD.certHolderCo));
  const r = coiCompliant(good(), FAIRFIELD, AI, '2026-10-21');
  assert.deepEqual(r, { ok: true, reasons: [], missingAi: [], warnings: [] });
});

test('a COI missing one required_ai entity fails', () => {
  const c = good(); c.additionalInsured = c.additionalInsured.filter(x => !/RUIZ/.test(x));
  const r = coiCompliant(c, FAIRFIELD, AI, '2026-10-21');
  assert.equal(r.ok, false);
  assert.deepEqual(r.reasons, ['additional_insured_missing']);
  assert.deepEqual(r.missingAi, ['Ana Ruiz, Apt 4C']);
});

test('a COI expiring yesterday fails; expiring today passes', () => {
  assert.deepEqual(coiCompliant({ ...good(), expiresOn: '2026-10-20' }, FAIRFIELD, AI, '2026-10-21').reasons, ['expired']);
  assert.equal(coiCompliant({ ...good(), expiresOn: '2026-10-21' }, FAIRFIELD, AI, '2026-10-21').ok, true);
});

test('auto and employer\'s liability are checked when the building requires them', () => {
  assert.deepEqual(coiCompliant({ ...good(), autoLimit: '500000' }, FAIRFIELD, AI, '2026-10-21').reasons, ['auto_limit_below_requirement']);
  assert.deepEqual(coiCompliant({ ...good(), elLimit: undefined }, FAIRFIELD, AI, '2026-10-21').reasons, ['employers_liability_below_requirement']);
  const lax = { ...FAIRFIELD, requiredAuto: '0', requiredEl: '0' };
  assert.equal(coiCompliant({ ...good(), autoLimit: undefined, elLimit: undefined }, lax, AI, '2026-10-21').ok, true);
});

test('GL, WC and verification are enforced', () => {
  assert.ok(coiCompliant({ ...good(), glLimit: '999999.99' }, FAIRFIELD, AI, '2026-10-21').reasons.includes('gl_limit_below_requirement'));
  assert.ok(coiCompliant({ ...good(), wcPresent: false }, FAIRFIELD, AI, '2026-10-21').reasons.includes('workers_comp_missing'));
  assert.ok(coiCompliant({ ...good(), status: 'pending', verifiedAt: null }, FAIRFIELD, AI, '2026-10-21').reasons.includes('not_verified'));
});

test('lead-time gate: 3 business days before work fails, 4 passes (weekends skipped)', () => {
  const work = '2026-11-06'; // Friday
  assert.equal(coiSubmittedInTime('2026-11-02T15:00:00Z', work, FAIRFIELD), true);  // Mon = 4 business days before
  assert.equal(coiSubmittedInTime('2026-11-03T09:00:00Z', work, FAIRFIELD), false); // Tue = 3 business days before
  const monWork = '2026-11-09';                                                       // Monday
  assert.equal(coiSubmittedInTime('2026-11-03', monWork, FAIRFIELD), true);           // Tue, 4 business days back over the weekend
  assert.equal(coiSubmittedInTime('2026-11-04', monWork, FAIRFIELD), false);
  assert.equal(coiSubmittedInTime(null, work, FAIRFIELD), false);
  assert.equal(coiSubmittedInTime('2026-11-05', work, { ...FAIRFIELD, coiLeadDays: null }), true);
  assert.equal(coiSubmittedInTime('2026-11-02', work, { ...FAIRFIELD, coiLeadIsBusinessDays: false }), true); // calendar: Nov 2 = work - 4
  assert.equal(coiSubmittedInTime('2026-11-03', work, { ...FAIRFIELD, coiLeadIsBusinessDays: false }), false);
});
