// Shared helpers for the end-to-end API suites. Server must run with AUTH_DEV_LINKS=true.
import assert from 'node:assert/strict';
import { MongoClient } from 'mongodb';

export const BASE = process.env.BASE_URL || 'http://localhost:3000';
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@boroandnestnyc.com';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
export const RUN = Date.now().toString(36);
let seq = 0;

// A signed-in API client. `call` returns { status, json, text, headers }.
export function session(cookie = '', ip = `10.20.${seq % 250}.${(seq * 7) % 250}`) {
  const s = {
    cookie,
    async call(path, { method = 'GET', body, headers = {}, raw = false } = {}) {
      const isForm = body instanceof FormData;
      const res = await fetch(BASE + path, {
        method,
        redirect: 'manual',
        headers: { 'x-forwarded-for': ip, ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}), ...(s.cookie ? { cookie: s.cookie } : {}), ...headers },
        body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined
      });
      for (const c of res.headers.getSetCookie?.() || []) if (c.startsWith('bn_session=')) s.cookie = c.split(';')[0];
      if (raw) return res;
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch {}
      return { status: res.status, json, text, headers: res.headers };
    }
  };
  return s;
}

export async function admin() {
  if (!ADMIN_PASSWORD) throw new Error('Set ADMIN_PASSWORD');
  const s = session();
  const r = await s.call('/api/auth/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  assert.equal(r.status, 200, `admin login: ${r.text}`);
  return s;
}

// Signs up a new user of `role` and redeems their magic link. Returns { email, user, ...session }.
export async function member(role, profile = {}) {
  const s = session();
  const email = `${role}-${RUN}-${++seq}@example.com`;
  const r = await s.call('/api/auth/signup', { method: 'POST', body: { email, name: `${role} ${seq}`, role, profile } });
  assert.equal(r.status, 200, `signup ${role}: ${r.text}`);
  const token = new URL(r.json.devLink, BASE).searchParams.get('token');
  const cb = await s.call('/api/auth/callback', { method: 'POST', body: { token } });
  assert.equal(cb.status, 200, `callback: ${cb.text}`);
  const me = await s.call('/api/auth/me');
  return Object.assign(s, { email, user: me.json.user });
}

export async function verify(adminS, m) {
  const r = await adminS.call(`/api/admin/users/${m.user.id}/status`, { method: 'POST', body: { status: 'verified' } });
  assert.equal(r.status, 200, r.text);
}

// Staff creates a project and adds members (accepted). members: [{ m, role, scopeTrades? }]
export async function projectWith(adminS, { client, members = [], ...fields }) {
  const r = await adminS.call('/api/projects', { method: 'POST', body: { name: `P2 ${RUN} ${++seq}`, address: '1 Test St', gmpCeiling: 100000, ...fields, clientEmail: client?.email || fields.clientEmail } });
  assert.equal(r.status, 200, r.text);
  const project = r.json.project;
  for (const { m, role, scopeTrades } of members) {
    const inv = await adminS.call(`/api/projects/${project.id}/invite`, { method: 'POST', body: { email: m.email, role, scopeTrades } });
    assert.equal(inv.status, 200, inv.text);
    const mine = (await m.call('/api/invitations')).json.invitations.find(i => i.projectId === project.id);
    const acc = await m.call(`/api/invitations/${mine.id}/accept`, { method: 'POST' });
    assert.equal(acc.status, 200, acc.text);
  }
  return project;
}

// Direct database handle, for proving rules are enforced by MongoDB itself.
export async function db() {
  const client = await MongoClient.connect(process.env.MONGO_URL || 'mongodb://127.0.0.1:27017');
  return { client, db: client.db(process.env.DB_NAME) };
}

export function harness() {
  const results = [];
  return {
    async test(name, fn) {
      try { await fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name, e.message.split('\n').slice(0, 6).join('\n')]); }
    },
    finish() {
      for (const [s, n, e] of results) console.log(`${s}  ${n}${e ? `\n      ${e}` : ''}`);
      const failed = results.filter(r => r[0] === 'FAIL').length;
      console.log(`\n${results.length - failed}/${results.length} passed`);
      process.exit(failed ? 1 : 0);
    }
  };
}
