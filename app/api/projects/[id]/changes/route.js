import { getCollection } from '@/lib/mongo';
import { route, json, readJson, requireStaff, loadProject } from '@/lib/api';
import { createChangeOrder } from '@/lib/co/core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/projects/:id/changes — staff list (role-projected views for other parties: T7)
export const GET = route(async ({ user, params }) => {
  const { project } = await loadProject(user, params.id);
  requireStaff(user);
  const list = await (await getCollection('change_orders')).find({ projectId: project.id }).sort({ number: -1 }).toArray();
  return json({ changeOrders: list });
});

// POST /api/projects/:id/changes — staff create. Linked lines are blocked until signed or void.
export const POST = route(async ({ request, user, params }) => {
  requireStaff(user);
  const { project } = await loadProject(user, params.id);
  const co = await createChangeOrder({ project, input: await readJson(request), user });
  return json({ changeOrder: co }, 201);
});
