import { v4 as uuid } from 'uuid';
import { getCollection } from '@/lib/mongo';
import { route, json, readJson, requireStaff } from '@/lib/api';
import { saveable } from '@/lib/templates/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Templates are internal pricing IP: every handler is staff-only. Non-staff get 403 and no rows.

// GET /api/templates
export const GET = route(async ({ user }) => {
  requireStaff(user);
  const list = await (await getCollection('scope_templates'))
    .find({}, { projection: { id: 1, name: 1, scopeType: 1, description: 1, updatedAt: 1, 'tasks.key': 1, 'params.name': 1 } })
    .sort({ updatedAt: -1 }).limit(500).toArray();
  return json({ templates: list.map(t => ({ ...t, taskCount: t.tasks?.length || 0, paramCount: t.params?.length || 0, tasks: undefined, params: undefined })) });
});

// POST /api/templates  { name, scopeType, description, params: [...], tasks: [...] }
// The whole parameter graph is validated here — cycles and undefined references are rejected at save.
export const POST = route(async ({ request, user }) => {
  requireStaff(user);
  const body = await readJson(request);
  const doc = saveable(body);
  const now = new Date();
  const record = { id: uuid(), ...doc, createdAt: now, createdBy: user.id };
  await (await getCollection('scope_templates')).insertOne(record);
  return json({ template: record }, 201);
});
