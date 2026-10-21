import { route, json, readJson, requireStaff, loadProject } from '@/lib/api';
import { resolveDispute, milestoneView } from '@/lib/payments/milestones';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST { note } — staff resolve; the next release run pays if the window has passed.
export const POST = route(async ({ request, user, params }) => {
  requireStaff(user);
  const { project } = await loadProject(user, params.id);
  const { note } = await readJson(request);
  return json({ milestone: milestoneView(await resolveDispute({ project, milestoneId: params.mid, user, note })) });
});
