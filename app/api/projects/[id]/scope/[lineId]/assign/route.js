import { route, json, readJson, requireStaff, loadProject } from '@/lib/api';
import { assignSubToLine } from '@/lib/coi/gate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST { subUserId | null } — the assignment gate (lib/coi/gate.js).
export const POST = route(async ({ request, user, params }) => {
  requireStaff(user);
  const { project } = await loadProject(user, params.id);
  const { subUserId } = await readJson(request);
  const line = await assignSubToLine({ project, lineId: params.lineId, subUserId, user, role: 'bn_staff' });
  return json({ ok: true, assignedSub: line.assignedSub, assignedCoiId: line.assignedCoiId || null });
});
