import { route, json } from '@/lib/api';
import { requireCron } from '@/lib/cron';
import { runCoiSweep } from '@/lib/coi/sweep';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Nightly. Safe to run more than once a day (idempotent per certificate per tier).
export const POST = route(async ({ request }) => {
  requireCron(request);
  return json({ ok: true, summary: await runCoiSweep() });
});
