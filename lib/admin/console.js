// Staff console rollup (T30). Pure: it takes already-loaded collections and
// returns figures and an attention list. No database, no clock of its own, so
// it is unit-testable and the page renders what it is given.
//
// Every money figure leaves here as a 2dp string. Every severity decision is
// made here rather than in a component — see docs/PHASE3_REVIEW.md §D2: the
// console is a list of things going wrong, so if each one picked its own color
// the screen would be a wall of --alert and the token would stop meaning
// anything. `problem` is reserved for something actually wrong now.

import { Decimal, toMoney, toMoneyString } from '../money.js';
import { computeFinancials } from '../co/financials.js';
import { formatMoney } from '../format.js';
import { computeDensity } from '../compliance/density.js';
import { coiCompliant } from '../coi/compliance.js';
import { expiryTier } from '../coi/tiers.js';

const sum = (xs) => xs.reduce((a, x) => a.plus(x), new Decimal(0));

// Rank orders the attention list. Money at risk and compliance failures first;
// queues of ordinary work last.
const RANK = {
  milestone_failed: 0,
  milestone_disputed: 1,
  coi_expired: 2,
  aep_over: 3,
  contingency_exhausted: 4,
  coi_expiring_7: 5,
  violation_overdue: 6,
  coi_expiring_30: 7,
  aep_approaching: 8,
  contingency_low: 9,
  coi_pending: 10,
  user_pending: 11,
  retainer_pending: 13
};

function item(kind, severity, title, detail, href, count = 1) {
  return { id: `${kind}:${href}`, kind, severity, title, detail, href, count, rank: RANK[kind] ?? 99 };
}

