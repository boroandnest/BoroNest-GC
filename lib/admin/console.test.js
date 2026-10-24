import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildConsole } from './console.js';

const TODAY = '2026-10-22';

const project = (over = {}) => ({ id: 'p1', code: 'BN-0001', name: 'Unit 3H', gmpCeiling: '100000.00', contingency: '20000.00', ...over });
const building = (over = {}) => ({ id: 'b1', name: 'Fairfield Views', unitCount: 18, unitCountVerified: true, ...over });
const violation = (over = {}) => ({ id: 'v1', buildingId: 'b1', class: 'B', description: 'x', evidenceStatus: 'reported', issuedOn: '2026-01-01', createdAt: new Date('2026-01-01'), ...over });

test('empty input produces zeroed totals and nothing to act on', () => {
  const r = buildConsole({ today: TODAY });
  assert.equal(r.totals.activeProjects, 0);
  assert.equal(r.totals.gmpUnderManagement, '0.00');
  assert.deepEqual(r.attention, []);
  assert.equal(r.problemCount, 0);
});

test('GMP under management sums the adjusted ceiling, as a 2dp string', () => {
  const r = buildConsole({ projects: [project(), project({ id: 'p2', code: 'BN-0002', gmpCeiling: '50000.50' })], today: TODAY });
  assert.equal(r.totals.gmpUnderManagement, '150000.50');
  assert.equal(r.totals.contingencyRemaining, '40000.00');
});

test('a signed change order against contingency moves the rollup', () => {
  const r = buildConsole({
    projects: [project()],
    changeOrders: [{ id: 'c1', projectId: 'p1', status: 'signed', reason: 'owner_request', costDelta: '5000.00', againstContingency: true }],
    today: TODAY
  });
  assert.equal(r.totals.contingencyRemaining, '15000.00');
});

test('a bn_error change order is absorbed and never charged to the client', () => {
  const r = buildConsole({
    projects: [project()],
    changeOrders: [{ id: 'c1', projectId: 'p1', status: 'signed', reason: 'bn_error', costDelta: '5000.00', againstContingency: true }],
    today: TODAY
  });
  assert.equal(r.totals.contingencyRemaining, '20000.00');
});

// --- severity discipline (docs/PHASE3_REVIEW.md §D2) -------------------------
// These are the tests that keep --alert meaningful. A thing that has not failed
// yet is `warn`; only something actually wrong now is `problem`.

test('approaching the AEP threshold warns; being over it is a problem', () => {
  const approaching = buildConsole({
    buildings: [building()],
    violations: Array.from({ length: 46 }, (_, i) => violation({ id: `v${i}` })), // 2.56/unit
    today: TODAY
  });
  const a = approaching.attention.find(x => x.kind === 'aep_approaching');
  assert.ok(a, 'expected an approaching item');
  assert.equal(a.severity, 'warn');
  assert.equal(approaching.problemCount, 0);

  const over = buildConsole({
    buildings: [building()],
    violations: Array.from({ length: 79 }, (_, i) => violation({ id: `v${i}` })), // 4.39/unit
    today: TODAY
  });
  const o = over.attention.find(x => x.kind === 'aep_over');
  assert.equal(o.severity, 'problem');
  assert.match(o.detail, /4\.39 open per unit/);
});

test('a certificate 30 days out warns; 7 days out is a problem', () => {
  const base = { projects: [project({ buildingId: 'b1' })], buildings: [building({ requiredAiStatic: [], requiredAiTokens: [] })] };
  const coi = (expiresOn) => ({ id: 'c', holderId: 'u1', projectId: 'p1', status: 'verified', verifiedAt: new Date('2026-10-01'), additionalInsured: [], expiresOn, submittedAt: new Date(), fileId: 'f', glLimit: '0', autoLimit: '0', elLimit: '0', wcPresent: false, effectiveOn: '2026-01-01' });

  const far = buildConsole({ ...base, cois: [coi('2026-11-15')], today: TODAY });
  assert.equal(far.attention.find(x => x.kind === 'coi_expiring_30')?.severity, 'warn');

  const near = buildConsole({ ...base, cois: [coi('2026-10-26')], today: TODAY });
  assert.equal(near.attention.find(x => x.kind === 'coi_expiring_7')?.severity, 'problem');

  // Verified status without a verifiedAt is not verified. It must read as
  // non-compliant, not as a certificate that merely expires soon.
  const unverified = buildConsole({ ...base, cois: [{ ...coi('2026-11-15'), verifiedAt: undefined }], today: TODAY });
  assert.equal(unverified.attention.find(x => x.kind === 'coi_expired')?.severity, 'problem');
  assert.equal(unverified.attention.find(x => x.kind === 'coi_expiring_30'), undefined);
});

