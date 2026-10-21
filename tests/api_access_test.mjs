// End-to-end access-control test for the Phase 1 API (PHASE1_BUILD.md §9).
// Runs against a live server started with AUTH_DEV_LINKS=true so magic links come back in responses.
//
//   BASE_URL=http://localhost:3000 ADMIN_EMAIL=… ADMIN_PASSWORD=… node tests/api_access_test.mjs
//
// Never run against production: it creates users and a project.
import assert from 'node:assert/strict';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@boroandnestnyc.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) { console.error('Set ADMIN_PASSWORD'); process.exit(2); }

const run = Date.now().toString(36);
const results = [];

function client() {
  let cookie = '';
  async function call(path, { method = 'GET', body, raw = false, redirect = 'follow' } = {}) {
    const res = await fetch(BASE + path, {
      method,
      redirect,
      // Distinct fake client IP per request so the per-IP rate limits don't trip mid-test.
      headers: { 'x-forwarded-for': `10.9.${run.length}.${Math.floor(Math.random() * 250)}`, ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined
    });
    const set = res.headers.getSetCookie?.() || [];
    for (const c of set) {
      const [pair] = c.split(';');
      if (pair.startsWith('bn_session=')) cookie = pair.endsWith('=') ? '' : pair;
    }
    if (raw) return res;
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, text, headers: res.headers };
  }
  return { call, get cookie() { return cookie; } };
}

async function test(name, fn) {
  try { await fn(); results.push(['PASS', name]); }
  catch (e) { results.push(['FAIL', name, e.message]); }
}

