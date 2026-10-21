import { getCollection } from '@/lib/mongo';
import { route, json, loadProject, HttpError } from '@/lib/api';
import { computeDensity } from '@/lib/compliance/density';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET — AEP density for the project's building. Client, management and staff only; subs see none of it.
export const GET = route(async ({ user, params }) => {
  const { project, access } = await loadProject(user, params.id, { hide: true });
  if (!['client', 'management', 'bn_staff'].includes(access.role)) throw new HttpError(404, 'Not found');
  if (!project.buildingId) return json({ building: null, density: null });
  const building = await (await getCollection('buildings')).findOne({ id: project.buildingId });
  const violations = await (await getCollection('violations')).find({ buildingId: project.buildingId }).toArray();
  return json({ building: { id: building.id, name: building.name }, density: computeDensity(building, violations) });
});
