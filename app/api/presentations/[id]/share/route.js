import { route, json, readJson, requireStaff, str } from '@/lib/api';
import { createShare, sharesFor, SHARE_TTL_HOURS } from '@/lib/presentations/shares';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async ({ user, params }) => {
  requireStaff(user);
  return json({ shares: await sharesFor(params.id), ttlHours: SHARE_TTL_HOURS });
});

// Issues a link. The plaintext token is in this response and nowhere else,
// ever — only its hash is stored.
export const POST = route(async ({ request, user, params }) => {
  requireStaff(user);
  const b = await readJson(request);
  const { share, token } = await createShare({
    presentationId: params.id,
    user,
    audience: str(b.audience, 200),
    recipientNote: str(b.recipientNote, 500)
  });
  const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  return json({
    share: { ...share, tokenHash: undefined, _id: undefined },
    url: `${base}/p/${token}`,
    expiresAt: share.expiresAt,
    ttlHours: SHARE_TTL_HOURS,
    notice: `This link works for ${SHARE_TTL_HOURS} hours and is shown once. Copy it now.`
  }, 201);
});
