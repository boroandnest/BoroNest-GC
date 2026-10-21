import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateRollup, worksheetRow, isStaleCost } from './estimate.js';
import { priceLine } from './templates/instantiate.js';
import { lineTotal, tariffExposure, toMoney, toMoneyString } from './money.js';

const NOW = new Date('2026-10-21T12:00:00Z');
const daysAgo = (n) => new Date(NOW.getTime() - n * 86400000);

test('rollup figures equal lib/money output exactly', () => {
  const raw = [['800', '25.13', '25'], ['1.5', '1000', '0'], ['333.33', '3', '10'], ['12', '1349.99', '0']];
  const lines = raw.map(([q, u, t], i) => ({ id: String(i), trade: i % 2 ? 'a' : 'b', ...priceLine(q, u, t) }));
  const r = estimateRollup(lines, '32000');
  // recompute independently with the primitives
  let base = toMoney(0), tariff = toMoney(0);
  for (const [q, u, t] of raw) { const b = lineTotal(q, u); base = base.plus(b); tariff = tariff.plus(tariffExposure(b, t)); }
  assert.equal(r.baseTotal, toMoneyString(base));
  assert.equal(r.tariffTotal, toMoneyString(tariff));
  assert.equal(r.scopeTotal, toMoneyString(base.plus(tariff)));
  assert.equal(r.contingency, '32000.00');
  assert.equal(r.proposedCeiling, toMoneyString(base.plus(tariff).plus(32000)));
  assert.deepEqual([r.baseTotal, r.tariffTotal, r.scopeTotal, r.proposedCeiling], ['38803.87', '5126.00', '43929.87', '75929.87']);
});

test('a unit cost updated 130 days ago is stale; 120 days is not', () => {
  assert.equal(isStaleCost(daysAgo(130), NOW), true);
  assert.equal(isStaleCost(daysAgo(120), NOW), false);
  assert.equal(isStaleCost(null, NOW), false);
  assert.equal(worksheetRow({ id: 'x', costUpdated: daysAgo(130), lineTotal: '1.00' }, NOW).staleCost, true);
});

test('a tariffed line exposes its exposure and domestic alternative', () => {
  const row = worksheetRow({ id: 'x', trade: 'tile', title: 'Tile', ...priceLine('800', '25.13', '25'), tariffPct: '25.00', altDomesticMfr: 'Daltile' }, NOW);
  assert.equal(row.hasTariff, true);
  assert.equal(row.tariffExposure, '5026.00');
  assert.equal(row.lineTotal, '25130.00');
  assert.equal(row.altDomesticMfr, 'Daltile');
});
