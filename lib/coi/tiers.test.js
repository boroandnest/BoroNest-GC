import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expiryTier } from './tiers.js';

test('exactly 30 days -> day30; 31 -> none', () => {
  assert.equal(expiryTier('2026-11-20', '2026-10-21').tier, 'day30');
  assert.equal(expiryTier('2026-11-21', '2026-10-21').tier, null);
});
test('exactly 7 days -> day7; 8 -> day30', () => {
  assert.equal(expiryTier('2026-10-28', '2026-10-21').tier, 'day7');
  assert.equal(expiryTier('2026-10-29', '2026-10-21').tier, 'day30');
});
test('expiring today or earlier -> expired', () => {
  assert.equal(expiryTier('2026-10-21', '2026-10-21').tier, 'expired');
  assert.equal(expiryTier('2026-10-20', '2026-10-21').tier, 'expired');
});
