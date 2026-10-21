// Cron endpoints are called by an external scheduler (see .github/workflows/cron.yml) with
// `Authorization: Bearer $CRON_SECRET`. Constant-time comparison; disabled when the secret is unset.
import crypto from 'crypto';
import { HttpError } from './api.js';

export function requireCron(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new HttpError(503, 'CRON_SECRET is not configured');
  const given = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(given), b = Buffer.from(secret);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new HttpError(401, 'Unauthorized');
}
