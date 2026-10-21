import { getCollection } from '@/lib/mongo';
import { route, json, readJson, requireStaff, HttpError } from '@/lib/api';
import { saveable } from '@/lib/templates/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function load(id) {
  const t = await (await getCollection('scope_templates')).findOne({ id: String(id) });
  if (!t) throw new HttpError(404, 'Template not found');
  return t;
}

export const GET = route(async ({ user, params }) => {
  requireStaff(user);
  return json({ template: await load(params.id) });
});

// PUT replaces params + tasks atomically (one document), after full graph validation.
export const PUT = route(async ({ request, user, params }) => {
  requireStaff(user);
  await load(params.id);
  const doc = saveable(await readJson(request));
  await (await getCollection('scope_templates')).updateOne({ id: params.id }, { $set: { ...doc, updatedBy: user.id } });
  return json({ template: await load(params.id) });
});

export const DELETE = route(async ({ user, params }) => {
  requireStaff(user);
  await (await getCollection('scope_templates')).deleteOne({ id: String(params.id) });
  return json({ ok: true });
});