test('work finished but not closed by HPD still counts against density', () => {
  const r = buildConsole({
    buildings: [building()],
    violations: Array.from({ length: 79 }, (_, i) => violation({ id: `v${i}`, workCompletedAt: i < 40 ? new Date() : undefined })),
    today: TODAY
  });
  assert.equal(r.totals.openViolations, 79);
  assert.equal(r.totals.awaitingClosure, 40);
  assert.equal(r.attention.find(x => x.kind === 'aep_over').severity, 'problem');
});

test('a building with no unit count raises nothing rather than a guessed density', () => {
  const r = buildConsole({
    buildings: [building({ unitCount: null })],
    violations: Array.from({ length: 79 }, (_, i) => violation({ id: `v${i}` })),
    today: TODAY
  });
  assert.equal(r.buildings[0].aepStatus, 'unknown');
  assert.equal(r.buildings[0].density, null);
  assert.equal(r.attention.filter(x => x.kind.startsWith('aep')).length, 0);
});

test('a failed transfer and an open dispute are both problems, failures first', () => {
  const r = buildConsole({
    milestones: [
      { id: 'm2', projectId: 'p1', title: 'Rough-in', releaseStatus: 'disputed', disputeReason: 'Punch list open' },
      { id: 'm1', projectId: 'p1', title: 'Demo', releaseStatus: 'transfer_failed', amount: '7500.00', releaseError: 'payouts disabled' }
    ],
    today: TODAY
  });
  assert.equal(r.attention[0].kind, 'milestone_failed');
  assert.match(r.attention[0].detail, /7,?500\.00|7500\.00/);
  assert.equal(r.attention[1].kind, 'milestone_disputed');
  assert.equal(r.problemCount, 2);
});

test('queue items are warnings, not problems', () => {
  const r = buildConsole({
    pendingUsers: [{ id: 'u1', email: 'a@b.c', role: 'subcontractor' }],
    retainerPeriods: [{ id: 'rp1', projectId: 'p1', status: 'pending', amount: '2500.00' }],
    today: TODAY
  });
  assert.equal(r.problemCount, 0);
  assert.equal(r.warnCount, 2);
  assert.ok(r.attention.every(a => a.severity === 'warn'));
});

test('scoping calls are counted but never raised, having no handled flag', () => {
  const r = buildConsole({ scopingCalls: [{ id: 's1', fullName: 'A' }, { id: 's2', fullName: 'B' }], today: TODAY });
  assert.equal(r.totals.scopingCalls, 2);
  assert.equal(r.attention.length, 0);
});

test('an overdue class C is raised; one still inside its window is not', () => {
  const overdue = buildConsole({ buildings: [building()], violations: [violation({ class: 'C', correctBy: '2026-10-01' })], today: TODAY });
  assert.equal(overdue.attention.find(x => x.kind === 'violation_overdue')?.severity, 'problem');

  const inside = buildConsole({ buildings: [building()], violations: [violation({ class: 'C', correctBy: '2026-12-01' })], today: TODAY });
  assert.equal(inside.attention.find(x => x.kind === 'violation_overdue'), undefined);
});

