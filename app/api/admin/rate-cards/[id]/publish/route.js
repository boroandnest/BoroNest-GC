import { route, json, requireStaff } from '@/lib/api';
import { publishCard } from '@/lib/quote/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route(async ({ user, params }) => {
  requireStaff(user);
  return json({ card: await publishCard(params.id) });
});
