import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readQuoteInput } from './input.js';

test('a complete valid body passes through with the expected shape', () => {
  const r = readQuoteInput({ conceptKey: 'coffee_fast_casual', sqft: '1200', borough: 'manhattan', condition: 'second_same', cooking: true });
  assert.equal(r.sqft, 1200);
  assert.equal(r.cooking, true);
  assert.equal(r.afterHours, false);
});

test('an unknown borough or condition is refused before it reaches the engine', () => {
  assert.throws(() => readQuoteInput({ conceptKey: 'x', sqft: 100, borough: 'queens', condition: 'second_same' }), /Borough/);
  assert.throws(() => readQuoteInput({ conceptKey: 'x', sqft: 100, borough: 'manhattan', condition: 'pristine' }), /Condition/);
});

test('a non-positive or missing sqft is refused', () => {
  assert.throws(() => readQuoteInput({ conceptKey: 'x', sqft: 0, borough: 'manhattan', condition: 'second_same' }), /Square footage/);
  assert.throws(() => readQuoteInput({ conceptKey: 'x', sqft: 'abc', borough: 'manhattan', condition: 'second_same' }), /Square footage/);
});

test('an empty floors value is undefined, not coerced to 0 or NaN', () => {
  const r = readQuoteInput({ conceptKey: 'x', sqft: 100, borough: 'manhattan', condition: 'second_same', floors: '' });
  assert.equal(r.floors, undefined);
});
