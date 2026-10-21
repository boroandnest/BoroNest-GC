// Allow-listed Decimal formula evaluator for scope-template quantities.
//
//   number | variable | unary + - | binary + - * / | ( ) | round | min | max
//
// The parser deliberately accepts a WIDER grammar (powers, modulo, comparisons, attribute
// access, subscripts, arbitrary calls) so that validate() can walk the tree and reject every
// node kind that is not whitelisted, with a specific reason. Nothing here executes code:
// there is no dynamic code evaluation of any kind. Locked by shared/fixtures/formula.vectors.json.
import { Decimal, toMoney } from './money.js';

export const MAX_LEN = 256;
export const MAX_DEPTH = 16;

export class FormulaError extends Error {
  constructor(code, detail) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'FormulaError';
    this.code = code;
    this.detail = detail;
  }
}

// "Treatment Rooms" -> "treatment_rooms", "2ndFloor" -> "_2ndfloor". ASCII only.
export function normalizeName(raw) {
  const s = String(raw ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return /^[0-9]/.test(s) ? `_${s}` : s;
}

// ---------- tokenizer ----------
const TWO_CHAR = ['**', '<=', '>=', '==', '!='];
const ONE_CHAR = '+-*/%(),.[]<>^';

function tokenize(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === ' ' || ch === '\t' || ch === '\n') { i++; continue; }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      let j = i;
      while (j < src.length && /[0-9]/.test(src[j])) j++;
      if (src[j] === '.') { j++; while (j < src.length && /[0-9]/.test(src[j])) j++; }
      tokens.push({ t: 'num', v: src.slice(i, j) });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      tokens.push({ t: 'name', v: src.slice(i, j) });
      i = j;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (TWO_CHAR.includes(two)) { tokens.push({ t: 'op', v: two }); i += 2; continue; }
    if (ONE_CHAR.includes(ch)) { tokens.push({ t: 'op', v: ch }); i++; continue; }
    throw new FormulaError('syntax_error', `unexpected character '${ch}'`);
  }
  return tokens;
}

// ---------- parser (wide grammar, produces a tree for validation) ----------
function parse(src) {
  const tokens = tokenize(src);
  let pos = 0;
  let depth = 0;
  const peek = () => tokens[pos];
  const isOp = (v) => peek()?.t === 'op' && peek().v === v;
  const expect = (v) => {
    if (!isOp(v)) throw new FormulaError('syntax_error', `expected '${v}'`);
    pos++;
  };
  const enter = () => { if (++depth > MAX_DEPTH) throw new FormulaError('too_deep', `nesting exceeds ${MAX_DEPTH}`); };
  const leave = () => { depth--; };

  function comparison() {
    let left = additive();
    while (['<', '>', '<=', '>=', '==', '!='].includes(peek()?.t === 'op' && peek().v)) {
      const op = tokens[pos++].v;
      left = { k: 'Compare', op, left, right: additive() };
    }
    return left;
  }
  function additive() {
    let left = term();
    while (isOp('+') || isOp('-')) {
      const op = tokens[pos++].v;
      left = { k: 'BinOp', op, left, right: term() };
    }
    return left;
  }
  function term() {
    let left = unary();
    while (isOp('*') || isOp('/') || isOp('%')) {
      const op = tokens[pos++].v;
      left = op === '%' ? { k: 'Mod', left, right: unary() } : { k: 'BinOp', op, left, right: unary() };
    }
    return left;
  }
  function unary() {
    if (isOp('+') || isOp('-')) {
      enter();
      const op = tokens[pos++].v;
      const node = { k: 'UnaryOp', op, operand: unary() };
      leave();
      return node;
    }
    return power();
  }
  function power() {
    const base = postfix();
    if (isOp('**') || isOp('^')) {
      pos++;
      return { k: 'Pow', base, exp: unary() };
    }
    return base;
  }
  function postfix() {
    let node = primary();
    for (;;) {
      if (isOp('.')) {
        pos++;
        const name = peek();
        if (name?.t !== 'name') throw new FormulaError('syntax_error', 'expected attribute name');
        pos++;
        node = { k: 'Attribute', value: node, attr: name.v };
      } else if (isOp('[')) {
        pos++; enter();
        const index = comparison();
        leave(); expect(']');
        node = { k: 'Subscript', value: node, index };
      } else if (isOp('(')) {
        pos++; enter();
        const args = [];
        if (!isOp(')')) {
          args.push(comparison());
          while (isOp(',')) { pos++; args.push(comparison()); }
        }
        leave(); expect(')');
        node = { k: 'Call', func: node, args };
      } else {
        return node;
      }
    }
  }
  function primary() {
    const tok = peek();
    if (!tok) throw new FormulaError('syntax_error', 'unexpected end of formula');
    if (tok.t === 'num') { pos++; return { k: 'Num', v: tok.v }; }
    if (tok.t === 'name') { pos++; return { k: 'Name', id: tok.v }; }
    if (isOp('(')) {
      pos++; enter();
      const node = comparison();
      leave(); expect(')');
      return node;
    }
    throw new FormulaError('syntax_error', `unexpected '${tok.v}'`);
  }

  const tree = comparison();
  if (pos !== tokens.length) throw new FormulaError('syntax_error', `unexpected '${tokens[pos].v}'`);
  return tree;
}

