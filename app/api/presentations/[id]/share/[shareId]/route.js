import { route, json, requireStaff } from '@/lib/api';
import { revokeShare } from '@/lib/presentations/shares';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Revoking takes effect immediately: the next request with that token resolves
// to nothing, the same as an unknown one.
export const DELETE = route(async ({ user, params }) => {
  requireStaff(user);
  const share = await revokeShare({ shareId: params.shareId, user });
  return json({ share: { ...share, tokenHash: undefined, _id: undefined } });
});
