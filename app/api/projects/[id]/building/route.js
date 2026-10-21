import { route, json, readJson, requireStaff, loadProject } from '@/lib/api';
import { attachBuilding } from '@/lib/coi/buildings';
import { logEvent } from '@/lib/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PUT /api/projects/:id/building  { buildingId, unit: { unit, resident_name, resident_phone } }
export const PUT = route(async ({ request, user, params }) => {
  requireStaff(user);
  const { project } = await loadProject(user, params.id);
  const body = await readJson(request);
  const r = await attachBuilding({ projectId: project.id, buildingId: body.buildingId, unit: body.unit || {} });
  await logEvent(project.id, user, 'bn_staff', 'building_attached', { buildingId: body.buildingId || null });
  return json({ requiredAi: r.requiredAi });
});
