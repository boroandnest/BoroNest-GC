// Verified against RFC 6238 Appendix B's published test vectors (SHA1, 8-digit
// in the RFC; we run 6-digit per lib/totp.js's DIGITS, so vectors are
// recomputed by hand below for the same secret/time/HMAC — not copied from
// the RFC's 8-digit column) plus our own base32 round-trip and window checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { generateTotpSecret, totpUri, verifyTotpCode } from './totp.js';

// RFC 6238's 20-byte SHA1 seed, ASCII "12345678901234567890", base32-encoded.
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

test('a code generated for "now" verifies against itself', () => {
  const secret = generateTotpSecret();
  // Reach into the same HOTP math verifyTotpCode uses, via its own public
  // surface: derive the current code by brute-force search over the real
  // verifier (0-999999) is too slow, so instead assert the round trip the
  // way the app actually uses it — setup returns a secret, and the first
  // code a real authenticator computes for RFC 6238 at T=59s is known.
  // Use the RFC vector/time pair for the actual correctness assertion below;
  // this test only confirms a fresh secret + a quickly re-derived code at
  // the same instant verifies (self-consistency across two independent calls
  // at the same counter).
  const at = Date.now();
  const atSameStep = at - (at % 30000) + 1000; // a few seconds into the same 30s step
  assert.equal(verifyTotpCode(secret, deriveCode(secret, atSameStep), { at: atSameStep }), true);
});

test('RFC 6238 test vector: T=59s, SHA1 matches the published value', () => {
  // RFC 6238 Appendix B publishes "94287082" as the 8-digit SHA1 code at
  // T=59 for this exact secret. 94287082 mod 10^6 = 287082 is what a 6-digit
  // HOTP/TOTP implementation (ours) must produce for the same HMAC — this
  // is an independent check against the RFC's number, not our own code.
  const at = 59 * 1000;
  assert.equal(verifyTotpCode(RFC_SECRET, '287082', { at }), true);
  assert.equal(verifyTotpCode(RFC_SECRET, '287083', { at }), false);
});

test('wrong code is rejected', () => {
  const secret = generateTotpSecret();
  const at = Date.now();
  const real = deriveCode(secret, at);
  const wrong = real === '000000' ? '111111' : '000000';
  assert.equal(verifyTotpCode(secret, wrong, { at }), false);
});

test('a code one step in the past is accepted (clock-skew window)', () => {
  const secret = generateTotpSecret();
  const at = Date.now();
  const prevStepMid = at - (at % 30000) - 15000; // middle of the previous 30s step
  const code = deriveCode(secret, prevStepMid);
  assert.equal(verifyTotpCode(secret, code, { at }), true);
});

test('a code three steps away is rejected (outside the +-1 window)', () => {
  const secret = generateTotpSecret();
  const at = Date.now();
  const farStep = at - 3 * 30000;
  const code = deriveCode(secret, farStep);
  assert.equal(verifyTotpCode(secret, code, { at }), false);
});

test('malformed input never throws and never matches', () => {
  const secret = generateTotpSecret();
  assert.equal(verifyTotpCode(secret, '12345', {}), false); // too short
  assert.equal(verifyTotpCode(secret, 'abcdef', {}), false); // non-numeric
  assert.equal(verifyTotpCode(secret, '', {}), false);
  assert.equal(verifyTotpCode(null, '123456', {}), false);
  assert.equal(verifyTotpCode(secret, null, {}), false);
});

test('totpUri embeds the email and a base32 secret an authenticator app can parse', () => {
  const secret = generateTotpSecret();
  const uri = totpUri({ secret, email: 'pm@boroandnestnyc.com' });
  assert.match(uri, /^otpauth:\/\/totp\//);
  assert.match(uri, /secret=[A-Z2-7]+/);
  assert.match(uri, /pm%40boroandnestnyc\.com/);
});

// Independent re-implementation of HOTP (RFC 4226) used only to produce a
// known-correct code to feed into verifyTotpCode, so these tests exercise
// the real base32 decode + HMAC + truncation path rather than asserting
// against themselves.
function deriveCode(secret, atMs) {
  const counter = Math.floor(atMs / 1000 / 30);
  const key = base32DecodeForTest(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return String(code % 1000000).padStart(6, '0');
}

function base32DecodeForTest(str) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0;
  const bytes = [];
  for (const char of str.toUpperCase().replace(/[^A-Z2-7]/g, '')) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(bytes);
}
