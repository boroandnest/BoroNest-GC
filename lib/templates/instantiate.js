// Template -> scope lines. Pure: returns the lines; the API persists them.
// line money (all lib/money, all Decimal):
//   baseCost       = round2(quantity * unitCost)
//   tariffExposure = round2(baseCost * tariffPct / 100)
//   lineTotal      = baseCost + tariffExposure        <- tariff is IN the line total, not added at display
import { v4 as uuid } from 'uuid';
import { lineTotal as moneyLineTotal, tariffExposure, round2, toMoney } from '../money.js';
import { resolveParams, expandTasks } from './params.js';
import { scheduleTasks } from './schedule.js';

export function priceLine(quantity, unitCost, tariffPct) {
  const baseCost = moneyLineTotal(quantity, unitCost || 0);
  const exposure = tariffExposure(baseCost, tariffPct || 0);
  return { baseCost, tariffExposure: exposure, lineTotal: round2(baseCost.plus(exposure)) };
}

// existing: current scope lines for this project created from a template (re-instantiation keeps
// their ids, status, assignments and blocks; only quantities, money and dates are recomputed).
export function instantiate({ template, inputs = {}, projectId, startDate, existing = [], now = new Date() }) {
  const { values } = resolveParams(template, inputs);
  const tasks = expandTasks(template, values);
  const schedule = scheduleTasks(tasks, startDate);
  const prior = new Map(existing.filter(l => l.templateTaskKey).map(l => [l.templateTaskKey, l]));

  const lines = tasks.map((t, i) => {
    const money = priceLine(t.quantity, t.unitCost, t.tariffPct);
    const slot = schedule.get(t.key);
    const keep = prior.get(t.key);
    return {
      id: keep?.id || uuid(),
      projectId,
      seq: i + 1,
      trade: String(t.trade).toLowerCase(),
      title: t.title,
      description: t.description || '',
      unit: t.unit || '',
      quantity: t.quantity,
      unitCost: round2(toMoney(t.unitCost || 0)),
      tariffPct: toMoney(t.tariffPct || 0).toDecimalPlaces(2),
      ...money,
      isAllowance: !!t.isAllowance,
      specifiedMfr: t.specifiedMfr || '',
      specifiedProduct: t.specifiedProduct || '',
      sourcingOrigin: t.sourcingOrigin || '',
      altDomesticMfr: t.altDomesticMfr || '',
      costUpdated: t.costUpdated ? new Date(t.costUpdated) : null,
      templateId: template.id,
      templateTaskKey: t.key,
      dependsOn: t.dependsOn || [],
      needsInspection: !!t.needsInspection,
      inspectionLeadDays: Math.trunc(+t.inspectionLeadDays || 0),
      ...slot,
      status: keep?.status || 'not_started',
      ...(keep ? {} : { createdAt: now }),
      updatedAt: now
    };
  });
  const keys = new Set(tasks.map(t => t.key));
  const removed = existing.filter(l => l.templateTaskKey && !keys.has(l.templateTaskKey));
  return { lines, removed, values };
}
