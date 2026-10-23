import { route, json, requireStaff } from '@/lib/api';
import { listCards } from '@/lib/quote/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async ({ user }) => {
  requireStaff(user);
  return json({ cards: await listCards() });
});