test('contingency below 15% is a problem; 15–40% warns', () => {
  const low = buildConsole({
    projects: [project()],
    changeOrders: [{ id: 'c1', projectId: 'p1', status: 'signed', reason: 'owner_request', costDelta: '18000.00', againstContingency: true }],
    today: TODAY
  });
  assert.equal(low.attention.find(x => x.kind === 'contingency_exhausted')?.severity, 'problem');

  const mid = buildConsole({
    projects: [project()],
    changeOrders: [{ id: 'c1', projectId: 'p1', status: 'signed', reason: 'owner_request', costDelta: '14000.00', againstContingency: true }],
    today: TODAY
  });
  assert.equal(mid.attention.find(x => x.kind === 'contingency_low')?.severity, 'warn');
});

test('the attention list is ordered by severity rank, money at risk first', () => {
  const r = buildConsole({
    projects: [project({ buildingId: 'b1' })],
    buildings: [building()],
    violations: Array.from({ length: 79 }, (_, i) => violation({ id: `v${i}` })),
    milestones: [{ id: 'm1', projectId: 'p1', title: 'Demo', releaseStatus: 'transfer_failed', amount: '100.00' }],
    pendingUsers: [{ id: 'u1' }],
    today: TODAY
  });
  const ranks = r.attention.map(a => a.rank);
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));
  assert.equal(r.attention[0].kind, 'milestone_failed');
  assert.equal(r.attention.at(-1).kind, 'user_pending');
});

// --- regressions found by running the console against real seeded data -------

test('a project with no contingency on file raises nothing, rather than reading as exhausted', () => {
  const r = buildConsole({ projects: [{ id: 'p9', code: 'BN-0009', name: 'Lume Cafe', gmpCeiling: '500000.00' }], today: TODAY });
  assert.equal(r.attention.length, 0, 'an unconfigured reserve is unknown, not a failure');
  assert.equal(r.projects[0].contingencyConfigured, false);
  assert.equal(r.totals.gmpUnderManagement, '500000.00');
});

test('a project with no code is named, never titled "undefined"', () => {
  const r = buildConsole({
    projects: [{ id: 'p9', name: 'Lume Cafe', gmpCeiling: '100000.00', contingency: '20000.00' }],
    changeOrders: [{ id: 'c1', projectId: 'p9', status: 'signed', reason: 'owner_request', costDelta: '19000.00', againstContingency: true }],
    today: TODAY
  });
  const a = r.attention.find(x => x.kind === 'contingency_exhausted');
  assert.ok(a);
  assert.match(a.title, /^Lume Cafe/);
  assert.doesNotMatch(a.title, /undefined/);
});

test('no attention item anywhere contains the string "undefined"', () => {
  const r = buildConsole({
    projects: [{ id: 'p9', name: 'No Code', gmpCeiling: '100000.00', contingency: '1.00' }],
    buildings: [{ id: 'b9', name: 'B', unitCount: 2 }],
    violations: Array.from({ length: 9 }, (_, i) => ({ id: `v${i}`, buildingId: 'b9', class: 'C', description: 'd', evidenceStatus: 'reported', correctBy: '2026-01-01', createdAt: new Date() })),
    milestones: [{ id: 'm', projectId: 'p9', releaseStatus: 'transfer_failed' }],
    today: TODAY
  });
  for (const a of r.attention) {
    assert.doesNotMatch(`${a.title} ${a.detail}`, /undefined/, `${a.kind} leaked undefined`);
  }
});

test('money in attention prose is formatted as currency, not a raw decimal', () => {
  const r = buildConsole({
    projects: [project()],
    changeOrders: [{ id: 'c1', projectId: 'p1', status: 'signed', reason: 'owner_request', costDelta: '18000.00', againstContingency: true }],
    milestones: [{ id: 'm1', projectId: 'p1', title: 'Demo', releaseStatus: 'transfer_failed', amount: '18500.00' }],
    retainerPeriods: [{ id: 'rp', projectId: 'p1', status: 'pending', amount: '4500.00' }],
    today: TODAY
  });
  const all = r.attention.map(a => a.detail).join(' | ');
  assert.match(all, /\$18,500\.00/);
  assert.match(all, /\$4,500\.00/);
  assert.match(all, /\$2,000\.00 remaining against a \$100,000\.00 ceiling/);
  // no bare decimal money left in prose
  assert.doesNotMatch(all, /(?<![$\d,.])\d{4,}\.\d{2}/);
});

