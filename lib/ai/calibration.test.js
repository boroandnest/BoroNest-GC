import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brierScore, expectedCalibrationError } from './calibration.js';

test('Brier score and ECE over resolved predictions only', () => {
  const preds = [{ confidence: '0.9', outcome: true }, { confidence: '0.8', outcome: false }, { confidence: '0.6', outcome: true }, { confidence: '0.5', outcome: null }];
  // (0.01 + 0.64 + 0.16) / 3 = 0.27
  assert.equal(brierScore(preds).toString(), '0.27');
  assert.equal(brierScore([]), null);
  assert.ok(expectedCalibrationError(preds).greaterThan(0));
});
