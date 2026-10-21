import { getCollection } from '@/lib/mongo';
import { route, json } from '@/lib/api';
import { billingProject } from '@/lib/billing/http';
import { toMoney, toMoneyString } from '@/lib/money';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const m = (v) => (v === undefined || v === null ? null : toMoneyString(toMoney(v)));

// GET — retainers, periods (with any guarantee credit shown) and material pass-throughs.
export const GET = route(async ({ user, params }) => {
  const { project, access } = await billingProject(user, params.id);
  const [retainers, periods, passthroughs] = await Promise.all([
    (await getCollection('retainers')).find({ projectId: project.id }).sort({ startsOn: 1 }).toArray(),
    (await getCollection('retainer_periods')).find({ projectId: project.id }).sort({ periodStart: 1 }).toArray(),
    (await getCollection('material_passthroughs')).find({ projectId: project.id }).sort({ periodStart: 1, createdAt: 1 }).toArray()
  ]);
  return json({
    viewerRole: access.role,
    retainers: retainers.map(r => ({ ...r, monthlyAmount: m(r.monthlyAmount), guaranteeCreditPct: r.guaranteeCreditPct?.toString(), createdBy: undefined })),
    periods: periods.map(p => ({ ...p, baseAmount: m(p.baseAmount), amount: m(p.amount), creditApplied: m(p.creditApplied), label: retainers.find(r => r.id === p.retainerId)?.label })),
    passthroughs: passthroughs.map(({ invoiceFileId, createdBy, ...x }) => ({ ...x, cost: m(x.cost), billed: m(x.billed), markupPct: x.markupPct?.toString(), hasInvoice: !!invoiceFileId }))
  });
});