// ---------- validation: whitelist node kinds ----------
const CALLS = { round: [1, 2], min: [1, Infinity], max: [1, Infinity] };
const REJECT = {
  Pow: 'power_not_allowed',
  Mod: 'modulo_not_allowed',
  Compare: 'comparison_not_allowed',
  Attribute: 'attribute_not_allowed',
  Subscript: 'subscript_not_allowed'
};

function validate(node, names) {
  switch (node.k) {
    case 'Num':
      return;
    case 'Name':
      names.add(normalizeName(node.id));
      return;
    case 'UnaryOp':
      if (node.op !== '+' && node.op !== '-') throw new FormulaError('operator_not_allowed', node.op);
      return validate(node.operand, names);
    case 'BinOp':
      if (!['+', '-', '*', '/'].includes(node.op)) throw new FormulaError('operator_not_allowed', node.op);
      validate(node.left, names);
      return validate(node.right, names);
    case 'Call': {
      const fn = node.func.k === 'Name' ? node.func.id : null;
      if (!fn || !Object.hasOwn(CALLS, fn)) throw new FormulaError('function_not_allowed', fn || 'expression call');
      const [lo, hi] = CALLS[fn];
      if (node.args.length < lo || node.args.length > hi) throw new FormulaError('bad_arguments', `${fn} takes ${lo === hi ? lo : `${lo}–${hi === Infinity ? 'n' : hi}`} argument(s)`);
      node.args.forEach(a => validate(a, names));
      return;
    }
    default:
      throw new FormulaError(REJECT[node.k] || 'syntax_error', node.k);
  }
}

// Parse + validate. Length is checked before any tokenizing or recursion.
export function compileFormula(src) {
  if (typeof src !== 'string' || !src.trim()) throw new FormulaError('syntax_error', 'empty formula');
  if (src.length > MAX_LEN) throw new FormulaError('too_long', `formula exceeds ${MAX_LEN} characters`);
  let nesting = 0;
  for (const ch of src) {
    if (ch === '(' || ch === '[') nesting++;
    else if (ch === ')' || ch === ']') nesting--;
    if (nesting > MAX_DEPTH) throw new FormulaError('too_deep', `nesting exceeds ${MAX_DEPTH}`);
  }
  const tree = parse(src);
  const names = new Set();
  validate(tree, names);
  return { tree, variables: [...names] };
}

// Variable names a formula references (for dependency graphs). Throws if the formula is invalid.
export function formulaVariables(src) {
  return compileFormula(src).variables;
}

// ---------- evaluation (Decimal only) ----------
function run(node, vars) {
  switch (node.k) {
    case 'Num':
      return new Decimal(node.v);
    case 'Name':
      if (!vars.has(normalizeName(node.id))) throw new FormulaError('unknown_variable', node.id);
      return vars.get(normalizeName(node.id));
    case 'UnaryOp': {
      const v = run(node.operand, vars);
      return node.op === '-' ? v.negated() : v;
    }
    case 'BinOp': {
      const a = run(node.left, vars);
      const b = run(node.right, vars);
      if (node.op === '+') return a.plus(b);
      if (node.op === '-') return a.minus(b);
      if (node.op === '*') return a.times(b);
      if (b.isZero()) throw new FormulaError('division_by_zero');
      return a.dividedBy(b);
    }
    case 'Call': {
      const args = node.args.map(a => run(a, vars));
      if (node.func.id === 'min') return Decimal.min(...args);
      if (node.func.id === 'max') return Decimal.max(...args);
      const places = args[1] ?? new Decimal(0);
      if (!places.isInteger() || places.isNegative() || places.greaterThan(10)) {
        throw new FormulaError('bad_arguments', 'round places must be an integer 0–10');
      }
      return args[0].toDecimalPlaces(parseInt(places.toString(), 10), Decimal.ROUND_HALF_UP);
    }
    default:
      throw new FormulaError('syntax_error', node.k);
  }
}

// evaluateFormula('qty * unit_cost', { qty: '800', unit_cost: '25.13' }) -> Decimal
// Variable keys are normalized with normalizeName, so { 'Unit Cost': … } also matches unit_cost.
export function evaluateFormula(src, vars = {}) {
  const { tree } = compileFormula(src);
  const scope = new Map();
  for (const [k, v] of Object.entries(vars || {})) scope.set(normalizeName(k), toMoney(v));
  return run(tree, scope);
}
