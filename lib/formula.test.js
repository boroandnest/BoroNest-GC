// Formula evaluator suite (application side). Reads shared/fixtures/formula.vectors.json — one test per case.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Decimal } from './money.js';
import { evaluateFormula, normalizeName, formulaVariables, FormulaError, MAX_LEN, MAX_DEPTH } from './formula.js';

const V = JSON.parse(readFileSync(new URL('../shared/fixtures/formula.vectors.json', import.meta.url)));

for (const c of V.normalize) {
  test(`normalize ${JSON.stringify(c.raw)}`, () => assert.equal(normalizeName(c.raw), c.out));
}

for (const c of V.eval) {
  test(`eval ${c.src}`, () => {
    const out = evaluateFormula(c.src, c.vars);
    assert.ok(out instanceof Decimal, 'result is a Decimal');
    assert.ok(out.equals(new Decimal(c.out)), `${out.toString()} != ${c.out}`);
  });
}

for (const c of V.reject) {
  test(`reject ${c.src} (${c.reason})`, () => {
    assert.throws(() => evaluateFormula(c.src, c.vars || {}), (e) => e instanceof FormulaError && e.code === c.reason);
  });
}

// Guardrails (not fixture-driven)
test('300-character formula is rejected before parsing', () => {
  const garbage = '('.repeat(300); // would be a syntax / depth error if it were ever parsed
  assert.equal(garbage.length, 300);
  assert.throws(() => evaluateFormula(garbage), (e) => e.code === 'too_long');
  const valid = Array(75).fill('a').join(' + '); // 297 chars of otherwise valid formula
  assert.ok(valid.length > MAX_LEN);
  assert.throws(() => evaluateFormula(valid, { a: '1' }), (e) => e.code === 'too_long');
});

test(`nesting deeper than ${MAX_DEPTH} is rejected`, () => {
  const deep = '('.repeat(MAX_DEPTH + 1) + '1' + ')'.repeat(MAX_DEPTH + 1);
  assert.throws(() => evaluateFormula(deep), (e) => e.code === 'too_deep');
  const unary = '-'.repeat(MAX_DEPTH + 1) + '1';
  assert.throws(() => evaluateFormula(unary), (e) => e.code === 'too_deep');
  assert.ok(evaluateFormula('('.repeat(MAX_DEPTH) + '1' + ')'.repeat(MAX_DEPTH)).equals(1));
});

test('formulaVariables lists normalized references', () => {
  assert.deepEqual(formulaVariables('round(Total_SqFt / rooms, 0) + max(rooms, 2)').sort(), ['rooms', 'total_sqft']);
});

test('variable keys are normalized on input', () => {
  assert.ok(evaluateFormula('treatment_rooms * 2', { 'Treatment Rooms': '3' }).equals(6));
});
