import { getCollection } from '@/lib/mongo';
import { route, json, readJson, requireStaff } from '@/lib/api';
import { createBuilding } from '@/lib/coi/buildings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async ({ user }) => {
  requireStaff(user);
  const buildings = await (await getCollection('buildings')).find({}).sort({ name: 1 }).limit(500).toArray();
  return json({ buildings });
});

export const POST = route(async ({ request, user }) => {
  requireStaff(user);
  return json({ building: await createBuilding(await readJson(request), user) }, 201);
});
