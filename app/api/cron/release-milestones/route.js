import { route, json } from '@/lib/api';
import { requireCron } from '@/lib/cron';
import { releaseDueMilestones } from '@/lib/payments/release';
import { stripe } from '@/lib/payments/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Every 15 minutes. Safe to overlap or re-run: atomic claim + idempotency key ms_<id>.
export const POST = route(async ({ request }) => {
  requireCron(request);
  return json({ ok: true, summary: await releaseDueMilestones({ stripe: stripe() }) });
});
