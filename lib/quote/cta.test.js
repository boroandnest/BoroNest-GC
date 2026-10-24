import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeCta } from './cta.js';

test('a competing bid routes to the Quote Check regardless of model or size', () => {
  assert.equal(routeCta({ result: { model: 'A', disqualified: true }, holdingCompetingBid: true }), 'quote_check');
  assert.equal(routeCta({ result: { model: 'B', disqualified: false }, holdingCompetingBid: true, multiUnit: true }), 'quote_check');
});

test('multi-unit outranks disqualified and model routing', () => {
  assert.equal(routeCta({ result: { model: 'A', disqualified: true }, multiUnit: true }), 'multi_site');
});

test('disqualified is shown honestly rather than funneled into a paid offer', () => {
  assert.equal(routeCta({ result: { model: 'A', disqualified: true } }), 'disqualified');
});

test('model routes to the matching review offer', () => {
  assert.equal(routeCta({ result: { model: 'A', disqualified: false } }), 'model_a_review');
  assert.equal(routeCta({ result: { model: 'B', disqualified: false } }), 'model_b_review');
});
