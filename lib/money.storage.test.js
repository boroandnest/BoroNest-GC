// Parity suite (storage side). This app stores data in MongoDB, not Postgres, so instead of a
// plpgsql mirror this suite proves that every fixture input and output survives the exact
// encoding the Mongo driver puts on the wire (BSON Decimal128) and still computes identically.
// Set MONGO_URL to also round-trip through a live database.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BSON, MongoClient } from 'mongodb';
import { round2, lineTotal, tariffExposure, contingency, toMoney, toMoneyString } from './money.js';
import { toDecimal128Exact, fromDecimal128 } from './money-storage.js';

const V = JSON.parse(readFileSync(new URL('../shared/fixtures/gmp.vectors.json', import.meta.url)));

// Serialize to BSON and back, exactly as a write + read through the driver would.
function viaBson(values) {
  const doc = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, toDecimal128Exact(v)]));
  const back = BSON.deserialize(BSON.serialize(doc));
  return Object.fromEntries(Object.entries(back).map(([k, v]) => [k, fromDecimal128(v)]));
}
const stored = (v) => toMoneyString(viaBson({ v }).v);

for (const c of V.rounding) {
  test(`stored round2 ${c.in}`, () => {
    const { x } = viaBson({ x: c.in });
    assert.equal(stored(round2(x)), c.out);
  });
}

for (const c of V.line_total) {
  test(`stored lineTotal ${c.qty} x ${c.unit_cost}`, () => {
    const { q, u } = viaBson({ q: c.qty, u: c.unit_cost });
    assert.equal(stored(lineTotal(q, u)), c.out);
  });
}

for (const c of V.tariff) {
  test(`stored tariff ${c.base} @ ${c.pct}%`, () => {
    const { b, p } = viaBson({ b: c.base, p: c.pct });
    const exposure = tariffExposure(b, p);
    assert.equal(stored(exposure), c.exposure);
    assert.equal(stored(toMoney(b).plus(exposure)), c.total);
  });
}

for (const c of V.contingency) {
  test(`stored contingency: ${c.label}`, () => {
    const { ceiling, reserve } = viaBson({ ceiling: c.ceiling, reserve: c.contingency });
    const r = contingency({
      ceiling,
      contingency: reserve,
      signedCos: c.signed_cos.map(co => ({ delta: viaBson({ d: co.delta }).d, againstContingency: co.against_contingency }))
    });
    assert.equal(stored(r.contingencyUsed), c.expect.contingency_used);
    assert.equal(stored(r.contingencyRemaining), c.expect.contingency_remaining);
    assert.equal(stored(r.ceilingAdjustments), c.expect.ceiling_adjustments);
    assert.equal(stored(r.adjustedCeiling), c.expect.adjusted_ceiling);
    assert.equal(stored(r.pctRemaining), c.expect.pct_remaining);
  });
}

test('float math on a stored double drifts (why money math goes through lib/money)', () => {
  const back = BSON.deserialize(BSON.serialize({ x: 1.005 })).x;
  assert.equal(typeof back, 'number');
  assert.equal(Math.round(back * 100) / 100, 1); // float half-up gives 1.00…
  assert.equal(toMoneyString(round2(String(back))), '1.01'); // …Decimal half-up gives 1.01
});

test('live MongoDB round-trip of every fixture value', { skip: !process.env.MONGO_URL && 'MONGO_URL not set' }, async () => {
  const client = await MongoClient.connect(process.env.MONGO_URL);
  try {
    const col = client.db(process.env.DB_NAME || 'boro_nest_test').collection('money_parity_test');
    const values = [
      ...V.rounding.map(c => c.in), ...V.line_total.flatMap(c => [c.qty, c.unit_cost, c.out]),
      ...V.tariff.flatMap(c => [c.base, c.pct, c.exposure, c.total]),
      ...V.contingency.flatMap(c => [c.ceiling, c.contingency, ...Object.values(c.expect)])
    ];
    const { insertedId } = await col.insertOne({ values: values.map(toDecimal128Exact) });
    const doc = await col.findOne({ _id: insertedId });
    await col.deleteOne({ _id: insertedId });
    doc.values.forEach((v, i) => assert.ok(fromDecimal128(v).equals(toMoney(values[i])), `value ${values[i]}`));
  } finally {
    await client.close();
  }
});
