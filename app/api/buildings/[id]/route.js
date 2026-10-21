import { getCollection } from '@/lib/mongo';
import { route, json, readJson, requireStaff, HttpError } from '@/lib/api';
import { buildingFields } from '@/lib/coi/buildings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async ({ user, params }) => {
  requireStaff(user);
  const b = await (await getCollection('buildings')).findOne({ id: params.id });
  if (!b) throw new HttpError(404, 'Not found');
  const projects = await (await getCollection('projects')).find({ buildingId: b.id }, { projection: { id: 1, name: 1, code: 1, unitContext: 1 } }).toArray();
  return json({ building: b, projects });
});

export const PUT = route(async ({ request, user, params }) => {
  requireStaff(user);
  const col = await getCollection('buildings');
  const current = await col.findOne({ id: params.id });
  if (!current) throw new HttpError(404, 'Not found');
  const body = await readJson(request);
  const merged = { ...current, ...body };
  for (const k of ['requiredGl', 'requiredAuto', 'requiredEl']) if (body[k] === undefined) merged[k] = current[k]?.toString();
  await col.updateOne({ id: params.id }, { $set: { ...buildingFields(merged), updatedAt: new Date() } });
  return json({ building: await col.findOne({ id: params.id }) });
});
