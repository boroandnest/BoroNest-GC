import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { calculate, serializeQuote, QuoteError } from './calculate.js';
import { projectPublic, projectStaff } from './project.js';
import { buildCardV1 } from './seed.js';
import { validateTradeSplits, assertPublishable, CardError } from './card.js';

const vectors = JSON.parse(readFileSync(new URL('../../shared/fixtures/quote.vectors.json', import.meta.url)));
const card = buildCardV1();

for (const c of vectors.cases) {
  test(`vector: ${c.name}`, () => {
    const out = serializeQuote(calculate(c.input, card));
    for (const [key, expected] of Object.entries(c.expect)) {
      assert.equal(out[key], expected, `${key}: expected ${expected}, got ${out[key]}`);
    }
    if (c.expectModelBStructure) {
      for (const [key, expected] of Object.entries(c.expectModelBStructure)) {
        assert.equal(out.modelBStructure[key], expected, `modelBStructure.${key}`);
      }
    }
  });
}

test('determinism: identical input and card version produce byte-identical output', () => {
  const input = { conceptKey: 'coffee_fast_casual', sqft: 1200, borough: 'manhattan', condition: 'second_same', cooking: true, existingHood: false, existingGrease: true, existingExhaust: true };
  const a = JSON.stringify(serializeQuote(calculate(input, card)));
  const b = JSON.stringify(serializeQuote(calculate(input, card)));
  assert.equal(a, b);
});

test('the card version travels with every result and is never invented', () => {
  const out = calculate({ conceptKey: 'boutique_retail', sqft: 1000, borough: 'manhattan', condition: 'second_same' }, card);
  assert.equal(out.rateCardVersion, 1);
});

test('projectPublic strips tradeSplits and modelBStructure keys entirely, not just empties them', () => {
  const out = calculate({ conceptKey: 'full_service_restaurant', sqft: 2000, borough: 'manhattan', condition: 'second_same' }, card);
  const pub = projectPublic(out);
  assert.ok(!('tradeSplits' in pub), 'tradeSplits key must be absent from the public response');
  assert.ok(!('modelBStructure' in pub), 'modelBStructure key must be absent from the public response');
  // staff keeps both
  const staff = projectStaff(out);
  assert.ok('tradeSplits' in staff);
  assert.ok('modelBStructure' in staff);
});

test('projectPublic also strips marketSource — a competitor name, unlike the market numbers themselves', () => {
  const out = calculate({ conceptKey: 'coffee_fast_casual', sqft: 1200, borough: 'manhattan', condition: 'second_same' }, card);
  const pub = projectPublic(out);
  assert.ok(!('marketSource' in pub), 'marketSource (e.g. "LOD Construction, 2026") must never reach a public response');
  assert.equal(pub.marketLo.toFixed(2), '150.00', 'the market numbers themselves stay public, unattributed');
  assert.equal(pub.marketHi.toFixed(2), '300.00');
  assert.ok('marketSource' in projectStaff(out), 'staff still needs the attribution for defensibility');
});

test('a tiered adder with no tiering input throws rather than guessing', () => {
  assert.throws(
    () => calculate({ conceptKey: 'coffee_fast_casual', sqft: 1200, borough: 'manhattan', condition: 'second_same', cooking: true, existingHood: true, existingGrease: true }, card),
    (e) => e instanceof QuoteError && e.code === 'missing_tier_input'
  );
});

test('a concept with no published psf band is never disqualified by the zero total it has no real connection to', () => {
  const out = calculate({ conceptKey: 'medical_specialized', sqft: 1000, borough: 'manhattan', condition: 'second_same' }, card);
  assert.equal(out.noPublishedBand, true);
  assert.equal(out.disqualified, false, '$0 is "not computed," not "too small" — comparing it to the minimum would wrongly decline every lead in a concept we have not priced by psf');
  assert.equal(out.disqualifyReason, null);
});

test('an unknown concept key is refused, not silently zeroed', () => {
  assert.throws(() => calculate({ conceptKey: 'nope', sqft: 100, borough: 'manhattan', condition: 'second_same' }, card), { code: 'unknown_concept' });
});

// --- card invariants ---------------------------------------------------------

test('trade splits must sum to exactly 100 per profile', () => {
  assert.throws(() => validateTradeSplits([{ profile: 'fnb', pct: '97.00' }]), (e) => e instanceof CardError && e.code === 'splits_not_100');
  assert.doesNotThrow(() => validateTradeSplits([{ profile: 'fnb', pct: '60.00' }, { profile: 'fnb', pct: '40.00' }]));
});

test('v1 as seeded cannot be published: no trade splits yet', () => {
  assert.equal(card.published, false);
  assert.throws(() => assertPublishable(card), { code: 'no_trade_splits' });
});

test('v1 carries no competitor name anywhere in its data', () => {
  // Blocker 2 in docs/QUOTE_AND_DELIVERY_PLAN.md: named competitors never
  // enter application data, only the research citations the playbook itself
  // publishes (LOD Construction, NYC Estimating Services).
  const raw = JSON.stringify(card);
  for (const name of ['JJS', 'PRHI', 'Agalliu', 'TRH', 'Darby', 'Bolt', 'InVision', 'Reidy', 'MGI', 'Jay P', 'AKU', 'Slate', 'K&D']) {
    assert.ok(!raw.includes(name), `competitor name "${name}" leaked into rate card data`);
  }
});
