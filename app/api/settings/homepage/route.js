import { route, json } from '@/lib/api';
import { getSiteSettings } from '@/lib/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public — marketing copy only. Never project replyToEmail/adminNotifyEmail here.
export const GET = route(async () => {
  const { ledgerProjects, ledgerOverruns, ledgerTurnaround } = await getSiteSettings();
  return json({ ledgerProjects, ledgerOverruns, ledgerTurnaround });
});
