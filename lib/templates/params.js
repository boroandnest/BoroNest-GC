// Parametric scope templates: validation and resolution. Pure — no database.
//
// A template has params of three kinds:
//   input       caller-supplied, with a default         (defaultVal)
//   constant    fixed value                              (constVal)
//   calculated  a formula over other params              (formula)
// and tasks whose quantity is a formula over those params (quantityFormula).
//
// Everything that can be wrong with the graph is rejected at SAVE time (validateTemplate):
// bad names, duplicate names, undefined references, and cycles. Evaluation reuses lib/formula.js.
import { Decimal, toMoney } from '../money.js';
import { compileFormula, evaluateFormula, normalizeName, FormulaError } from '../formula.js';

export const QTY_DP = 4; // numeric(14,4); also keeps every stored value inside Decimal128's 34 digits

export class TemplateError extends Error {
  constructor(code, message, meta = {}) {
    super(message);
    this.name = 'TemplateError';
    this.code = code;
    this.meta = meta;
  }
}

const KINDS = ['input', 'constant', 'calculated'];
const present = (v) => v !== undefined && v !== null && v !== '';

function checkDecimal(v, what) {
  try { return toMoney(v); } catch { throw new TemplateError('invalid_number', `${what} is not a number`); }
}

// Kahn's algorithm. deps: Map(name -> Set(names it depends on)). Ties broken by `rank` (seq order).
// Returns the order, or throws with the names of one cycle.
function topoSort(names, deps, rank, label) {
  const indeg = new Map(names.map(n => [n, 0]));
  const users = new Map(names.map(n => [n, []]));
  for (const n of names) for (const d of deps.get(n)) { indeg.set(n, indeg.get(n) + 1); users.get(d).push(n); }
  const ready = names.filter(n => indeg.get(n) === 0).sort((a, b) => rank.get(a) - rank.get(b));
  const order = [];
  while (ready.length) {
    const n = ready.shift();
    order.push(n);
    for (const u of users.get(n)) {
      indeg.set(u, indeg.get(u) - 1);
      if (indeg.get(u) === 0) { ready.push(u); ready.sort((a, b) => rank.get(a) - rank.get(b)); }
    }
  }
  if (order.length === names.length) return order;
  // Find and name one cycle among the remaining nodes.
  const stuck = new Set(names.filter(n => !order.includes(n)));
  let start = [...stuck][0];
  const path = [];
  const seen = new Map();
  while (!seen.has(start)) {
    seen.set(start, path.length);
    path.push(start);
    start = [...deps.get(start)].find(d => stuck.has(d));
  }
  const cycle = [...path.slice(seen.get(start)), start];
  throw new TemplateError(`${label}_cycle`, `${label === 'param' ? 'Parameters' : 'Tasks'} form a cycle: ${cycle.join(' → ')}`, { cycle: [...new Set(cycle)] });
}

