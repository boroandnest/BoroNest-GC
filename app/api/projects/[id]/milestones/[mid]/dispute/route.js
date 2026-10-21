import { route, json, readJson, loadProject, HttpError } from '@/lib/api';
import { openDispute, milestoneView } from '@/lib/payments/milestones';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST { reason } — client or management company, inside the 24h window only. Pauses release.
export const POST = route(async ({ request, user, params }) => {
  const { project, access } = await loadProject(user, params.id, { hide: true });
  if (!['client', 'management'].includes(access.role)) throw new HttpError(403, 'Only the client can dispute a milestone');
  const { reason } = await readJson(request);
  return json({ milestone: milestoneView(await openDispute({ project, milestoneId: params.mid, user, role: access.role, reason })) });
});
