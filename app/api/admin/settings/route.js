import { route, json, readJson, requireStaff, str, HttpError } from '@/lib/api';
import { getSiteSettings, updateSiteSettings } from '@/lib/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const GET = route(async ({ user }) => {
  requireStaff(user);
  return json({ settings: await getSiteSettings() });
});

export const PUT = route(async ({ request, user }) => {
  requireStaff(user);
  const body = await readJson(request);
  const patch = {};

  for (const key of ['ledgerProjects', 'ledgerOverruns', 'ledgerTurnaround']) {
    if (key in body) patch[key] = str(body[key], 40);
  }

  for (const key of ['replyToEmail', 'adminNotifyEmail']) {
    if (key in body) {
      const v = str(body[key], 200);
      if (v && !EMAIL_RE.test(v)) throw new HttpError(400, `${key} does not look like a valid email address`);
      patch[key] = v || null;
    }
  }

  return json({ settings: await updateSiteSettings(patch) });
});
