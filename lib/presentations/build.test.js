import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDeck } from './build.js';
import { sectionsFor, SECTION_KEYS, scrub, NEVER_IN_A_DECK } from './sections.js';

const project = { id: 'p1', code: 'BN-0001', name: 'Unit 3H Renovation', address: '3215 Arlington Ave', clientEmail: 'owner@example.com', unitContext: { resident_name: 'Ana Ruiz', resident_phone: '718-555-0142' } };
const scopeLines = [
  { trade: 'Plumbing', title: 'Rough-in two baths', unitCost: '1200.00', lineTotal: '9600.00' },
  { trade: 'Electrical', title: 'Panel upgrade', unitCost: '4000.00', lineTotal: '4000.00' }
];
const variance = {
  quote: { amount: '252000.00', quotedAt: '2026-08-20' },
  ceilingAdjustments: '0.00',
  vsRevised: { baseline: '252000.00', live: '240000.00', abs: '12000.00', delta: '-12000.00', pct: '-4.76', intent: 'good', over: false, direction: 'down' },
  schedule: { known: true, deltaDays: -6, absDays: 6 }
};
const density = { openViolations: 79, awaitingClosure: 23, density: '4.39', aepStatus: 'over_threshold' };

const owner = (over = {}) => ({ id: 'd1', kind: 'owner', title: 'Unit 3H — where we are', sections: SECTION_KEYS, createdBy: 'u1', ...over });
const partner = (over = {}) => ({ id: 'd2', kind: 'partner', title: 'Boro & Nest', sections: SECTION_KEYS, createdBy: 'u1', ...over });

test('a partner deck cannot render an owner section even when asked for one', () => {
  const d = buildDeck({ presentation: partner(), project, scopeLines, variance, density, portfolio: { projects: 12, buildings: 4, boroughs: ['Bronx', 'Brooklyn'] } });
  const keys = d.sections.map(s => s.key);
  for (const k of ['scope_of_work', 'cost_position', 'arv', 'fines_avoided', 'compliance_posture', 'time_and_money_saved']) {
    assert.ok(!keys.includes(k), `partner deck must not build ${k}`);
  }
  assert.ok(keys.includes('track_record'));
});

test('a partner deck never names the project or a client', () => {
  const d = buildDeck({ presentation: partner(), project, scopeLines, variance, density, portfolio: { projects: 12, buildings: 4, boroughs: ['Bronx'] } });
  assert.equal(d.subject, null, 'a partner deck has no named subject');
  const raw = JSON.stringify(d);
  for (const needle of ['BN-0001', 'Unit 3H', 'Arlington', 'owner@example.com', 'Ana Ruiz', '718-555-0142', '252000', '240000']) {
    assert.ok(!raw.includes(needle), `partner deck leaked ${needle}`);
  }
});

test('an owner deck names its own project but still drops client PII', () => {
  const d = buildDeck({ presentation: owner(), project, scopeLines, variance, density });
  assert.equal(d.subject.code, 'BN-0001');
  const raw = JSON.stringify(d);
  assert.ok(!raw.includes('owner@example.com'), 'clientEmail must never reach a deck');
  assert.ok(!raw.includes('Ana Ruiz'), 'resident name must never reach a deck');
  assert.ok(!raw.includes('718-555-0142'));
});

test('scope of work carries titles and trades, never unit costs', () => {
  const d = buildDeck({ presentation: owner({ sections: ['scope_of_work'] }), project, scopeLines });
  const s = d.sections[0];
  assert.deepEqual(s.trades.map(t => t.trade), ['Plumbing', 'Electrical']);
  const raw = JSON.stringify(d);
  assert.ok(!raw.includes('1200.00') && !raw.includes('9600.00'), 'a deck is not a bid sheet');
});

test('the cost position is labelled observed and states the agreed baseline', () => {
  const d = buildDeck({ presentation: owner({ sections: ['cost_position'] }), project, variance });
  const s = d.sections[0];
  assert.equal(s.figures[0].label, 'observed');
  assert.equal(s.figures[0].amount, '12000.00');
  assert.equal(s.over, false);
  assert.match(s.lines[0], /\$252,000\.00/);
  assert.match(d.claimSummary, /measured from records/);
});

test('an unlabelled manual figure stops the deck being built at all', () => {
  assert.throws(
    () => buildDeck({ presentation: owner({ sections: ['arv'], manualFigures: [{ amount: '150000.00', caption: 'ARV uplift' }] }), project }),
    { code: 'missing_label' }
  );
});

test('a competitor or fines claim must carry its basis', () => {
  // This is the Waterford guard reaching the deck layer.
  assert.throws(
    () => buildDeck({ presentation: owner({ sections: ['fines_avoided'], manualFigures: [{ amount: '687000.00', label: 'risk_hypothesis', caption: 'Fines avoided' }] }), project, density }),
    { code: 'missing_basis' }
  );
  const ok = buildDeck({
    presentation: owner({ sections: ['fines_avoided'], manualFigures: [{ amount: '687000.00', label: 'risk_hypothesis', caption: 'Fines avoided', basis: '12 class C × HPD daily penalty across the cure window' }] }),
    project, density
  });
  assert.equal(ok.sections[0].items[0].verified, false);
  assert.match(ok.claimSummary, /None of it is cash that moved/);
});

test('a deck mixing measured and modelled figures says so in one line', () => {
  const d = buildDeck({
    presentation: owner({
      sections: ['cost_position', 'arv'],
      manualFigures: [{ amount: '150000.00', label: 'estimated_capacity', caption: 'ARV uplift', basis: 'Comps at 3215 Arlington, two sales Q2 2026' }]
    }),
    project, variance
  });
  assert.match(d.claimSummary, /1 of 2 figures are modelled or avoided-cost/);
});

test('compliance posture states the awaiting-closure trap rather than hiding it', () => {
  const d = buildDeck({ presentation: owner({ sections: ['compliance_posture'] }), project, density });
  assert.match(d.sections[0].note, /waiting on HPD/);
  assert.equal(d.sections[0].openViolations, 79);
});

test('a null unit count claims no density', () => {
  const d = buildDeck({ presentation: owner({ sections: ['compliance_posture'] }), project, density: { ...density, density: null, aepStatus: 'unknown' } });
  assert.match(d.sections[0].note, /no density is claimed/i);
});

test('scrub removes every forbidden key at any depth', () => {
  const out = scrub({ a: { b: [{ clientEmail: 'x@y.z', keep: 1, c: { resident_phone: '1' } }] } });
  assert.deepEqual(out, { a: { b: [{ keep: 1, c: {} }] } });
  for (const k of NEVER_IN_A_DECK) {
    assert.deepEqual(scrub({ [k]: 'secret', ok: 1 }), { ok: 1 }, `${k} survived scrub`);
  }
});

test('section audiences do not overlap between owner and partner', () => {
  const o = new Set(sectionsFor('owner'));
  for (const k of sectionsFor('partner')) {
    assert.ok(!o.has(k), `${k} is offered to both audiences; decide which`);
  }
});
