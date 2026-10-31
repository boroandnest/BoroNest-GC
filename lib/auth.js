// Auth primitives: password hashing, server-side sessions, magic-link tokens.
// Raw tokens only ever live in the cookie / email link; the DB stores SHA-256 hashes.
import crypto from 'crypto';
import { getCollection } from './mongo.js';

const SESSION_COOKIE = 'bn_session';
const SESSION_TTL_MS = 14 * 86400000;      // 14 days
const MAGIC_LINK_TTL_MS = 15 * 60000;      // 15 minutes

export const STAFF_ROLE = 'bn_staff';
// Roles that must be approved by B&N staff before getting workspace access.
export const REVIEWED_ROLES = ['expediter', 'subcontractor'];

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');
const randomToken = () => crypto.randomBytes(32).toString('base64url');

// ---------- passwords (scrypt, no extra deps) ----------
export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  if (!stored || typeof password !== 'string') return false;
  const [scheme, saltHex, keyHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(actual, expected);
}

// A fixed, never-matching hash scrypt'd at startup. AUTH_PASSWORD_SPEC_1
// test #2 requires "unknown email" and "wrong password" to take the same
// time — verifyPassword only does the expensive scrypt work when a
// passwordHash exists, so a lookup that short-circuits on a missing user or
// missing hash is a timing side-channel an attacker can use to enumerate
// accounts. Running verifyPassword against this dummy hash on that path
// costs the same scrypt call without ever being able to succeed.
const DUMMY_HASH = hashPassword(crypto.randomBytes(24).toString('hex'));
export function verifyPasswordConstantTime(password, stored) {
  return verifyPassword(password, stored || DUMMY_HASH) && !!stored;
}

export const MIN_PASSWORD_LENGTH = 12;

// Length over composition rules — short-circuits before the (network) breach
// check so a too-short password never costs a round trip to HIBP.
export function validatePasswordShape(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

// HaveIBeenPwned k-anonymity range query — only a SHA-1 prefix leaves this
// process, never the password itself. This is the one permitted runtime
// external call AUTH_PASSWORD_SPEC_1 §3 allows, and it fails OPEN: a slow or
// unreachable API must never block a legitimate password change.
export async function isPasswordBreached(password, { timeoutMs = 2000 } = {}) {
  try {
    const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, { signal: controller.signal });
      if (!res.ok) return false;
      const text = await res.text();
      return text.split('\n').some(line => line.split(':')[0].trim() === suffix);
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    return false; // network error, timeout, abort — fail open, never block sign-up/reset
  }
}

// ---------- roles ----------
export function isStaff(user) {
  return !!user && (user.role === STAFF_ROLE || user.isStaff === true);
}

// BORO_NEST_AUTH_PASSWORD_SPEC_1.md §4 — a staff/admin session is only as
// good as its second factor. Use this (not isStaff) to gate anything beyond
// what an unenrolled-but-password-verified staff member needs to finish
// enrollment — isStaff alone stays for role/visibility checks that have
// nothing to do with session trust.
export function isStaffVerified(user) {
  return isStaff(user) && user.totpEnabled === true;
}

export function isVerified(user) {
  if (!user) return false;
  if (isStaff(user)) return true;
  return (user.status || 'verified') === 'verified';
}

