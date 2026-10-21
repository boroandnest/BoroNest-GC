import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTemplate, resolveParams, expandTasks, TemplateError } from './params.js';

// 3 inputs, 1 constant, 2 calculated. `wall_area` is listed BEFORE `perimeter`, which it depends on,
// so a naive in-order evaluation would fail; resolution must follow the dependency graph.
const ROOM = {
  params: [
    { name: 'Wall Area', kind: 'calculated', label: 'Wall area', formula: 'perimeter * height' },
    { name: 'Length', kind: 'input', label: 'Length', defaultVal: '12' },
    { name: 'Width', kind: 'input', label: 'Width', defaultVal: '10' },
    { name: 'Height', kind: 'input', label: 'Ceiling height', defaultVal: '9' },
    { name: 'Waste', kind: 'constant', label: 'Waste factor', constVal: '1.1' },
    { name: 'Perimeter', kind: 'calculated', label: 'Perimeter', formula: '2 * (length + width)' }
  ],
  tasks: [
    { key: 'drywall', trade: 'carpentry', title: 'Drywall', quantityFormula: 'round(wall_area * waste / 32, 0)', unit: 'sheet' },
    { key: 'paint', trade: 'painting', title: 'Paint walls', quantityFormula: 'wall_area', unit: 'sqft', dependsOn: ['drywall'] }
  ]
};

test('3 inputs, 1 constant and 2 calculated params resolve in dependency order', () => {
  const { values, order } = resolveParams(ROOM);
  assert.ok(order.indexOf('perimeter') < order.indexOf('wall_area'));
  assert.equal(values.get('perimeter').toString(), '44');
  assert.equal(values.get('wall_area').toString(), '396');
  const tasks = expandTasks(ROOM, values);
  assert.deepEqual(tasks.map(t => [t.key, t.quantity.toString()]), [['drywall', '14'], ['paint', '396']]);
});

test('inputs override defaults and change every dependent value', () => {
  const { values } = resolveParams(ROOM, { Length: '20' });
  assert.equal(values.get('perimeter').toString(), '60');
  assert.equal(values.get('wall_area').toString(), '540');
});

test('a cycle is rejected at save, naming both params', () => {
  const t = {
    params: [
      { name: 'l', kind: 'input', label: 'L', defaultVal: '2' },
      { name: 'area', kind: 'calculated', label: 'Area', formula: 'l * h' },
      { name: 'h', kind: 'calculated', label: 'H', formula: 'area / l' }
    ],
    tasks: []
  };
  assert.throws(() => validateTemplate(t), (e) => {
    assert.ok(e instanceof TemplateError);
    assert.equal(e.code, 'param_cycle');
    assert.match(e.message, /area/);
    assert.match(e.message, /\bh\b/);
    assert.deepEqual([...e.meta.cycle].sort(), ['area', 'h']);
    return true;
  });
});

test('self-reference is a cycle', () => {
  assert.throws(() => validateTemplate({ params: [{ name: 'x', kind: 'calculated', label: 'x', formula: 'x + 1' }], tasks: [] }), { code: 'param_cycle' });
});

test('a calculated formula referencing an undefined name is rejected at save', () => {
  const t = { params: [{ name: 'area', kind: 'calculated', label: 'Area', formula: 'length * width' }, { name: 'length', kind: 'input', label: 'L', defaultVal: '1' }], tasks: [] };
  assert.throws(() => validateTemplate(t), (e) => e.code === 'undefined_reference' && e.meta.reference === 'width');
});

test('task quantity formulas must reference params', () => {
  assert.throws(() => validateTemplate({ params: [], tasks: [{ key: 'a', trade: 't', title: 'A', quantityFormula: 'rooms * 2' }] }), { code: 'undefined_reference' });
});

test('names are unique after normalization', () => {
  const t = { params: [{ name: 'Total SqFt', kind: 'input', label: 'a', defaultVal: '1' }, { name: 'total_sqft', kind: 'input', label: 'b', defaultVal: '1' }], tasks: [] };
  assert.throws(() => validateTemplate(t), { code: 'duplicate_name' });
});

test('kind fields are enforced', () => {
  assert.throws(() => validateTemplate({ params: [{ name: 'a', kind: 'input', label: 'a' }], tasks: [] }), { code: 'param_kind_fields' });
  assert.throws(() => validateTemplate({ params: [{ name: 'a', kind: 'constant', label: 'a', constVal: '1', formula: '2' }], tasks: [] }), { code: 'param_kind_fields' });
  assert.throws(() => validateTemplate({ params: [{ name: 'a', kind: 'calculated', label: 'a' }], tasks: [] }), { code: 'param_kind_fields' });
});

test('only input params can be set by the caller', () => {
  assert.throws(() => resolveParams(ROOM, { waste: '2' }), { code: 'not_an_input' });
  assert.throws(() => resolveParams(ROOM, { nope: '2' }), { code: 'unknown_input' });
});

test('task dependency cycles are rejected at save', () => {
  const t = { params: [], tasks: [
    { key: 'a', trade: 't', title: 'A', quantity: '1', dependsOn: ['b'] },
    { key: 'b', trade: 't', title: 'B', quantity: '1', dependsOn: ['a'] }
  ] };
  assert.throws(() => validateTemplate(t), { code: 'task_cycle' });
});

test('division by zero inside a param surfaces as an evaluation error, not zero', () => {
  const t = { params: [{ name: 'n', kind: 'input', label: 'n', defaultVal: '0' }, { name: 'per', kind: 'calculated', label: 'per', formula: '100 / n' }], tasks: [] };
  assert.throws(() => resolveParams(t), (e) => e.code === 'evaluation_failed' && e.meta.formulaError === 'division_by_zero');
});