// devLink is /auth/confirm?token=…; the confirm page POSTs the token to /api/auth/callback.
async function redeem(devLink) {
  const token = new URL(devLink, BASE).searchParams.get('token');
  const res = await fetch(BASE + '/api/auth/callback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
  assert.equal(res.status, 200, `callback status ${res.status}`);
  const sessionCookie = res.headers.getSetCookie().find(s => s.startsWith('bn_session='));
  assert.ok(sessionCookie, 'no session cookie from callback');
  assert.match(sessionCookie, /HttpOnly/);
  return { pair: sessionCookie.split(';')[0], redirect: (await res.json()).redirect };
}

let seq = 0;
async function signUpAndSignIn(role, extra = {}) {
  const c = client();
  const email = `${role}-${run}-${++seq}@example.com`;
  const r = await c.call('/api/auth/signup', { method: 'POST', body: { email, name: `Test ${role}`, role, phone: '555', profile: extra } });
  assert.equal(r.status, 200, `signup ${role}: ${r.text}`);
  assert.ok(r.json.devLink, 'devLink missing — start the server with AUTH_DEV_LINKS=true');
  const { pair, redirect } = await redeem(r.json.devLink);
  const me = await fetch(BASE + '/api/auth/me', { headers: { cookie: pair } }).then(r => r.json());
  return { email, link: r.json.devLink, location: redirect, user: me.user, cookiePair: pair, call: (p, o = {}) => fetchWith(pair, p, o), status: r.json.status };
}

async function fetchWith(pair, path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { cookie: pair, ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

const anon = client();
const admin = client();
let project, clientU, subU, repU, outsider;

await test('unauthenticated API calls are rejected', async () => {
  assert.equal((await anon.call('/api/projects')).status, 401);
  assert.equal((await anon.call('/api/subcontractors')).status, 403);
  assert.equal((await anon.call('/api/admin/users')).status, 403);
  assert.equal((await anon.call('/api/projects/proj-lume-cafe/messages', { method: 'POST', body: { body: 'hi' } })).status, 401);
});

await test('logged-out /dashboard redirects to /login?next=', async () => {
  const r = await anon.call('/dashboard', { raw: true, redirect: 'manual' });
  assert.ok([302, 307].includes(r.status));
  assert.match(r.headers.get('location'), /\/login\?next=%2Fdashboard/);
});

await test('admin: wrong password rejected, right password signs in', async () => {
  assert.equal((await admin.call('/api/auth/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: 'wrong-password' } })).status, 401);
  const r = await admin.call('/api/auth/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.user.isStaff, true);
  assert.equal(r.json.user.passwordHash, undefined);
  assert.equal(r.json.redirect, '/admin');
  assert.ok(admin.cookie);
});

await test('email-only login never issues a session (and never for staff)', async () => {
  const r = await anon.call('/api/auth/login', { method: 'POST', body: { email: ADMIN_EMAIL } });
  assert.equal(r.status, 200);
  assert.equal(r.json.devLink, undefined, 'staff must not get a magic link');
  assert.equal(r.json.user, undefined);
  assert.ok(!anon.cookie);
});

await test('client signs up → magic link → lands on /dashboard', async () => {
  clientU = await signUpAndSignIn('client');
  assert.equal(clientU.status, 'verified');
  assert.match(clientU.location, /\/dashboard$/);
});

await test('magic link is single-use', async () => {
  const token = new URL(clientU.link, BASE).searchParams.get('token');
  const r = await anon.call('/api/auth/callback', { method: 'POST', body: { token } });
  assert.equal(r.status, 410);
  // Opening the emailed link (GET) must not redeem it.
  assert.equal((await anon.call('/api/auth/callback?token=' + token)).status, 404);
});

await test('subcontractor signs up → pending → lands on /pending', async () => {
  subU = await signUpAndSignIn('subcontractor', { trades: 'Electrical' });
  assert.equal(subU.status, 'pending');
  assert.match(subU.location, /\/pending$/);
  const list = await subU.call('/api/projects');
  assert.deepEqual(list.json.projects, []);
});

await test('signup cannot self-grant staff', async () => {
  const c = client();
  const r = await c.call('/api/auth/signup', { method: 'POST', body: { email: `x-${run}@boroandnest.co`, role: 'bn_staff' } });
  assert.equal(r.status, 400);
  const r2 = await c.call('/api/auth/signup', { method: 'POST', body: { email: `y-${run}@boronest.co`, role: 'client', profile: { isStaff: true, role: 'bn_staff' } } });
  assert.equal(r2.status, 200);
  const { pair } = await redeem(r2.json.devLink);
  const me = await fetchWith(pair, '/api/auth/me');
  assert.equal(me.json.user.isStaff, false);
  assert.equal(me.json.user.role, 'client');
});

await test('staff creates project, scope lines, invites', async () => {
  repU = await signUpAndSignIn('building-rep');
  outsider = await signUpAndSignIn('client');
  const r = await admin.call('/api/projects', { method: 'POST', body: { name: `Test ${run}`, address: '1 Test St', gmpCeiling: 100000, contingency: 5000, clientEmail: clientU.email } });
  assert.equal(r.status, 200, r.text);
  project = r.json.project;
  assert.match(project.code, /^BN-\d{4}$/);
  for (const line of [
    { trade: 'electrical', title: 'Panel upgrade', unit: 'ea', quantity: 1, unitCost: 4200 },
    { trade: 'electrical', title: 'Recessed lights', unit: 'ea', quantity: 12, unitCost: 180 },
    { trade: 'plumbing', title: 'Rough plumbing', unit: 'ls', quantity: 1, unitCost: 9800 }
  ]) assert.equal((await admin.call(`/api/projects/${project.id}/scope`, { method: 'POST', body: line })).status, 200);
  assert.equal((await admin.call(`/api/projects/${project.id}/invite`, { method: 'POST', body: { email: subU.email, role: 'subcontractor', scopeTrades: 'electrical' } })).status, 200);
  assert.equal((await admin.call(`/api/projects/${project.id}/invite`, { method: 'POST', body: { email: repU.email, role: 'building-rep' } })).status, 200);
});

await test('pending sub cannot accept until staff verifies; staff verifies from admin', async () => {
  const inv = (await subU.call('/api/invitations')).json.invitations.find(i => i.projectId === project.id);
  assert.equal((await subU.call(`/api/invitations/${inv.id}/accept`, { method: 'POST' })).status, 403);
  const pending = (await admin.call('/api/admin/users?status=pending')).json.users;
  assert.ok(pending.some(u => u.email === subU.email));
  assert.equal((await admin.call(`/api/admin/users/${subU.user.id}/status`, { method: 'POST', body: { status: 'verified' } })).status, 200);
  assert.equal((await subU.call(`/api/invitations/${inv.id}/accept`, { method: 'POST' })).status, 200);
  const repInv = (await repU.call('/api/invitations')).json.invitations.find(i => i.projectId === project.id);
  assert.equal((await repU.call(`/api/invitations/${repInv.id}/accept`, { method: 'POST' })).status, 200);
});

await test('client sees GMP, contingency, every scope line with $', async () => {
  const p = await clientU.call(`/api/projects/${project.id}`);
  assert.equal(p.json.project.gmpCeiling, 100000);
  assert.equal(p.json.project.contingency, 5000);
  const s = await clientU.call(`/api/projects/${project.id}/scope`);
  assert.equal(s.json.lines.length, 3);
  // Money is sent as exact decimal strings (Phase 2 T1/T4), never floats.
  assert.ok(s.json.lines.every(l => /^\d+\.\d{2}$/.test(l.unitCost) && /^\d+\.\d{2}$/.test(l.lineTotal)));
});

await test('subcontractor: only own trade lines, no GMP/contingency in the raw response', async () => {
  const p = await subU.call(`/api/projects/${project.id}`);
  assert.equal(p.status, 200);
  for (const k of ['gmpCeiling', 'contingency', 'actualSpend', 'clientEmail', 'shareToken']) assert.ok(!p.text.includes(`"${k}"`), `${k} leaked`);
  const s = await subU.call(`/api/projects/${project.id}/scope`);
  assert.equal(s.json.lines.length, 2);
  assert.ok(s.json.lines.every(l => l.trade === 'electrical' && /^\d+\.\d{2}$/.test(l.unitCost)));
  assert.ok(!s.text.includes('Rough plumbing') && !s.text.includes('9800'));
});

await test('building rep: titles only, zero dollar figures in the raw response', async () => {
  const p = await repU.call(`/api/projects/${project.id}`);
  for (const k of ['gmpCeiling', 'contingency', 'actualSpend', 'costImpact', 'amount']) assert.ok(!p.text.includes(`"${k}"`), `${k} leaked`);
  const s = await repU.call(`/api/projects/${project.id}/scope`);
  assert.equal(s.json.lines.length, 3);
  for (const k of ['unitCost', 'lineTotal']) assert.ok(!s.text.includes(`"${k}"`), `${k} leaked`);
});

await test('non-member is refused', async () => {
  assert.equal((await outsider.call(`/api/projects/${project.id}`)).status, 403);
  assert.equal((await outsider.call(`/api/projects/${project.id}/scope`)).status, 403);
  assert.ok(!(await outsider.call('/api/projects')).json.projects.some(p => p.id === project.id));
});

await test('messages: any member posts; restricted audience hidden from excluded roles; newest last', async () => {
  assert.equal((await subU.call(`/api/projects/${project.id}/messages`, { method: 'POST', body: { body: `open-${run}` } })).status, 200);
  assert.equal((await clientU.call(`/api/projects/${project.id}/messages`, { method: 'POST', body: { body: `private-${run}`, audience: ['client', 'bn_staff'] } })).status, 200);
  const subView = await subU.call(`/api/projects/${project.id}`);
  assert.ok(subView.text.includes(`open-${run}`));
  assert.ok(!subView.text.includes(`private-${run}`));
  const clientView = (await clientU.call(`/api/projects/${project.id}`)).json.messages;
  assert.equal(clientView.at(-1).body, `private-${run}`);
});

await test('role-restricted writes are refused', async () => {
  assert.equal((await subU.call(`/api/projects/${project.id}`, { method: 'PATCH', body: { phase: 'Close-Out' } })).status, 403);
  assert.equal((await subU.call(`/api/projects/${project.id}/change-orders`, { method: 'POST', body: { description: 'x', costImpact: 1 } })).status, 403);
  assert.equal((await subU.call(`/api/projects/${project.id}/scope`, { method: 'POST', body: { trade: 'electrical', title: 'x' } })).status, 403);
  assert.equal((await clientU.call(`/api/projects/${project.id}/invite`, { method: 'POST', body: { email: `z-${run}@example.com`, role: 'client' } })).status, 403);
});

await test('phase change reflects on the project', async () => {
  assert.equal((await admin.call(`/api/projects/${project.id}`, { method: 'PATCH', body: { phase: 'Construction' } })).status, 200);
  assert.equal((await clientU.call(`/api/projects/${project.id}`)).json.project.phase, 'Construction');
});

await test('uploads: project files need access; downloads are access-checked', async () => {
  const fd = () => { const f = new FormData(); f.append('file', new Blob(['%PDF-1.4 test'], { type: 'application/pdf' }), 'test.pdf'); f.append('projectId', project.id); f.append('kind', 'document'); f.append('category', 'Permits'); return f; };
  assert.equal((await anon.call('/api/upload', { method: 'POST', body: fd() })).status, 401);
  assert.equal((await outsider.call('/api/upload', { method: 'POST', body: fd() })).status, 403);
  const up = await clientU.call('/api/upload', { method: 'POST', body: fd() });
  assert.equal(up.status, 200, up.text);
  assert.equal((await anon.call(up.json.url)).status, 403);
  assert.equal((await outsider.call(up.json.url)).status, 403);
  assert.equal((await subU.call(up.json.url)).status, 200);
  const bad = new FormData(); bad.append('file', new Blob(['<script>'], { type: 'text/html' }), 'x.html'); bad.append('projectId', project.id);
  assert.equal((await clientU.call('/api/upload', { method: 'POST', body: bad })).status, 400);
});

await test('photo uploads are stored as compressed WebP (P4)', async () => {
  const sharp = (await import('sharp')).default;
  const png = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#8a7' } }).png().toBuffer();
  const f = new FormData();
  f.append('file', new Blob([png], { type: 'image/png' }), 'site.png');
  f.append('projectId', project.id); f.append('kind', 'photo');
  const up = await clientU.call('/api/upload', { method: 'POST', body: f });
  assert.equal(up.status, 200, up.text);
  const res = await fetch(BASE + up.json.url, { headers: { cookie: '' } });
  assert.equal(res.status, 403, 'photo must not be public');
  const r = await fetch(BASE + up.json.url, { headers: { cookie: clientU.cookiePair } });
  assert.equal(r.headers.get('content-type'), 'image/webp');
});

await test('logout revokes the session server-side', async () => {
  const c = client();
  await c.call('/api/auth/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  const saved = c.cookie;
  await c.call('/api/auth/logout', { method: 'POST' });
  const r = await fetch(BASE + '/api/auth/me', { headers: { cookie: saved } });
  assert.equal(r.status, 401);
});

for (const [s, n, e] of results) console.log(`${s}  ${n}${e ? `\n      ${e}` : ''}`);
const failed = results.filter(r => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
