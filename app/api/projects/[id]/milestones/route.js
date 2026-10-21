import { getCollection } from '@/lib/mongo';
import { route, json, readJson, requireStaff, loadProject } from '@/lib/api';
import { createMilestone, milestoneView } from '@/lib/payments/milestones';
import { projectMilestones } from '@/lib/visibility';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET — clients / management / staff see every milestone; a sub sees only milestones paid to them;
// other roles see progress without money.
export const GET = route(async ({ user, params }) => {
  const { project, access } = await loadProject(user, params.id, { hide: true });
  const list = await (await getCollection('milestones')).find({ projectId: project.id }).sort({ seq: 1, dueDate: 1 }).toArray();
  const viewer = { role: access.role, trades: access.trades, email: user.email, id: user.id };
  return json({ milestones: projectMilestones(list.map(m => milestoneView(m)), viewer), viewerRole: access.role });
});

// POST — staff create { title, trigger, amount, payeeId?, dueDate? }. No payee = client-to-B&N draw.
export const POST = route(async ({ request, user, params }) => {
  requireStaff(user);
  const { project } = await loadProject(user, params.id);
  return json({ milestone: milestoneView(await createMilestone({ project, input: await readJson(request), user })) }, 201);
});
