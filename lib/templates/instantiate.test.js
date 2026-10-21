import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { instantiate, priceLine } from './instantiate.js';
import { scheduleTasks, taskDuration } from './schedule.js';
import { toMoneyString } from '../money.js';

// A 20-task commercial build-out template.
export const BUILDOUT = JSON.parse(readFileSync(new URL('../../shared/fixtures/buildout.template.json', import.meta.url)));

const q = (lines) => Object.fromEntries(lines.map(l => [l.templateTaskKey, l.quantity.toString()]));

test('20-task template instantiates with quantities from parameters', () => {
  const { lines } = instantiate({ template: BUILDOUT, projectId: 'p', startDate: '2026-11-02' });
  assert.equal(lines.length, 20);
  const got = q(lines);
  assert.equal(got.demo, '1400');
  assert.equal(got.framing, '144');            // 4 rooms * 36
  assert.equal(got.blocking, '24');
  assert.equal(got.hvac_duct, '44');            // round(1400/32)
  assert.equal(got.fire_alarm, '8');
  assert.equal(got.insulation, '2880');         // 144 * 10 * 2
  assert.equal(got.drywall, '99');              // round(2880 * 1.1 / 32) = round(99.0)
  assert.equal(got.paint, '3168');
  assert.equal(got.flooring, '1540');
  assert.equal(got.doors, '6');
  assert.equal(toMoneyString(lines.find(l => l.templateTaskKey === 'framing').lineTotal), '5472.00');
});

test('changing one input and re-instantiating changes every dependent line, and only those', () => {
  const first = instantiate({ template: BUILDOUT, projectId: 'p', startDate: '2026-11-02' });
  const again = instantiate({ template: BUILDOUT, projectId: 'p', startDate: '2026-11-02', inputs: { treatment_rooms: '6' }, existing: first.lines });
  const a = q(first.lines), b = q(again.lines);
  const dependsOnRooms = ['framing', 'blocking', 'rough_plumb', 'fire_alarm', 'insulation', 'drywall', 'tape', 'paint', 'doors', 'fixtures', 'hvac_units'];
  for (const k of dependsOnRooms) assert.notEqual(a[k], b[k], `${k} should change`);
  for (const k of Object.keys(a).filter(k => !dependsOnRooms.includes(k))) assert.equal(a[k], b[k], `${k} should not change`);
  // identity is preserved across re-instantiation
  assert.deepEqual(again.lines.map(l => l.id), first.lines.map(l => l.id));
});

test('tariff is folded into line_total at instantiation', () => {
  const p = priceLine('800', '25.13', '25');
  assert.equal(toMoneyString(p.baseCost), '20104.00');
  assert.equal(toMoneyString(p.tariffExposure), '5026.00');
  assert.equal(toMoneyString(p.lineTotal), '25130.00');
  const t = { id: 't', params: [], tasks: [{ key: 'tile', trade: 'tile', title: 'Tile', quantity: '800', unitCost: '25.13', tariffPct: '25' }] };
  const [line] = instantiate({ template: t, projectId: 'p', startDate: '2026-11-02' }).lines;
  assert.equal(toMoneyString(line.lineTotal), '25130.00');
});

test('schedule respects depends_on, inspection lead days and weekends', () => {
  const tasks = [
    { key: 'a', quantity: '1', durationDays: 3, needsInspection: true, inspectionLeadDays: 2 },
    { key: 'b', quantity: '100', productionRate: '25', crewSize: 2, dependsOn: ['a'] },
    { key: 'c', quantity: '1', durationDays: 1, dependsOn: ['b'] },
    { key: 'd', quantity: '1', durationDays: 1 }
  ];
  const s = scheduleTasks(tasks, '2026-11-02'); // Monday
  assert.deepEqual(s.get('a'), { plannedStart: '2026-11-02', plannedEnd: '2026-11-04', durationDays: 3 });
  // a ends Wed; next business day Thu + 2 business days of inspection lead -> Mon
  assert.deepEqual(s.get('b'), { plannedStart: '2026-11-09', plannedEnd: '2026-11-10', durationDays: 2 });
  assert.equal(s.get('c').plannedStart, '2026-11-11');
  assert.equal(s.get('d').plannedStart, '2026-11-02');
  // a Saturday start rolls to Monday
  assert.equal(scheduleTasks([{ key: 'x', durationDays: 1 }], '2026-11-07').get('x').plannedStart, '2026-11-09');
});

test('duration = ceil(quantity / (rate * crew)), minimum one day', () => {
  assert.equal(taskDuration({ quantity: '101', productionRate: '25', crewSize: 2 }), 3);
  assert.equal(taskDuration({ quantity: '0', productionRate: '25', crewSize: 2 }), 1);
  assert.equal(taskDuration({ quantity: '10' }), 1);
});

test('instantiated 20-task schedule never starts a task before its predecessors finish', () => {
  const { lines } = instantiate({ template: BUILDOUT, projectId: 'p', startDate: '2026-11-02' });
  const byKey = new Map(lines.map(l => [l.templateTaskKey, l]));
  for (const l of lines) for (const d of l.dependsOn) assert.ok(byKey.get(d).plannedEnd < l.plannedStart, `${d} -> ${l.templateTaskKey}`);
});
