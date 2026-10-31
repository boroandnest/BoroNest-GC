// Pure-logic pieces of AUTH_PASSWORD_SPEC_1 — the parts of lib/auth.js that
// don't touch Mongo, and so can be unit-tested directly (no DB/HTTP harness
// exists in this repo; the login/reset/TOTP HTTP endpoints these back are
// exercised manually — see the PR description's test matrix).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword, verifyPassword, verifyPasswordConstantTime,
  validatePasswordShape, MIN_PASSWORD_LENGTH,
  nextLockoutState, isLockedOut, safeNext
} from './auth.js';

test('a correct password verifies, a wrong one does not', () => {
  const hash = hashPassword('correct horse battery staple');
  assert.equal(verifyPassword('correct horse battery staple', hash), true);
  assert.equal(verifyPassword('wrong password here', hash), false);
});

test('verifyPasswordConstantTime: real hash, correct password -> true', () => {
  const hash = hashPassword('a perfectly fine passphrase');
  assert.equal(verifyPasswordConstantTime('a perfectly fine passphrase', hash), true);
});

test('verifyPasswordConstantTime: real hash, wrong password -> false', () => {
  const hash = hashPassword('a perfectly fine passphrase');
  assert.equal(verifyPasswordConstantTime('not it', hash), false);
});

test('verifyPasswordConstantTime: no stored hash (unknown account / link-only account) -> false, never throws', () => {
  assert.equal(verifyPasswordConstantTime('anything at all', null), false);
  assert.equal(verifyPasswordConstantTime('anything at all', undefined), false);
});

test('verifyPasswordConstantTime still runs the expensive scrypt path when stored is missing (timing parity)', () => {
  // Not a timing assertion (too flaky in CI) — just confirms the dummy-hash
  // branch is taken rather than an early return, by checking it costs
  // roughly the same order of magnitude as a real verify, not ~0ms.
  const hash = hashPassword('reference');
  const t0 = process.hrtime.bigint();
  verifyPassword('reference', hash);
  const realMs = Number(process.hrtime.bigint() - t0) / 1e6;

  const t1 = process.hrtime.bigint();
  verifyPasswordConstantTime('reference', null);
  const dummyMs = Number(process.hrtime.bigint() - t1) / 1e6;

  // Same cost function (scrypt N=16384) either way, so these should be
  // within the same order of magnitude — a 50x gap would mean a short-circuit crept back in.
  assert.ok(dummyMs > realMs / 10, `expected dummy-path cost (${dummyMs}ms) to be comparable to a real verify (${realMs}ms)`);
});

test('validatePasswordShape rejects under 12 characters, accepts 12+', () => {
  assert.equal(validatePasswordShape('short'), `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  assert.equal(validatePasswordShape('elevenchars'), `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  assert.equal(validatePasswordShape('twelvecharss'), null);
  assert.equal(validatePasswordShape('Password1!'), `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`); // composition alone doesn't save a short password
});

test('validatePasswordShape imposes no composition rule on a long password', () => {
  assert.equal(validatePasswordShape('all lowercase words no symbols at all'), null);
});

test('nextLockoutState: failures accumulate, success resets', () => {
  let state = { pwFailCount: 0, pwLockedUntil: null };
  for (let i = 1; i < 9; i++) {
    state = nextLockoutState(state, 'failure');
    assert.equal(state.pwFailCount, i);
    assert.equal(state.pwLockedUntil, null);
  }
  state = nextLockoutState(state, 'success');
  assert.deepEqual(state, { pwFailCount: 0, pwLockedUntil: null });
});

test('nextLockoutState: the 10th consecutive failure locks for a cooldown, not forever', () => {
  let state = { pwFailCount: 9, pwLockedUntil: null };
  const now = Date.now();
  state = nextLockoutState(state, 'failure', now);
  assert.equal(state.pwFailCount, 0); // counter resets so a later failure doesn't instantly re-lock
  assert.ok(state.pwLockedUntil instanceof Date);
  assert.ok(state.pwLockedUntil.getTime() > now, 'lock must be in the future');
  assert.ok(state.pwLockedUntil.getTime() <= now + 20 * 60000, 'cooldown must be bounded, not permanent');
});

test('isLockedOut reflects pwLockedUntil against the given clock', () => {
  const now = Date.now();
  assert.equal(isLockedOut({ pwLockedUntil: new Date(now + 60000) }, now), true);
  assert.equal(isLockedOut({ pwLockedUntil: new Date(now - 60000) }, now), false);
  assert.equal(isLockedOut({ pwLockedUntil: null }, now), false);
  assert.equal(isLockedOut({}, now), false);
  assert.equal(isLockedOut(null, now), false);
});

test('safeNext only allows same-site relative paths', () => {
  assert.equal(safeNext('/dashboard/subcontractor'), '/dashboard/subcontractor');
  assert.equal(safeNext('https://evil.example/phish'), '/dashboard');
  assert.equal(safeNext('//evil.example'), '/dashboard');
  assert.equal(safeNext('/ok\\..\\escape'), '/dashboard');
  assert.equal(safeNext(null), '/dashboard');
});
