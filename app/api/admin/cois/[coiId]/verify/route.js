import { getCollection } from '@/lib/mongo';
import { route, json, readJson, requireStaff, HttpError } from '@/lib/api';
import { logEvent } from '@/lib/access';
import { round2 } from '@/lib/money';
import { toDecimal128 } from '@/lib/money-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST { status: 'verified' | 'rejected', note?, corrections?: { glLimit, autoLimit, elLimit, wcPresent,
//        additionalInsured, expiresOn, effectiveOn, certHolderText } }
// Staff read the actual ACORD and correct what the trade typed before verifying.
export const POST = route(async ({ request, user, params }) => {
  requireStaff(user);
  const body = await readJson(request);
  if (!['verified', 'rejected'].includes(body.status)) throw new HttpError(422, 'status must be verified or rejected');
  const cois = await getCollection('cois');
  const coi = await cois.findOne({ id: params.coiId });
  if (!coi) throw new HttpError(404, 'Not found');
  const set = { status: body.status, reviewNote: String(body.note || '').slice(0, 1000) };
  const c = body.corrections || {};
  for (const k of ['glLimit', 'autoLimit', 'elLimit']) if (c[k] !== undefined && c[k] !== '') set[k] = toDecimal128(round2(c[k]));
  if (c.wcPresent !== undefined) set.wcPresent = !!c.wcPresent;
  if (Array.isArray(c.additionalInsured)) set.additionalInsured = c.additionalInsured.map(x => String(x).trim()).filter(Boolean);
  for (const k of ['expiresOn', 'effectiveOn']) if (c[k]) set[k] = String(c[k]);
  if (c.certHolderText !== undefined) set.certHolderText = String(c.certHolderText);
  if (body.status === 'verified') Object.assign(set, { verifiedAt: new Date(), verifiedBy: user.id });
  await cois.updateOne({ id: coi.id }, { $set: set, ...(body.status === 'rejected' ? { $unset: { verifiedAt: '', verifiedBy: '' } } : {}) });
  await logEvent(coi.projectId, user, 'bn_staff', body.status === 'verified' ? 'coi_verified' : 'coi_rejected', { coiId: coi.id });
  return json({ ok: true });
});