// --- trend and obligation calendar ------------------------------------------
import { buildTrend, buildCalendar } from './console.js';

test('the trend counts open violations from the HPD issue date, not entry date', () => {
  const vs = [
    // issued in August, still open → counts from August onward
    { id: 'a', buildingId: 'b', class: 'B', description: 'x', evidenceStatus: 'reported', issuedOn: '2026-08-10', createdAt: new Date('2026-10-20') },
    // issued in October → only counts in October
    { id: 'b', buildingId: 'b', class: 'B', description: 'x', evidenceStatus: 'reported', issuedOn: '2026-10-02', createdAt: new Date('2026-10-02') }
  ];
  const t = buildTrend({ violations: vs, today: TODAY, months: 4 });
  assert.deepEqual(t.map(x => x.month), ['2026-07', '2026-08', '2026-09', '2026-10']);
  assert.deepEqual(t.map(x => x.open), [0, 1, 1, 2]);
  // a row carries its own display string; the chart formats nothing
  assert.equal(t.at(-1).openLabel, '2 open');
});

test('late data entry cannot invent a drop in the trend', () => {
  const late = [{ id: 'a', buildingId: 'b', class: 'B', description: 'x', evidenceStatus: 'reported', issuedOn: '2026-07-01', createdAt: new Date('2026-10-21') }];
  const t = buildTrend({ violations: late, today: TODAY, months: 4 });
  assert.deepEqual(t.map(x => x.open), [1, 1, 1, 1], 'counted from July, when HPD issued it');
});

test('the calendar groups obligations by day and takes the worst severity', () => {
  const c = buildCalendar({
    projects: [project()],
    cois: [{ id: 'c', projectId: 'p1', status: 'verified', expiresOn: '2026-10-26' }],
    violations: [
      { id: 'v1', buildingId: 'b1', class: 'C', correctBy: '2026-10-26', description: 'Heat' },
      { id: 'v2', buildingId: 'b1', class: 'A', correctBy: '2026-10-05', description: 'Paint' }
    ],
    retainerPeriods: [{ id: 'r', projectId: 'p1', periodEnd: '2026-10-31', status: 'pending' }],
    today: TODAY, month: '2026-10'
  });
  const d26 = c.days.find(d => d.date === '2026-10-26');
  assert.equal(d26.items.length, 2, 'certificate + class C land on the same day');
  assert.ok(d26.items.some(i => i.severity === 'problem'), 'expiring within 7 days is a problem');
  // past its correct-by date
  assert.equal(c.days.find(d => d.date === '2026-10-05').items[0].severity, 'problem');
  assert.equal(c.days.find(d => d.date === '2026-10-31').items[0].severity, 'warn');
});

test('the calendar only returns the month asked for', () => {
  const c = buildCalendar({
    cois: [{ id: 'c', projectId: 'p1', status: 'verified', expiresOn: '2026-11-15' }],
    today: TODAY, month: '2026-10'
  });
  assert.deepEqual(c.days, []);
});

test('a closed violation carries no correct-by obligation', () => {
  const c = buildCalendar({
    violations: [{ id: 'v', buildingId: 'b', class: 'C', correctBy: '2026-10-09', agencyClosedAt: new Date('2026-10-08'), description: 'd' }],
    today: TODAY, month: '2026-10'
  });
  assert.deepEqual(c.days, []);
});

test('a Date-valued obligation lands on the right day, not dropped', () => {
  // releaseEta is a BSON Date, unlike the 'YYYY-MM-DD' strings elsewhere.
  // String()-ing it yields "Tue Oct 28 2026 …" and the row vanished.
  const c = buildCalendar({
    projects: [project()],
    milestones: [{ id: 'm', projectId: 'p1', title: 'Final finishes', releaseEta: new Date('2026-10-28T00:00:00Z') }],
    today: TODAY, month: '2026-10'
  });
  assert.equal(c.days.length, 1);
  assert.equal(c.days[0].date, '2026-10-28');
  assert.match(c.days[0].items[0].title, /Final finishes/);
});
