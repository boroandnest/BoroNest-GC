// Q2 · The quote calculation. Pure: no clock, no randomness, no I/O. Same
// input + same card version always produces the same output — that is the
// whole point of versioning the card (lib/quote/seed.js) rather than reading
// loose constants.
//
// Order of operations matters and is fixed here, not left to call order:
//   1. base psf from the concept
//   2. borough modifier (multiplicative)
//   3. condition modifier (multiplicative)
//   4. after-hours modifier (multiplicative, widens the band)
//   5. construction = adjusted psf x sqft
//   6. adders evaluated against triggers, tiered ones resolved by floors
//   7. subtotal = construction + adders
//   8. contingency on the SUBTOTAL (including adders) — a $60K exhaust riser
//      carries risk too, so contingency never computes on construction alone
//   9. total = subtotal + contingency
//  10. model routing
//  11. disqualify check against total_lo vs min_commercial
import { Decimal, toMoney, round2 } from '../money.js';

const ZERO = new Decimal(0);
const HUNDRED = new Decimal(100);
const NOT_EXISTING_FIELD = { hood: 'existingHood', grease: 'existingGrease', exhaust: 'existingExhaust' };

export class QuoteError extends Error {
  constructor(code, detail) {
    super(`${code}${detail ? `: ${detail}` : ''}`);
    this.code = code;
    this.detail = detail;
  }
}

function findConcept(card, conceptKey) {
  const c = card.concepts.find(c => c.conceptKey === conceptKey);
  if (!c) throw new QuoteError('unknown_concept', conceptKey);
  return c;
}

function modifier(card, key) {
  return card.modifiers.find(m => m.key === key) || null;
}

// A [lo, hi] band, scaled by a modifier's own [lo, hi] multiplier. The low
// multiplier always scales the low end and the high multiplier the high end,
// so a modifier widens or narrows the band rather than shifting it — applying
// the same number to both ends would silently collapse the uncertainty a
// range exists to show.
function scaleBand(lo, hi, mod) {
  if (!mod) return [lo, hi];
  return [lo.times(toMoney(mod.multLo)), hi.times(toMoney(mod.multHi))];
}

function routeModel(input, concept) {
  if (concept.defaultModel === 'B') {
    return ['B', `${concept.label} scopes carry too much unknown to price as a lump sum.`];
  }
  if (input.condition === 'unknown') {
    return ['B', "You haven't been inside the space yet — existing conditions drive this budget."];
  }
  if (input.cooking && concept.conceptKey === 'bar_lounge') {
    return ['B', 'A full kitchen behind a bar carries unknown existing conditions.'];
  }
  return ['A', null];
}

function adderApplies(trigger, input, concept) {
  if (trigger.fnb !== undefined && concept.isFnb !== trigger.fnb) return false;
  if (trigger.cooking !== undefined && !!input.cooking !== trigger.cooking) return false;
  if (trigger.notExisting) {
    const field = NOT_EXISTING_FIELD[trigger.notExisting];
    if (field && input[field]) return false; // already have it — adder does not apply
  }
  return true;
}

function resolveAdder(adder, input) {
  if (!adder.tieredOn) return { lo: toMoney(adder.amountLo), hi: toMoney(adder.amountHi) };
  const value = input[adder.tieredOn];
  if (value === undefined || value === null) {
    throw new QuoteError('missing_tier_input', `${adder.key} needs "${adder.tieredOn}"`);
  }
  const tiers = [...adder.tiers].sort((a, b) => a.seq - b.seq);
  const tier = tiers.find(t => t.maxValue === null || value <= t.maxValue) || tiers.at(-1);
  if (!tier) throw new QuoteError('no_tier_matched', adder.key);
  return { lo: toMoney(tier.amountLo), hi: toMoney(tier.amountHi), tierLabel: tier.label };
}

