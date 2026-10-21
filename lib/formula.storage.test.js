// Formula suite (storage side). Templates store formula strings and parameter values in MongoDB,
// so every fixture case is pushed through BSON (Decimal128 values, string formulas) — exactly
// what a template save + load does — and must evaluate / reject identically after the round-trip.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BSON } from 'mongodb';
import { Decimal } from './money.js';
import { toDecimal128Exact, fromDecimal128 } from './money-storage.js';
import { evaluateFormula, FormulaError } from './formula.js';

const V = JSON.parse(readFileSync(new URL('../shared/fixtures/formula.vectors.json', import.meta.url)));

function stored({ src, vars = {} }) {
  const doc = { formula: src, params: Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, toDecimal128Exact(v)])) };
  const back = BSON.deserialize(BSON.serialize(doc));
  return { src: back.formula, vars: Object.fromEntries(Object.entries(back.params).map(([k, v]) => [k, fromDecimal128(v)])) };
}

for (const c of V.eval) {
  test(`stored eval ${c.src}`, () => {
    const { src, vars } = stored(c);
    const out = evaluateFormula(src, vars);
    // the result is itself persisted (e.g. as a scope-line quantity) and must survive that too
    const persisted = fromDecimal128(BSON.deserialize(BSON.serialize({ q: toDecimal128Exact(out) })).q);
    assert.ok(persisted.equals(new Decimal(c.out)), `${persisted.toString()} != ${c.out}`);
  });
}

for (const c of V.reject) {
  test(`stored reject ${c.src} (${c.reason})`, () => {
    const { src, vars } = stored(c);
    assert.throws(() => evaluateFormula(src, vars), (e) => e instanceof FormulaError && e.code === c.reason);
  });
}
