import { route, json, readJson, requireStaff, loadProject } from '@/lib/api';
import { voidChangeOrder } from '@/lib/co/core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route(async ({ request, user, params }) => {
  requireStaff(user);
  const { project } = await loadProject(user, params.id);
  const { reason } = await readJson(request);
  const co = await voidChangeOrder({ project, coId: params.coId, reason, user });
  return json({ ok: true, status: co.status });
});