// ---------- sessions ----------
function cookieAttrs(maxAgeSeconds) {
  const secure = process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true';
  return `Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

export async function createSession(user, request) {
  const token = randomToken();
  const sessions = await getCollection('sessions');
  await sessions.insertOne({
    tokenHash: sha256(token),
    userId: user.id,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    ip: request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
    userAgent: request?.headers.get('user-agent')?.slice(0, 200) || null
  });
  return `${SESSION_COOKIE}=${token}; ${cookieAttrs(SESSION_TTL_MS / 1000)}`;
}

export function clearSessionCookie() {
  // Also clears the legacy cookie name from the pre-hardening build.
  return [`${SESSION_COOKIE}=; ${cookieAttrs(0)}`, 'bn_token=; Path=/; Max-Age=0; SameSite=Lax'];
}

function readSessionToken(request) {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match?.[1] || null;
}

export async function getUserFromRequest(request) {
  try {
    const token = readSessionToken(request);
    if (!token) return null;
    const sessions = await getCollection('sessions');
    const session = await sessions.findOne({ tokenHash: sha256(token) });
    if (!session || session.expiresAt < new Date()) return null;
    const users = await getCollection('users');
    const user = await users.findOne({ id: session.userId });
    if (!user || user.status === 'suspended') return null;
    return user;
  } catch (e) {
    return null;
  }
}

export async function destroySession(request) {
  const token = readSessionToken(request);
  if (!token) return;
  const sessions = await getCollection('sessions');
  await sessions.deleteOne({ tokenHash: sha256(token) });
}

// ---------- password lockout (persistent — survives a restart/redeploy,
// unlike the in-memory rate limiter below, which a new process resets) ----------
const PW_LOCK_THRESHOLD = 10;
const PW_LOCK_COOLDOWN_MS = 15 * 60000;

// Pure function (no I/O) so the state machine is unit-testable without Mongo.
// "never lock permanently" — threshold triggers a cooldown, not a ban; once
// it elapses the next attempt is evaluated fresh.
export function nextLockoutState({ pwFailCount = 0, pwLockedUntil = null }, outcome, now = Date.now()) {
  if (outcome === 'success') return { pwFailCount: 0, pwLockedUntil: null };
  const count = pwFailCount + 1;
  if (count >= PW_LOCK_THRESHOLD) return { pwFailCount: 0, pwLockedUntil: new Date(now + PW_LOCK_COOLDOWN_MS) };
  return { pwFailCount: count, pwLockedUntil: null };
}

export function isLockedOut(user, now = Date.now()) {
  return !!(user?.pwLockedUntil && new Date(user.pwLockedUntil).getTime() > now);
}

export async function recordPasswordFailure(user) {
  if (!user) return;
  const users = await getCollection('users');
  const next = nextLockoutState(user, 'failure');
  await users.updateOne({ id: user.id }, { $set: next });
}

export async function recordPasswordSuccess(user) {
  const users = await getCollection('users');
  await users.updateOne({ id: user.id }, { $set: { pwFailCount: 0, pwLockedUntil: null, lastLoginAt: new Date() } });
}

// ---------- password reset ----------
const RESET_TTL_MS = 30 * 60000;

export async function createPasswordResetToken(user) {
  const token = randomToken();
  const col = await getCollection('password_reset_tokens');
  // Only one live reset per account — a new request supersedes an older one.
  await col.deleteMany({ userId: user.id, usedAt: null });
  await col.insertOne({
    tokenHash: sha256(token),
    userId: user.id,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + RESET_TTL_MS),
    usedAt: null
  });
  return token;
}

export async function consumePasswordResetToken(token) {
  if (!token) return null;
  const col = await getCollection('password_reset_tokens');
  return col.findOneAndUpdate(
    { tokenHash: sha256(token), usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } }
  );
}

export async function invalidatePasswordResetTokens(userId) {
  const col = await getCollection('password_reset_tokens');
  await col.deleteMany({ userId });
}

// ---------- pending second factor (password step passed, TOTP step not yet) ----------
const TOTP_PENDING_TTL_MS = 5 * 60000;

export async function createPendingTotpToken(user) {
  const token = randomToken();
  const col = await getCollection('totp_pending_tokens');
  await col.insertOne({
    tokenHash: sha256(token),
    userId: user.id,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + TOTP_PENDING_TTL_MS),
    usedAt: null
  });
  return token;
}

// Not single-use on its own — a mistyped code shouldn't burn the token and
// force a fresh password entry. The per-IP/email rate limiter on the TOTP
// verify endpoint is what bounds guesses, same as any other 6-digit OTP.
export async function peekPendingTotpToken(token) {
  if (!token) return null;
  const col = await getCollection('totp_pending_tokens');
  const rec = await col.findOne({ tokenHash: sha256(token), usedAt: null, expiresAt: { $gt: new Date() } });
  return rec || null;
}

export async function consumePendingTotpToken(token) {
  const col = await getCollection('totp_pending_tokens');
  await col.updateOne({ tokenHash: sha256(token) }, { $set: { usedAt: new Date() } });
}

// ---------- magic links ----------
export async function createMagicLink(user, next = '/dashboard') {
  const token = randomToken();
  const tokens = await getCollection('login_tokens');
  await tokens.insertOne({
    tokenHash: sha256(token),
    userId: user.id,
    next: safeNext(next),
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + MAGIC_LINK_TTL_MS),
    usedAt: null
  });
  return token;
}

// Single-use: atomically marks the token used and returns it, or null.
export async function consumeMagicLink(token) {
  if (!token) return null;
  const tokens = await getCollection('login_tokens');
  const rec = await tokens.findOneAndUpdate(
    { tokenHash: sha256(token), usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } }
  );
  return rec || null;
}

// Only allow same-site relative redirects.
export function safeNext(next) {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/dashboard';
  return next;
}

// ---------- rate limiting (in-memory, per process) ----------
const buckets = new Map();
export function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}

export function clientIp(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

// AUTH_PASSWORD_SPEC_1.md §3: "5/min per IP and 10/hour per email", applied
// to every sign-in attempt (password or link) and to the TOTP step.
export function loginRateLimited(ip, email) {
  return !rateLimit(`login-ip:${ip}`, 5, 60000) || !rateLimit(`login-email:${email}`, 10, 3600000);
}
export function totpRateLimited(ip, email) {
  return !rateLimit(`totp-ip:${ip}`, 5, 60000) || !rateLimit(`totp-email:${email}`, 10, 3600000);
}

// ---------- admin bootstrap ----------
// Creates/updates the B&N staff admin from env. The password never lives in the repo.
let adminEnsured = false;
export async function ensureAdmin() {
  if (adminEnsured) return;
  adminEnsured = true;
  const email = (process.env.ADMIN_EMAIL || 'admin@boroandnestnyc.com').toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD;
  const users = await getCollection('users');
  const existing = await users.findOne({ email });

  const set = { role: STAFF_ROLE, isStaff: true, status: 'verified' };
  if (password) {
    if (!existing?.passwordHash || !verifyPassword(password, existing.passwordHash)) {
      set.passwordHash = hashPassword(password);
    }
  } else {
    console.warn('[auth] ADMIN_PASSWORD is not set — admin password login is disabled.');
  }

  if (existing) {
    await users.updateOne({ email }, { $set: set, $unset: { token: '' } });
  } else {
    await users.insertOne({
      id: crypto.randomUUID(),
      email,
      name: 'B&N Admin',
      phone: '',
      company: 'Boro & Nest Collective',
      onboardingComplete: true,
      profile: { title: 'Administrator' },
      createdAt: new Date(),
      ...set
    });
  }
}

// Indexes for auth collections (idempotent). TTL indexes purge expired rows.
let indexesEnsured = false;
export async function ensureAuthIndexes() {
  if (indexesEnsured) return;
  indexesEnsured = true;
  const [sessions, tokens, users, resetTokens, totpPending] = await Promise.all([
    getCollection('sessions'), getCollection('login_tokens'), getCollection('users'),
    getCollection('password_reset_tokens'), getCollection('totp_pending_tokens')
  ]);
  await Promise.all([
    sessions.createIndex({ tokenHash: 1 }, { unique: true }),
    sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    tokens.createIndex({ tokenHash: 1 }, { unique: true }),
    tokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    users.createIndex({ email: 1 }, { unique: true }),
    users.createIndex({ id: 1 }, { unique: true }),
    resetTokens.createIndex({ tokenHash: 1 }, { unique: true }),
    resetTokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    totpPending.createIndex({ tokenHash: 1 }, { unique: true }),
    totpPending.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  ]).catch(e => console.warn('[auth] index creation:', e.message));
  // Old builds stored a reusable bearer token on each user. Remove it everywhere.
  await users.updateMany({ token: { $exists: true } }, { $unset: { token: '' } }).catch(() => {});
}
