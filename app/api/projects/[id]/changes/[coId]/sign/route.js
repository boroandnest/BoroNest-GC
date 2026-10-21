import { route, json, readJson, loadProject, HttpError } from '@/lib/api';
import { signChangeOrder } from '@/lib/co/core';
import { serverDerivedIp } from '@/lib/request-ip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SIGNERS = ['client', 'management'];

// POST /api/projects/:id/changes/:coId/sign  { signedName }
// Only the client or management company can sign — not staff, not trades.
// The signature IP is derived from our ingress, never from anything the client sends in the body.
export const POST = route(async ({ request, user, params }) => {
  const { project, access } = await loadProject(user, params.id, { hide: true });
  if (!SIGNERS.includes(access.role)) throw new HttpError(403, 'Only the client or management company can sign change orders');
  const { signedName } = await readJson(request);
  const co = await signChangeOrder({ project, coId: params.coId, signedName, ip: serverDerivedIp(request), user, role: access.role });
  return json({ ok: true, status: co.status, signedAt: co.signedAt, signedName: co.signedName });
});
