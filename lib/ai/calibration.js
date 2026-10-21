// Calibration metrics over resolved predictions (Phase 3). Pure.
// Brier score = mean((confidence - outcome)^2); expected calibration error over equal-width bins.
import { toMoney, Decimal } from '../money.js';

export function brierScore(preds) {
  const resolved = preds.filter(p => typeof p.outcome === 'boolean');
  if (!resolved.length) return null;
  const sum = resolved.reduce((a, p) => a.plus(toMoney(p.confidence).minus(p.outcome ? 1 : 0).pow(2)), new Decimal(0));
  return sum.dividedBy(resolved.length);
}

export function expectedCalibrationError(preds, bins = 10) {
  const resolved = preds.filter(p => typeof p.outcome === 'boolean');
  if (!resolved.length) return null;
  let ece = new Decimal(0);
  for (let b = 0; b < bins; b++) {
    const lo = new Decimal(b).dividedBy(bins), hi = new Decimal(b + 1).dividedBy(bins);
    const inBin = resolved.filter(p => { const c = toMoney(p.confidence); return c.greaterThanOrEqualTo(lo) && (b === bins - 1 ? c.lessThanOrEqualTo(hi) : c.lessThan(hi)); });
    if (!inBin.length) continue;
    const conf = inBin.reduce((a, p) => a.plus(toMoney(p.confidence)), new Decimal(0)).dividedBy(inBin.length);
    const acc = new Decimal(inBin.filter(p => p.outcome).length).dividedBy(inBin.length);
    ece = ece.plus(conf.minus(acc).abs().times(inBin.length).dividedBy(resolved.length));
  }
  return ece;
}
