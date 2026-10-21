// Schedule generation: a DAG walk, not a constraint solver.
//   duration   = ceil(quantity / (productionRate * crewSize)) business days (durationDays overrides; min 1)
//   start      = first business day after every predecessor ends, plus the predecessor's
//                inspectionLeadDays (business days) when that predecessor needsInspection
//   weekends are skipped; holidays are a documented gap (lib/dates.js)
import { Decimal, toMoney } from '../money.js';
import { rollForward, addBusinessDays } from '../dates.js';

export function taskDuration(t) {
  if (t.durationDays !== undefined && t.durationDays !== null && t.durationDays !== '') return Math.max(1, Math.trunc(+t.durationDays));
  const rate = t.productionRate ? toMoney(t.productionRate) : null;
  if (!rate || rate.lessThanOrEqualTo(0)) return 1;
  const crew = toMoney(t.crewSize || 1);
  const days = toMoney(t.quantity || 0).dividedBy(rate.times(crew)).ceil();
  return Math.max(1, parseInt(days.toString(), 10));
}

// tasks: [{ key, quantity, productionRate, crewSize, durationDays, dependsOn, needsInspection, inspectionLeadDays }]
// Returns Map(key -> { plannedStart, plannedEnd, durationDays }). Throws on unknown deps or cycles.
export function scheduleTasks(tasks, startDate) {
  const byKey = new Map(tasks.map(t => [t.key, t]));
  const out = new Map();
  const visiting = new Set();
  const first = rollForward(startDate);

  function place(key) {
    if (out.has(key)) return out.get(key);
    if (visiting.has(key)) throw new Error(`task cycle at ${key}`);
    const t = byKey.get(key);
    if (!t) throw new Error(`unknown task ${key}`);
    visiting.add(key);
    let start = first;
    for (const depKey of t.dependsOn || []) {
      const dep = byKey.get(depKey);
      const d = place(depKey);
      let earliest = addBusinessDays(d.plannedEnd, 1);
      if (dep.needsInspection) earliest = addBusinessDays(earliest, Math.max(0, Math.trunc(+dep.inspectionLeadDays || 0)));
      if (earliest > start) start = earliest;
    }
    const durationDays = taskDuration(t);
    const slot = { plannedStart: start, plannedEnd: addBusinessDays(start, durationDays - 1), durationDays };
    visiting.delete(key);
    out.set(key, slot);
    return slot;
  }

  for (const t of tasks) place(t.key);
  return out;
}

export { Decimal };
