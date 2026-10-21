import { getCollection } from '@/lib/mongo';
import { route, json, readJson, requireStaff, loadProject } from '@/lib/api';
import { createChangeOrder } from '@/lib/co/core';
import { projectChangeOrderList } from '@/lib/co/project';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/projects/:id/changes — every member, projected server-side by role (lib/co/project.js).
export const GET = route(async ({ user, params }) => {
  const { project, access } = await loadProject(user, params.id, { hide: true });
  const list = await (await getCollection('change_orders')).find({ projectId: project.id }).sort({ number: -1 }).toArray();
  const viewer = { role: access.role, trades: access.trades };
  return json({ changeOrders: projectChangeOrderList(list, viewer), viewerRole: access.role, canCreate: access.role === 'bn_staff' });
});

// POST /api/projects/:id/changes — staff create. Linked lines are blocked until signed or void.
export const POST = route(async ({ request, user, params }) => {
  requireStaff(user);
  const { project } = await loadProject(user, params.id);
  const co = await createChangeOrder({ project, input: await readJson(request), user });
  return json({ changeOrder: co }, 201);
});