// Validates a whole template ({ params, tasks }) and returns a normalized copy plus the param order.
export function validateTemplate({ params = [], tasks = [] }) {
  if (!Array.isArray(params) || !Array.isArray(tasks)) throw new TemplateError('invalid_template', 'params and tasks must be arrays');

  // ---- params ----
  const byName = new Map();
  const outParams = params.map((p, i) => {
    const name = normalizeName(p.name);
    if (!name) throw new TemplateError('invalid_name', `Parameter #${i + 1} needs a name made of letters or digits`);
    if (byName.has(name)) throw new TemplateError('duplicate_name', `Two parameters normalize to "${name}"`, { params: [byName.get(name).rawName, p.name] });
    if (!KINDS.includes(p.kind)) throw new TemplateError('invalid_kind', `Parameter "${name}" has unknown kind "${p.kind}"`);
    const q = { name, rawName: p.name, kind: p.kind, label: String(p.label || p.name), unit: p.unit || '', seq: p.seq ?? i };
    if (p.kind === 'input') {
      if (!present(p.defaultVal) || present(p.formula)) throw new TemplateError('param_kind_fields', `Input "${name}" needs a default value and no formula`);
      q.defaultVal = checkDecimal(p.defaultVal, `Default for "${name}"`).toDecimalPlaces(QTY_DP);
    } else if (p.kind === 'constant') {
      if (!present(p.constVal) || present(p.formula)) throw new TemplateError('param_kind_fields', `Constant "${name}" needs a value and no formula`);
      q.constVal = checkDecimal(p.constVal, `Value of "${name}"`).toDecimalPlaces(QTY_DP);
    } else {
      if (!present(p.formula)) throw new TemplateError('param_kind_fields', `Calculated "${name}" needs a formula`);
      q.formula = String(p.formula);
    }
    byName.set(name, q);
    return q;
  });

  const deps = new Map();
  for (const p of outParams) {
    if (p.kind !== 'calculated') { deps.set(p.name, new Set()); continue; }
    let vars;
    try { vars = compileFormula(p.formula).variables; } catch (e) {
      throw new TemplateError('invalid_formula', `Formula for "${p.name}" is invalid: ${e.message}`, { param: p.name, formulaError: e.code });
    }
    for (const v of vars) {
      if (!byName.has(v)) throw new TemplateError('undefined_reference', `"${p.name}" references "${v}", which is not a parameter`, { param: p.name, reference: v });
      if (v === p.name) throw new TemplateError('param_cycle', `"${p.name}" refers to itself`, { cycle: [p.name] });
    }
    deps.set(p.name, new Set(vars));
  }
  const rank = new Map(outParams.map(p => [p.name, p.seq]));
  const order = topoSort(outParams.map(p => p.name), deps, rank, 'param');

  // ---- tasks ----
  const keys = new Set();
  const outTasks = tasks.map((t, i) => {
    const key = normalizeName(t.key || t.title);
    if (!key) throw new TemplateError('invalid_task', `Task #${i + 1} needs a key or title`);
    if (keys.has(key)) throw new TemplateError('duplicate_task', `Two tasks share the key "${key}"`);
    keys.add(key);
    if (!t.trade || !t.title) throw new TemplateError('invalid_task', `Task "${key}" needs a trade and a title`);
    const q = { ...t, key, seq: t.seq ?? i, dependsOn: (t.dependsOn || []).map(normalizeName) };
    if (present(t.quantityFormula)) {
      let vars;
      try { vars = compileFormula(String(t.quantityFormula)).variables; } catch (e) {
        throw new TemplateError('invalid_formula', `Quantity formula for task "${key}" is invalid: ${e.message}`, { task: key, formulaError: e.code });
      }
      const missing = vars.find(v => !byName.has(v));
      if (missing) throw new TemplateError('undefined_reference', `Task "${key}" references "${missing}", which is not a parameter`, { task: key, reference: missing });
    } else if (!present(t.quantity)) {
      throw new TemplateError('invalid_task', `Task "${key}" needs a quantity or a quantity formula`);
    }
    return q;
  });
  const taskDeps = new Map();
  for (const t of outTasks) {
    for (const d of t.dependsOn) if (!keys.has(d)) throw new TemplateError('undefined_dependency', `Task "${t.key}" depends on unknown task "${d}"`);
    taskDeps.set(t.key, new Set(t.dependsOn));
  }
  const taskRank = new Map(outTasks.map(t => [t.key, t.seq]));
  const taskOrder = topoSort(outTasks.map(t => t.key), taskDeps, taskRank, 'task');

  return { params: outParams, tasks: outTasks, order, taskOrder };
}

// Resolves every param to a Decimal, in dependency order. `inputs` may override input params only.
export function resolveParams(template, inputs = {}) {
  const { params, order } = validateTemplate(template);
  const byName = new Map(params.map(p => [p.name, p]));
  const given = new Map();
  for (const [k, v] of Object.entries(inputs || {})) {
    const name = normalizeName(k);
    const p = byName.get(name);
    if (!p) throw new TemplateError('unknown_input', `"${k}" is not a parameter of this template`);
    if (p.kind !== 'input') throw new TemplateError('not_an_input', `"${name}" is a ${p.kind} parameter and cannot be set`);
    given.set(name, checkDecimal(v, `Input "${name}"`).toDecimalPlaces(QTY_DP));
  }
  const values = new Map();
  for (const name of order) {
    const p = byName.get(name);
    if (p.kind === 'input') values.set(name, given.get(name) ?? p.defaultVal);
    else if (p.kind === 'constant') values.set(name, p.constVal);
    else {
      try {
        values.set(name, evaluateFormula(p.formula, Object.fromEntries(values)).toDecimalPlaces(QTY_DP, Decimal.ROUND_HALF_UP));
      } catch (e) {
        if (e instanceof FormulaError) throw new TemplateError('evaluation_failed', `Could not calculate "${name}": ${e.message}`, { param: name, formulaError: e.code });
        throw e;
      }
    }
  }
  return { values, order };
}

// Expands task quantities from resolved values. Returns tasks (in dependency order) with `quantity` as Decimal.
export function expandTasks(template, values) {
  const { tasks, taskOrder } = validateTemplate(template);
  const byKey = new Map(tasks.map(t => [t.key, t]));
  const scope = Object.fromEntries(values);
  return taskOrder.map(key => {
    const t = byKey.get(key);
    let quantity;
    try {
      quantity = present(t.quantityFormula) ? evaluateFormula(String(t.quantityFormula), scope) : toMoney(t.quantity);
    } catch (e) {
      if (e instanceof FormulaError) throw new TemplateError('evaluation_failed', `Could not calculate quantity for "${key}": ${e.message}`, { task: key, formulaError: e.code });
      throw e;
    }
    return { ...t, quantity: quantity.toDecimalPlaces(QTY_DP, Decimal.ROUND_HALF_UP) };
  });
}
