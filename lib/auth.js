// Auth primitives: password hashing, server-side sessions, magic-link tokens.
// Raw tokens only ever live in the cookie / email link; the DB stores SHA-256 hashes.
import crypto from 'crypto';
import { getCollection } from './mongo';

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

// ---------- roles ----------
export function isStaff(user) {
  return !!user && (user.role === STAFF_ROLE || user.isStaff === true);
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
  const [sessions, tokens, users] = await Promise.all([
    getCollection('sessions'), getCollection('login_tokens'), getCollection('users')
  ]);
  await Promise.all([
    sessions.createIndex({ tokenHash: 1 }, { unique: true }),
    sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    tokens.createIndex({ tokenHash: 1 }, { unique: true }),
    tokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    users.createIndex({ email: 1 }, { unique: true }),
    users.createIndex({ id: 1 }, { unique: true })
  ]).catch(e => console.warn('[auth] index creation:', e.message));
  // Old builds stored a reusable bearer token on each user. Remove it everywhere.
  await users.updateMany({ token: { $exists: true } }, { $unset: { token: '' } }).catch(() => {});
}
