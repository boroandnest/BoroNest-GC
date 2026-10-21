import { getCollection } from '@/lib/mongo';
import { route, json, readJson, HttpError } from '@/lib/api';
import { logEvent } from '@/lib/access';
import { buildingAccess } from '@/lib/compliance/access';
import { CLOSURE_STEPS, EVIDENCE_STATUSES } from '@/lib/compliance/density';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PATCH { step: workCompletedAt|clientAcceptedAt|certifiedFiledAt|agencyClosedAt, at?: ISO | null,
//         evidenceStatus?, note? }
// Staff record any step; the client / management company may only record their own acceptance.
// Each step is its own timestamp — finishing work never closes the violation.
export const PATCH = route(async ({ request, user, params }) => {
  const { building, role } = await buildingAccess(user, params.id);
  const body = await readJson(request);
  const set = {};
  if (body.step !== undefined) {
    if (!CLOSURE_STEPS.includes(body.step)) throw new HttpError(422, 'unknown step');
    if (role !== 'bn_staff' && body.step !== 'clientAcceptedAt') throw new HttpError(403, 'Only Boro & Nest records this step');
    set[body.step] = body.at === null ? null : body.at ? new Date(body.at) : new Date();
  }
  if (body.evidenceStatus !== undefined) {
    if (role !== 'bn_staff') throw new HttpError(403, 'Only Boro & Nest sets evidence status');
    if (!EVIDENCE_STATUSES.includes(body.evidenceStatus)) throw new HttpError(422, 'unknown evidence status');
    set.evidenceStatus = body.evidenceStatus;
  }
  if (!Object.keys(set).length) throw new HttpError(422, 'nothing to update');
  const r = await (await getCollection('violations')).updateOne({ id: params.vid, buildingId: building.id }, { $set: set });
  if (!r.matchedCount) throw new HttpError(404, 'Not found');
  await logEvent(null, user, role, 'violation_updated', { buildingId: building.id, violationId: params.vid, ...Object.fromEntries(Object.keys(set).map(k => [k, true])) });
  return json({ ok: true });
});
