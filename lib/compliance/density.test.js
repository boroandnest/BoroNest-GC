import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDensity, openCountAt } from './density.js';

const make = (n, extra = {}) => Array.from({ length: n }, (_, i) => ({ id: String(i), class: i % 5 === 0 ? 'C' : 'B', ...extra }));

test('79 open violations across 18 units -> 4.39, over_threshold', () => {
  const d = computeDensity({ unitCount: 18 }, make(79));
  assert.equal(d.density, '4.39');
  assert.equal(d.aepStatus, 'over_threshold');
  assert.equal(d.openViolations, 79);
});

test('marking work complete does NOT change density; only agency closure does', () => {
  const v = make(10);
  const before = computeDensity({ unitCount: 4 }, v);
  const worked = v.map(x => ({ ...x, workCompletedAt: new Date(), clientAcceptedAt: new Date(), certifiedFiledAt: new Date() }));
  const after = computeDensity({ unitCount: 4 }, worked);
  assert.equal(after.density, before.density);
  assert.equal(after.awaitingClosure, 10, 'gap between finished work and HPD closure');
  const closed = worked.map((x, i) => (i < 3 ? { ...x, agencyClosedAt: new Date() } : x));
  const d = computeDensity({ unitCount: 4 }, closed);
  assert.equal(d.openViolations, 7);
  assert.equal(d.density, '1.75');
  assert.equal(d.awaitingClosure, 7);
});

test('thresholds: 3.0 over, 2.5 approaching (ratio, not the rounded figure)', () => {
  assert.equal(computeDensity({ unitCount: 10 }, make(30)).aepStatus, 'over_threshold');
  assert.equal(computeDensity({ unitCount: 10 }, make(29)).aepStatus, 'approaching');
  assert.equal(computeDensity({ unitCount: 10 }, make(25)).aepStatus, 'approaching');
  assert.equal(computeDensity({ unitCount: 10 }, make(24)).aepStatus, 'clear');
  // 3.2 per unit (Waterford building 2 shape)
  assert.equal(computeDensity({ unitCount: 25 }, make(80)).density, '3.20');
});

test('null or zero unit_count -> unknown, never a computed density', () => {
  for (const unitCount of [null, undefined, 0]) {
    const d = computeDensity({ unitCount }, make(40));
    assert.equal(d.aepStatus, 'unknown');
    assert.equal(d.density, null);
  }
});

test('open count at a point in time respects issue and closure dates', () => {
  const v = [
    { issuedOn: '2026-01-10', createdAt: '2026-01-10' },
    { issuedOn: '2026-02-10', createdAt: '2026-02-10', agencyClosedAt: '2026-03-05' },
    { issuedOn: '2026-03-20', createdAt: '2026-03-20' }
  ];
  assert.equal(openCountAt(v, '2026-03-01'), 2);
  assert.equal(openCountAt(v, '2026-03-31'), 2);
  assert.equal(openCountAt(v, '2026-01-31'), 1);
});
