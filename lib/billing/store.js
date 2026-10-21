// Retainer persistence + the monthly close job.
import { v4 as uuid } from 'uuid';
import { getCollection } from '../mongo.js';
import { logEvent } from '../access.js';
import { toDecimal128, toDecimal128Exact } from '../money-storage.js';
import { round2, toMoney, toMoneyString } from '../money.js';
import { today as todayIso, addDays } from '../dates.js';
import { generatePeriods, periodAmount, evaluateGuarantee, validateRetainer, BillingError } from './retainers.js';

const SYSTEM = { id: 'system:billing', role: 'system' };
const plain = (r) => ({ ...r, monthlyAmount: r.monthlyAmount?.toString(), guaranteeCreditPct: r.guaranteeCreditPct?.toString() });

export async function createRetainer({ project, input, user }) {
  const r = {
    id: uuid(), projectId: project.id,
    label: String(input.label || '').trim().slice(0, 120) || 'Retainer',
    monthlyAmount: String(input.monthlyAmount || ''),
    startsOn: String(input.startsOn || ''), endsOn: input.endsOn ? String(input.endsOn) : null,
    billDay: input.billDay === undefined || input.billDay === '' ? null : Math.trunc(+input.billDay),
    guaranteeKind: ['no_violation_growth', 'response_sla'].includes(input.guaranteeKind) ? input.guaranteeKind : null,
    guaranteeMetric: input.guaranteeMetric && typeof input.guaranteeMetric === 'object' ? input.guaranteeMetric : null,
    guaranteeCreditPct: String(input.guaranteeCreditPct || '0')
  };
  if (r.billDay === null && /^\d{4}-\d{2}-(\d{2})$/.test(r.startsOn)) r.billDay = Math.min(28, +r.startsOn.slice(8));
  validateRetainer(r); // throws BillingError
  const doc = { ...r, monthlyAmount: toDecimal128(round2(r.monthlyAmount)), guaranteeCreditPct: toDecimal128Exact(toMoney(r.guaranteeCreditPct).toDecimalPlaces(2)), status: 'active', createdAt: new Date(), createdBy: user.id };
  await (await getCollection('retainers')).insertOne(doc);
  await logEvent(project.id, user, 'bn_staff', 'retainer_created', { retainerId: doc.id, monthly: toMoneyString(round2(r.monthlyAmount)) });
  await generateRetainerPeriods({ retainer: doc });
  return doc;
}

// Upsert every period that has started (plus the current one). Re-running creates nothing new.
export async function generateRetainerPeriods({ retainer, through = addDays(todayIso(), 31) }) {
  const periods = await getCollection('retainer_periods');
  let created = 0;
  for (const p of generatePeriods(plain(retainer), through)) {
    const res = await periods.updateOne(
      { retainerId: retainer.id, periodStart: p.periodStart },
      { $setOnInsert: {
        id: uuid(), retainerId: retainer.id, projectId: retainer.projectId, periodStart: p.periodStart, periodEnd: p.periodEnd,
        baseAmount: toDecimal128(p.baseAmount), amount: toDecimal128(p.baseAmount), creditApplied: toDecimal128(round2(0)),
        status: 'pending', deliverablesMet: null, createdAt: new Date()
      } },
      { upsert: true }
    );
    if (res.upsertedCount) created++;
  }
  return created;
}

// Sets deliverables_met (from the guarantee evaluation or a person) and re-prices the period.
export async function setDeliverables({ period, retainer, met, user, role, source }) {
  const { amount, creditApplied } = periodAmount(plain(retainer), met);
  await (await getCollection('retainer_periods')).updateOne({ id: period.id }, { $set: { deliverablesMet: met, amount: toDecimal128(amount), creditApplied: toDecimal128(creditApplied), deliverablesSource: source, deliverablesSetAt: new Date() } });
  await logEvent(retainer.projectId, user, role, 'retainer_period_closed', { periodId: period.id, deliverablesMet: met, amount: toMoneyString(amount), source });
}

// Monthly close (cron): generate due periods, then evaluate measurable guarantees for ended periods.
export async function runRetainerClose({ today = todayIso() } = {}) {
  const retainers = await (await getCollection('retainers')).find({ status: 'active' }).toArray();
  const periods = await getCollection('retainer_periods');
  const summary = { retainers: retainers.length, created: 0, closed: 0, needsReview: 0 };
  for (const r of retainers) {
    summary.created += await generateRetainerPeriods({ retainer: r, through: addDays(today, 31) });
    if (!r.guaranteeKind) continue;
    const ended = await periods.find({ retainerId: r.id, periodEnd: { $lt: today }, deliverablesMet: null }).toArray();
    if (!ended.length) continue;
    const project = await (await getCollection('projects')).findOne({ id: r.projectId });
    const building = project?.buildingId ? await (await getCollection('buildings')).findOne({ id: project.buildingId }) : null;
    const violations = building ? await (await getCollection('violations')).find({ buildingId: building.id }).toArray() : [];
    for (const p of ended) {
      const met = building ? evaluateGuarantee(plain(r), p, { violations, unitCount: building.unitCountVerified ? building.unitCount : null }) : null;
      if (met === null) { summary.needsReview++; continue; }
      await setDeliverables({ period: p, retainer: r, met, user: SYSTEM, role: 'system', source: 'automatic' });
      summary.closed++;
    }
  }
  return summary;
}

export { BillingError };
