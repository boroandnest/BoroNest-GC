// Q1 · Rate card v1, built directly from docs/PRICING_PLAYBOOK.md.
// Pure data builder — no database. scripts/seed-rate-card.mjs writes the
// result. Every sourced figure carries its source; every unsourced one is
// flagged in its own `notes` rather than guessed.

export function buildCardV1({ createdBy = null, createdAt = new Date() } = {}) {
  return {
    id: 'rate-card-v1',
    version: 1,
    effectiveFrom: '2026-10-23',
    effectiveTo: null,
    published: false, // trade splits are empty — see note below. Cannot publish yet.
    contingencyLo: '10.00', contingencyHi: '15.00',           // Playbook §3.3
    minCommercial: '75000.00',                                 // Playbook §5
    minResidential: '25000.00',                                // Playbook §3.6 / §5 — not wired into calculate() yet; residential is a later phase per §3.6
    notes:
      'Boro & Nest Pricing and Sales Playbook v1.0, Oct 2026, §3.3/§3.2/§3.5/§5. ' +
      'LOD Construction is a competitor, not a neutral research firm: its published figures are used ' +
      'for comparison (modifiers, market ranges) but its name is never shown publicly — only staff see ' +
      'marketSource. lib/quote/project.js strips it from projectPublic(). ' +
      'trade_splits is empty: the playbook lists trade categories (demo, framing/drywall, ' +
      'plumbing, HVAC, electrical, finishes, general conditions, insurance/admin) but gives no ' +
      'percentages. This card cannot be published until staff enter them and they sum to 100 ' +
      'per profile (lib/quote/card.js enforces the sum). condition modifiers are also unseeded ' +
      '(no-op, 1.000/1.000): the playbook never sources a condition multiplier, only that ' +
      '`condition === \'unknown\'` routes to Model B.',

    concepts: [
      concept('boutique_retail', 'Boutique / specialty retail', '120.00', '200.00', 'A', false,
        { marketLo: '120.00', marketHi: '200.00', marketSource: 'LOD Construction, 2026' }),
      concept('coffee_fast_casual', 'Coffee / fast casual', '170.00', '250.00', 'A', true,
        { marketLo: '150.00', marketHi: '300.00', marketSource: 'LOD Construction, 2026' }),
      concept('bar_lounge', 'Bar / lounge', '220.00', '350.00', 'A', true,
        { marketLo: '200.00', marketHi: '400.00', marketSource: 'LOD Construction, 2026' }),
      // "Usually Model B" per §3.3 — routed by default_model, not by condition alone.
      // psfHi raised 2026-10-23 at the owner's request, from the original
      // 450.00 up to the market ceiling (500.00) already cited in this same
      // row — not a new invented number, just no longer capped below market.
      // Editable from here with no code change via /admin/quote.
      concept('full_service_restaurant', 'Full-service restaurant', '275.00', '500.00', 'B', true,
        { marketLo: '250.00', marketHi: '500.00', marketSource: 'LOD Construction, 2026',
          notes: 'Market range is 500+ (open-ended); 500.00 stored as the stated floor of that open range. ' +
                 'B&N psfHi raised to meet it 2026-10-23 per owner request.' }),
      concept('mid_range_office', 'Mid-range office', '160.00', '230.00', 'A', false,
        { marketLo: '150.00', marketHi: '250.00', marketSource: 'LOD Construction, 2026' }),
      // "Model B only" — no B&N published psf range exists for this concept.
      concept('medical_specialized', 'Medical / specialized', null, null, 'B', false,
        { marketLo: '300.00', marketHi: '500.00', marketSource: 'LOD Construction, 2026',
          notes: 'Quoted case by case per §3.3; no B&N published range, routes to Model B unconditionally.' })
    ],

    modifiers: [
      // "10-20% lower" outer-borough — stored as multipliers against the Manhattan base.
      { key: 'outer_borough', label: 'Outer borough', multLo: '0.80', multHi: '0.90',
        appliesTo: [], source: 'LOD Construction, 2026', customerExplain: 'Published ranges are Manhattan-basis; outer-borough projects run 10-20% lower.' },
      // Widens the band: low end up 15%, high end up 30%.
      { key: 'after_hours', label: 'After-hours work', multLo: '1.15', multHi: '1.30',
        appliesTo: [], source: 'LOD Construction, 2026', customerExplain: 'After-hours labor can add 15-30% to the budget.' },
      // No-op placeholder — see notes above. Kept in the card so calculate()'s
      // order of operations (step 3) has a value to apply rather than a branch
      // to special-case, and so publishing later only means editing a number.
      { key: 'condition', label: 'Existing conditions', multLo: '1.000', multHi: '1.000',
        appliesTo: [], source: null, customerExplain: null }
    ],

    adders: [
      { key: 'hood', label: 'Commercial hood', trigger: { fnb: true, cooking: true, notExisting: 'hood' },
        amountLo: '8000.00', amountHi: '35000.00', tieredOn: null, source: 'NYC Estimating Services', tiers: [] },
      { key: 'grease_interceptor', label: 'Grease interceptor', trigger: { fnb: true, cooking: true, notExisting: 'grease' },
        amountLo: '8000.00', amountHi: '60000.00', tieredOn: null, source: 'NYC Estimating Services', tiers: [] },
      // Tiered by floors. Bands from the build spec (LOD); the floor cutoffs
      // themselves are a Boro & Nest planning assumption, not LOD-sourced —
      // the playbook only gives the two-story vs 30-story endpoints.
      { key: 'exhaust_riser', label: 'Exhaust riser', trigger: { fnb: true, cooking: true, notExisting: 'exhaust' },
        amountLo: null, amountHi: null, tieredOn: 'floors', source: 'LOD Construction, 2026',
        tiers: [
          { label: 'Low-rise (≤6 floors)', maxValue: 6, amountLo: '12000.00', amountHi: '18000.00', seq: 1 },
          { label: 'Mid-rise (7-20 floors)', maxValue: 20, amountLo: '30000.00', amountHi: '60000.00', seq: 2 },
          { label: 'High-rise (>20 floors)', maxValue: null, amountLo: '50000.00', amountHi: '100000.00', seq: 3 }
        ] }
    ],

    // Empty on purpose — see `notes`. Publishing is blocked until staff add
    // these and lib/quote/card.js confirms each profile sums to 100.
    tradeSplits: [],

    createdBy,
    createdAt
  };
}

function concept(key, label, psfLo, psfHi, defaultModel, isFnb, extra = {}) {
  return {
    conceptKey: key, label, psfLo, psfHi, defaultModel, isFnb,
    permitWkLo: null, permitWkHi: null, buildWkLo: null, buildWkHi: null,
    marketLo: null, marketHi: null, marketSource: null, notes: null,
    ...extra
  };
}