export function buildConsole({
  projects = [],
  changeOrders = [],
  cois = [],
  buildings = [],
  violations = [],
  milestones = [],
  retainerPeriods = [],
  pendingUsers = [],
  scopingCalls = [],
  today = new Date().toISOString().slice(0, 10)
} = {}) {
  const attention = [];
  const coByProject = new Map();
  for (const co of changeOrders) {
    if (!coByProject.has(co.projectId)) coByProject.set(co.projectId, []);
    coByProject.get(co.projectId).push(co);
  }

  // ---- projects: ceiling, contingency, and the ones running out of room ----
  let ceilingTotal = new Decimal(0);
  let contingencyLeft = new Decimal(0);
  const projectRows = [];
  for (const p of projects) {
    const f = computeFinancials(p, coByProject.get(p.id) || []);
    const label = p.code || p.name || 'Project';
    // A project with no contingency budget on file has not exhausted one.
    // computeFinancials treats a missing reserve as 0, which lands in the
    // `alert` band and would raise a problem on every unconfigured project —
    // the false alert that makes a console unreadable. Unknown is not a
    // failure, the same rule density follows for a missing unit count.
    const hasReserve = toMoney(p.contingency ?? 0).greaterThan(0);
    ceilingTotal = ceilingTotal.plus(toMoney(f.adjustedCeiling));
    contingencyLeft = contingencyLeft.plus(toMoney(f.contingencyRemaining));
    projectRows.push({
      id: p.id, code: p.code, name: p.name, phase: p.phase || null,
      adjustedCeiling: f.adjustedCeiling, contingencyRemaining: f.contingencyRemaining, contingencyConfigured: hasReserve,
      pctRemaining: f.pctRemaining, band: f.band, pendingChangeOrders: f.pendingChangeOrders
    });
    // computeFinancials already decided the band; reuse it rather than
    // re-deriving a threshold here.
    if (!hasReserve) {
      // nothing to report
    } else if (f.band === 'alert') {
      attention.push(item('contingency_exhausted', 'problem', `${label} has ${f.pctRemaining}% contingency left`,
        `${formatMoney(f.contingencyRemaining)} remaining against a ${formatMoney(f.adjustedCeiling)} ceiling.`, `/projects/${p.id}`));
    } else if (f.band === 'sand') {
      attention.push(item('contingency_low', 'warn', `${label} contingency at ${f.pctRemaining}%`,
        `${formatMoney(f.contingencyRemaining)} remaining.`, `/projects/${p.id}`));
    }
  }

  // ---- milestones: money that should have moved and did not ----
  const failed = milestones.filter(m => m.releaseStatus === 'transfer_failed');
  const disputed = milestones.filter(m => m.releaseStatus === 'disputed');
  const awaiting = milestones.filter(m => m.releaseStatus === 'awaiting_verification');
  for (const m of failed) {
    attention.push(item('milestone_failed', 'problem', `Payment failed: ${m.title || 'milestone'}`,
      `${formatMoney(toMoneyString(toMoney(m.amount ?? 0)))} did not transfer. ${m.releaseError || 'No reason recorded.'}`,
      `/admin/projects/${m.projectId}/milestones`));
  }
  for (const m of disputed) {
    attention.push(item('milestone_disputed', 'problem', `Disputed: ${m.title || 'milestone'}`,
      m.disputeReason || 'A dispute is open; release is held.', `/admin/projects/${m.projectId}/milestones`));
  }

  // ---- COIs ----
  const buildingById = new Map(buildings.map(b => [b.id, b]));
  const projectById = new Map(projects.map(p => [p.id, p]));
  let expired = 0, exp7 = 0, exp30 = 0;
  for (const c of cois.filter(c => c.status === 'verified')) {
    const p = projectById.get(c.projectId);
    const b = p?.buildingId ? buildingById.get(p.buildingId) : null;
    const { tier } = expiryTier(c.expiresOn, today);
    const ok = b ? coiCompliant(c, b, p?.requiredAi || [], today).ok : true;
    if (!ok || tier === 'expired') {
      expired++;
      attention.push(item('coi_expired', 'problem', `Certificate not compliant${p ? ` — ${p.code || p.name}` : ''}`,
        tier === 'expired' ? `Expired ${c.expiresOn}.` : 'Does not meet the building requirements on file.',
        '/admin/insurance'));
    } else if (tier === 'day7') {
      exp7++;
      attention.push(item('coi_expiring_7', 'problem', `Certificate expires ${c.expiresOn}${p ? ` — ${p.code || p.name}` : ''}`,
        'Within 7 days. Work stops when it lapses.', '/admin/insurance'));
    } else if (tier === 'day30') {
      exp30++;
      attention.push(item('coi_expiring_30', 'warn', `Certificate expires ${c.expiresOn}${p ? ` — ${p.code || p.name}` : ''}`,
        'Within 30 days.', '/admin/insurance'));
    }
  }
  const coisPending = cois.filter(c => c.status === 'pending').length;
  if (coisPending) {
    attention.push(item('coi_pending', 'warn', `${coisPending} certificate${coisPending === 1 ? '' : 's'} awaiting verification`,
      'A sub cannot be assigned until theirs is verified.', '/admin/insurance', coisPending));
  }

  // ---- violations and AEP density ----
  const vByBuilding = new Map();
  for (const v of violations) {
    if (!vByBuilding.has(v.buildingId)) vByBuilding.set(v.buildingId, []);
    vByBuilding.get(v.buildingId).push(v);
  }
  let openViolations = 0, awaitingClosure = 0;
  const buildingRows = [];
  for (const b of buildings) {
    const d = computeDensity(b, vByBuilding.get(b.id) || []);
    openViolations += d.openViolations;
    awaitingClosure += d.awaitingClosure;
    buildingRows.push({ id: b.id, name: b.name, ...d });
    if (d.aepStatus === 'over_threshold') {
      attention.push(item('aep_over', 'problem', `${b.name} is over the AEP threshold`,
        `${d.density} open per unit across ${d.unitCount} units. ${d.awaitingClosure} fixed and awaiting HPD closure — those still count.`,
        `/admin/buildings/${b.id}`));
    } else if (d.aepStatus === 'approaching') {
      attention.push(item('aep_approaching', 'warn', `${b.name} is approaching the AEP threshold`,
        `${d.density} open per unit.`, `/admin/buildings/${b.id}`));
    }
  }
  // A class C past its correct-by date is a real problem, separately from density.
  const overdueC = violations.filter(v => v.class === 'C' && v.correctBy && v.correctBy < today && !v.agencyClosedAt);
  if (overdueC.length) {
    attention.push(item('violation_overdue', 'problem', `${overdueC.length} class C violation${overdueC.length === 1 ? '' : 's'} past the correct-by date`,
      'Class C is immediately hazardous.', `/admin/buildings/${overdueC[0].buildingId}`, overdueC.length));
  }

  // ---- queues of ordinary work ----
  if (pendingUsers.length) {
    attention.push(item('user_pending', 'warn', `${pendingUsers.length} account${pendingUsers.length === 1 ? '' : 's'} awaiting approval`,
      'Expediters and subcontractors cannot sign in until approved.', '/admin', pendingUsers.length));
  }
  // Scoping calls are counted, not listed as an attention item: the record has
  // no handled/scheduled flag, so an item raised here could never clear and
  // would sit on the console as a permanent false alert. It becomes actionable
  // the day the lead record carries a status.
  const periodsPending = retainerPeriods.filter(p => p.status === 'pending');
  if (periodsPending.length) {
    attention.push(item('retainer_pending', 'warn', `${periodsPending.length} retainer period${periodsPending.length === 1 ? '' : 's'} to invoice`,
      `${formatMoney(toMoneyString(sum(periodsPending.map(p => toMoney(p.amount ?? 0)))))} not yet invoiced.`,
      `/projects/${periodsPending[0].projectId}/billing`, periodsPending.length));
  }

  attention.sort((a, b) => a.rank - b.rank);

  return {
    totals: {
      activeProjects: projects.length,
      gmpUnderManagement: toMoneyString(ceilingTotal),
      contingencyRemaining: toMoneyString(contingencyLeft),
      openViolations,
      awaitingClosure,
      buildings: buildings.length,
      coisPending,
      coisExpired: expired,
      coisExpiring: exp7 + exp30,
      milestonesAwaiting: awaiting.length,
      milestonesFailed: failed.length,
      milestonesDisputed: disputed.length,
      pendingUsers: pendingUsers.length,
      scopingCalls: scopingCalls.length
    },
    // Counted so the console can say "3 problems" without the page filtering.
    problemCount: attention.filter(a => a.severity === 'problem').length,
    warnCount: attention.filter(a => a.severity === 'warn').length,
    attention,
    projects: projectRows,
    buildings: buildingRows
  };
}