export function calculate(input, card) {
  const concept = findConcept(card, input.conceptKey);
  // medical_specialized etc.: no published band at all — "quoted case by
  // case" per §3.3, not a $0 job. The disqualify check below is skipped for
  // these: $0 isn't a real total, so comparing it to min_commercial would
  // wrongly decline every lead in a concept we simply haven't priced by psf.
  const noPublishedBand = concept.psfLo === null || concept.psfHi === null;
  const sqft = toMoney(input.sqft);

  let psfLo = toMoney(concept.psfLo ?? 0);
  let psfHi = toMoney(concept.psfHi ?? 0);

  [psfLo, psfHi] = scaleBand(psfLo, psfHi, input.borough === 'outer' ? modifier(card, 'outer_borough') : null);
  [psfLo, psfHi] = scaleBand(psfLo, psfHi, modifier(card, 'condition'));
  if (input.afterHours) [psfLo, psfHi] = scaleBand(psfLo, psfHi, modifier(card, 'after_hours'));

  const constructionLo = psfLo.times(sqft);
  const constructionHi = psfHi.times(sqft);

  const adders = [];
  let addersLo = ZERO, addersHi = ZERO;
  for (const adder of card.adders) {
    if (!adderApplies(adder.trigger, input, concept)) continue;
    const r = resolveAdder(adder, input);
    adders.push({ key: adder.key, label: adder.label, tierLabel: r.tierLabel ?? null, lo: r.lo, hi: r.hi });
    addersLo = addersLo.plus(r.lo);
    addersHi = addersHi.plus(r.hi);
  }

  // Service tier (Build / Build+Approvals / Turnkey): additive add-on costs
  // only (expediter, approvals coordination, design management) — the GC fee
  // itself is already folded into the published psf band, same as it always
  // was. Picking a tier never changes the per-sf number, only adds the real
  // line items that come with more scope. 'custom'/unknown keys and atCost
  // add-ons (billed at cost later, no fixed number yet) contribute nothing
  // here; atCost add-ons are still surfaced below so the prospect sees them.
  const tier = (card.serviceTiers || []).find(t => t.key === input.serviceTierKey) || null;
  let tierAddersLo = ZERO, tierAddersHi = ZERO;
  const tierAddOns = [];
  if (tier) {
    for (const a of tier.addOns || []) {
      if (a.atCost) { tierAddOns.push({ label: a.label, atCost: true, lo: null, hi: null }); continue; }
      const lo = toMoney(a.amountLo), hi = toMoney(a.amountHi);
      tierAddOns.push({ label: a.label, atCost: false, lo, hi });
      tierAddersLo = tierAddersLo.plus(lo);
      tierAddersHi = tierAddersHi.plus(hi);
    }
  }

  const subtotalLo = constructionLo.plus(addersLo).plus(tierAddersLo);
  const subtotalHi = constructionHi.plus(addersHi).plus(tierAddersHi);

  // Contingency on the subtotal — adders included, never on construction alone.
  const contingencyLo = subtotalLo.times(toMoney(card.contingencyLo)).dividedBy(HUNDRED);
  const contingencyHi = subtotalHi.times(toMoney(card.contingencyHi)).dividedBy(HUNDRED);

  const totalLo = subtotalLo.plus(contingencyLo);
  const totalHi = subtotalHi.plus(contingencyHi);

  const [model, modelReason] = routeModel(input, concept);

  const disqualified = !noPublishedBand && totalLo.lessThan(toMoney(card.minCommercial));

  const reviewTier = concept.isFnb ? 'fnb' : 'retail';
  // Playbook §3.2: $1,250 retail/office, $2,250 F&B.
  const reviewPrice = toMoney(concept.isFnb ? 2250 : 1250);

  const tradeSplits = (card.tradeSplits || [])
    .filter(s => s.profile === (concept.isFnb ? 'fnb' : 'nonfnb'))
    .sort((a, b) => a.seq - b.seq)
    .map(s => ({
      trade: s.trade, pct: toMoney(s.pct),
      lo: round2(subtotalLo.times(toMoney(s.pct)).dividedBy(HUNDRED)),
      hi: round2(subtotalHi.times(toMoney(s.pct)).dividedBy(HUNDRED))
    }));

  // Playbook §3.3: precon $5K-$15K (no sourced size tiering), fee 10-12% of
  // cost of work (construction, before contingency).
  const modelBStructure = model === 'B' ? {
    preconLo: toMoney(5000), preconHi: toMoney(15000),
    feeLo: round2(constructionLo.times(toMoney(10)).dividedBy(HUNDRED)),
    feeHi: round2(constructionHi.times(toMoney(12)).dividedBy(HUNDRED))
  } : null;

  return {
    rateCardVersion: card.version,
    conceptKey: concept.conceptKey,
    model, modelReason,
    psfLo: round2(psfLo), psfHi: round2(psfHi),
    constructionLo: round2(constructionLo), constructionHi: round2(constructionHi),
    adders: adders.map(a => ({ ...a, lo: round2(a.lo), hi: round2(a.hi) })),
    contingencyLo: round2(contingencyLo), contingencyHi: round2(contingencyHi),
    totalLo: round2(totalLo), totalHi: round2(totalHi),
    permitWeeks: [concept.permitWkLo ?? null, concept.permitWkHi ?? null],
    buildWeeks: [concept.buildWkLo ?? null, concept.buildWkHi ?? null],
    noPublishedBand,
    disqualified,
    disqualifyReason: disqualified ? `Construction value under $${toMoney(card.minCommercial).toFixed(0)} minimum.` : null,
    reviewTier, reviewPrice: round2(reviewPrice),
    tradeSplits,
    modelBStructure,
    marketLo: concept.marketLo ? round2(toMoney(concept.marketLo)) : null,
    marketHi: concept.marketHi ? round2(toMoney(concept.marketHi)) : null,
    marketSource: concept.marketSource ?? null,
    serviceTier: tier ? {
      key: tier.key, name: tier.name, feeLabel: tier.feeLabel,
      addOns: tierAddOns.map(a => ({ ...a, lo: a.lo === null ? null : round2(a.lo), hi: a.hi === null ? null : round2(a.hi) }))
    } : null
  };
}

