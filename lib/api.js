// Small helpers for the Phase 2 route handlers (app/api/**/route.js).
import { NextResponse } from 'next/server';
import { Decimal128 } from 'mongodb';
import { bootstrap } from './server/bootstrap.js';
import { getUserFromRequest, isStaff } from './auth.js';
import { getCollection } from './mongo.js';
import { resolveAccess } from './access.js';

export class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export const json = (data, status = 200) => NextResponse.json(serialize(data), { status });

// Decimal128 -> exact decimal string; strips Mongo _id. Money therefore leaves the server as strings.
export function serialize(v) {
  if (v instanceof Decimal128) return v.toString();
  if (Array.isArray(v)) return v.map(serialize);
  if (v instanceof Date || v === null || typeof v !== 'object') return v;
  if (v._bsontype) return v.toString();
  const out = {};
  for (const [k, val] of Object.entries(v)) if (k !== '_id' && val !== undefined) out[k] = serialize(val);
  return out;
}

export async function readJson(request) {
  try { return await request.json(); } catch { return {}; }
}

export const str = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Wraps a handler: bootstrap, session lookup, HttpError -> JSON response, no stack traces to clients.
// handler({ request, params, user, url }) -> Response
export function route(handler) {
  return async (request, ctx) => {
    try {
      await bootstrap();
      const user = await getUserFromRequest(request);
      const params = ctx?.params ? await ctx.params : {};
      return await handler({ request, params, user, url: new URL(request.url) });
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message, ...(e.extra || {}) }, { status: e.status });
      console.error('API error:', e);
      return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
  };
}

export function requireUser(user) {
  if (!user) throw new HttpError(401, 'Not authenticated');
  return user;
}

export function requireStaff(user) {
  requireUser(user);
  if (!isStaff(user)) throw new HttpError(403, 'Not authorized');
  return user;
}

// Loads a project and the viewer's access. Non-members get 404 for a project they can't see
// only when `hide` is set; otherwise 403 (matches Phase 1 behaviour).
export async function loadProject(user, projectId, { hide = false } = {}) {
  requireUser(user);
  const project = await (await getCollection('projects')).findOne({ id: String(projectId || '') });
  if (!project) throw new HttpError(404, 'Project not found');
  const access = await resolveAccess(user, project);
  if (!access) throw new HttpError(hide ? 404 : 403, hide ? 'Not found' : 'You do not have access to this project');
  return { project, access };
}
