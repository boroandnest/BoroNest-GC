import { route, json, requireStaff, loadProject } from '@/lib/api';
import { retryRelease } from '@/lib/payments/milestones';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route(async ({ user, params }) => {
  requireStaff(user);
  const { project } = await loadProject(user, params.id);
  await retryRelease({ project, milestoneId: params.mid, user });
  return json({ ok: true });
});
