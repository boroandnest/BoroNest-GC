// Template persistence: converts validated templates to/from their Mongo shape.
// Numbers are stored as Decimal128 (exact); API responses carry them as strings.
import { Decimal128 } from 'mongodb';
import { toDecimal128Exact } from '../money-storage.js';
import { round2, toMoney } from '../money.js';
import { validateTemplate, QTY_DP } from './params.js';

const dec = (v, dp) => (v === undefined || v === null || v === '' ? undefined : toDecimal128Exact(dp === undefined ? toMoney(v) : toMoney(v).toDecimalPlaces(dp)));
const int = (v, dflt) => (v === undefined || v === null || v === '' ? dflt : Math.max(0, Math.trunc(+v)));

// Validates (throws TemplateError) and returns the document fields to store.
export function toTemplateDoc(input, { now = new Date() } = {}) {
  const { params, tasks } = validateTemplate(input);
  const doc = {
    name: String(input.name || '').trim().slice(0, 200),
    scopeType: String(input.scopeType || '').slice(0, 60),
    description: String(input.description || '').slice(0, 2000),
    params: params.map(p => clean({
      name: p.name, kind: p.kind, label: p.label.slice(0, 200), unit: String(p.unit || '').slice(0, 20), seq: p.seq,
      defaultVal: p.kind === 'input' ? toDecimal128Exact(p.defaultVal) : undefined,
      constVal: p.kind === 'constant' ? toDecimal128Exact(p.constVal) : undefined,
      formula: p.kind === 'calculated' ? p.formula : undefined
    })),
    tasks: tasks.map(t => clean({
      key: t.key, seq: t.seq,
      trade: String(t.trade).toLowerCase().slice(0, 60), title: String(t.title).slice(0, 200),
      description: String(t.description || '').slice(0, 2000), unit: String(t.unit || '').slice(0, 10),
      quantityFormula: t.quantityFormula ? String(t.quantityFormula) : undefined,
      quantity: t.quantityFormula ? undefined : dec(t.quantity, QTY_DP),
      unitCost: dec(t.unitCost === undefined ? undefined : round2(t.unitCost)),
      tariffPct: dec(t.tariffPct ?? 0, 2),
      sourcingOrigin: t.sourcingOrigin ? String(t.sourcingOrigin).slice(0, 60) : undefined,
      specifiedMfr: t.specifiedMfr ? String(t.specifiedMfr).slice(0, 120) : undefined,
      specifiedProduct: t.specifiedProduct ? String(t.specifiedProduct).slice(0, 200) : undefined,
      altDomesticMfr: t.altDomesticMfr ? String(t.altDomesticMfr).slice(0, 120) : undefined,
      dependsOn: t.dependsOn,
      productionRate: dec(t.productionRate, QTY_DP),
      crewSize: t.crewSize === undefined ? undefined : Math.max(1, int(t.crewSize, 1)),
      durationDays: t.durationDays === undefined ? undefined : int(t.durationDays, 1),
      needsInspection: !!t.needsInspection,
      inspectionLeadDays: int(t.inspectionLeadDays, 0),
      costUpdated: t.costUpdated ? new Date(t.costUpdated) : now
    })),
    updatedAt: now
  };
  if (!doc.name) throw Object.assign(new Error('Template needs a name'), { code: 'invalid_template' });
  for (const t of doc.tasks) if (t.costUpdated && isNaN(t.costUpdated)) throw Object.assign(new Error(`Task "${t.key}" has an invalid costUpdated date`), { code: 'invalid_task' });
  return doc;
}

// Stored doc -> plain template (Decimal128 -> string) usable by lib/templates/* pure functions.
export function fromTemplateDoc(doc) {
  const plain = (v) => (v instanceof Decimal128 ? v.toString() : v);
  return {
    ...doc,
    params: (doc.params || []).map(p => ({ ...p, defaultVal: plain(p.defaultVal), constVal: plain(p.constVal) })),
    tasks: (doc.tasks || []).map(t => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, plain(v)])))
  };
}

function clean(o) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}
