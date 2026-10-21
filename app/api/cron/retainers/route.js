import { route, json } from '@/lib/api';
import { requireCron } from '@/lib/cron';
import { runRetainerClose } from '@/lib/billing/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Daily: generate due retainer periods (idempotent) and apply measurable guarantees to ended periods.
export const POST = route(async ({ request }) => {
  requireCron(request);
  return json({ ok: true, summary: await runRetainerClose() });
});