// JSON-safe strings for API responses, test fixtures and replay comparison.
// Decimal objects are never serialized directly — a fixture file or a wire
// response holds the same 2dp strings lib/money.js uses everywhere else.
export function serializeQuote(r) {
  const money = (v) => (v === null || v === undefined ? null : v.toFixed(2));
  return {
    ...r,
    psfLo: money(r.psfLo), psfHi: money(r.psfHi),
    constructionLo: money(r.constructionLo), constructionHi: money(r.constructionHi),
    adders: r.adders.map(a => ({ ...a, lo: money(a.lo), hi: money(a.hi) })),
    contingencyLo: money(r.contingencyLo), contingencyHi: money(r.contingencyHi),
    totalLo: money(r.totalLo), totalHi: money(r.totalHi),
    reviewPrice: money(r.reviewPrice),
    marketLo: money(r.marketLo), marketHi: money(r.marketHi),
    tradeSplits: r.tradeSplits.map(t => ({ ...t, pct: money(t.pct), lo: money(t.lo), hi: money(t.hi) })),
    modelBStructure: r.modelBStructure && {
      preconLo: money(r.modelBStructure.preconLo), preconHi: money(r.modelBStructure.preconHi),
      feeLo: money(r.modelBStructure.feeLo), feeHi: money(r.modelBStructure.feeHi)
    },
    serviceTier: r.serviceTier && {
      ...r.serviceTier,
      addOns: r.serviceTier.addOns.map(a => ({ ...a, lo: money(a.lo), hi: money(a.hi) }))
    }
  };
}
