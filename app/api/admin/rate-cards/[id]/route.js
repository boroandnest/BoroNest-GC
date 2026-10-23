import { route, json, readJson, requireStaff } from '@/lib/api';
import { getCard, updateCard } from '@/lib/quote/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async ({ user, params }) => {
  requireStaff(user);
  return json({ card: await getCard(params.id) });
});

// Draft-only. lib/quote/store.js refuses this once the card is published.
export const PUT = route(async ({ request, user, params }) => {
  requireStaff(user);
  const body = await readJson(request);
  return json({ card: await updateCard(params.id, body) });
});
