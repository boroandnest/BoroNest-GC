import { getCollection } from '@/lib/mongo';
import { route, json, readJson, requireStaff, loadProject, HttpError } from '@/lib/api';
import { setDeliverables } from '@/lib/billing/store';
import { logEvent } from '@/lib/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PATCH { deliverablesMet?: true|false, status?: invoiced|paid|disputed|pending, notes? } — staff.
export const PATCH = route(async ({ request, user, params }) => {
  requireStaff(user);
  const { project } = await loadProject(user, params.id);
  const retainer = await (await getCollection('retainers')).findOne({ id: params.rid, projectId: project.id });
  const periods = await getCollection('retainer_periods');
  const period = retainer && await periods.findOne({ id: params.pid, retainerId: retainer.id });
  if (!period) throw new HttpError(404, 'Not found');
  const body = await readJson(request);
  if (body.deliverablesMet !== undefined) {
    if (typeof body.deliverablesMet !== 'boolean') throw new HttpError(422, 'deliverablesMet must be true or false');
    await setDeliverables({ period, retainer, met: body.deliverablesMet, user, role: 'bn_staff', source: 'manual' });
  }
  const set = {};
  if (body.status !== undefined) {
    if (!['pending', 'invoiced', 'paid', 'disputed'].includes(body.status)) throw new HttpError(422, 'invalid status');
    set.status = body.status;
    if (body.status === 'invoiced') set.invoicedAt = new Date();
    if (body.status === 'paid') set.paidAt = new Date();
  }
  if (body.notes !== undefined) set.notes = String(body.notes).slice(0, 2000);
  if (Object.keys(set).length) {
    await periods.updateOne({ id: period.id }, { $set: set });
    await logEvent(project.id, user, 'bn_staff', 'retainer_period_updated', { periodId: period.id, ...set });
  }
  return json({ ok: true });
});
