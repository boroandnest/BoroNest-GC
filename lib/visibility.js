// Server-side pricing / visibility projection (PHASE1_BUILD.md §4).
// Everything a role cannot see is removed BEFORE the response is serialized.
// Never rely on the UI to hide dollar figures.

// Roles that see every dollar figure on a project.
export const FULL_PRICING_ROLES = ['client', 'management', 'bn_staff'];

export function canSeePricing(viewerRole) {
  return FULL_PRICING_ROLES.includes(viewerRole);
}

const PROJECT_MONEY_FIELDS = ['gmpCeiling', 'actualSpend', 'contingency'];

export function projectProject(p, viewerRole) {
  if (!p) return p;
  const { _id, shareToken, shareCreatedAt, ...rest } = p;
  const out = canSeePricing(viewerRole) ? { ...rest, shareToken, shareCreatedAt } : rest;
  if (!canSeePricing(viewerRole)) {
    for (const f of PROJECT_MONEY_FIELDS) delete out[f];
    // building reps / expediters / subs should not see the client's direct contact
    delete out.clientEmail;
  }
  return out;
}

// Scope lines: subs see only their own trade (with $), expediter + building rep see titles, no $.
export function projectScope(lines, viewer) {
  // Internal references (which CO blocks a line, which COI justified an assignment) are staff-only;
  // everyone else just learns that the line is blocked.
  const clean = lines.map(({ _id, ...l }) => (viewer.role === 'bn_staff' ? l : (({ openBlocks, assignedCoiId, pausedByCo, ...rest }) => ({ ...rest, blocked: !!openBlocks?.length }))(l)));
  if (canSeePricing(viewer.role)) return clean;
  if (viewer.role === 'subcontractor') {
    const trades = (viewer.trades || []).map(t => t.toLowerCase());
    return clean.filter(l => trades.includes((l.trade || '').toLowerCase()));
  }
  return clean.map(stripLineMoney);
}

// Every pricing field a scope line can carry. Building reps / expediters never receive any of them.
export const LINE_MONEY_FIELDS = ['unitCost', 'lineTotal', 'baseCost', 'tariffExposure', 'tariffPct', 'isAllowance', 'costUpdated', 'pendingCoDelta'];
export function stripLineMoney(line) {
  const out = { ...line };
  for (const f of LINE_MONEY_FIELDS) delete out[f];
  return out;
}

// Milestones: full roles see all; subs see only milestones paid to them; others see status, no $.
export function projectMilestones(milestones, viewer) {
  const clean = milestones.map(({ _id, ...m }) => m);
  if (canSeePricing(viewer.role)) return clean;
  if (viewer.role === 'subcontractor') {
    return clean.map(m => (m.payeeEmail && m.payeeEmail === viewer.email) ? m : stripMilestoneMoney(m));
  }
  return clean.map(stripMilestoneMoney);
}

function stripMilestoneMoney({ amount, paymentStatus, payeeEmail, ...rest }) {
  return rest;
}

export function projectChangeOrders(changeOrders, viewerRole) {
  const clean = changeOrders.map(({ _id, ...co }) => co);
  if (canSeePricing(viewerRole)) return clean.map(({ signatureIp, ...co }) => co);
  // No money, no reason, no line-level deltas for anyone who cannot see pricing (full role-aware
  // projection with trade/permit/schedule filtering lives in lib/co/project.js).
  return clean.map(({ costImpact, costDelta, reason, lines, signatureIp, signedBy, againstContingency, ...rest }) => rest);
}

// Messages: audience is an array of roles allowed to read it (empty/missing = everyone).
export function canReadMessage(message, viewerRole) {
  if (viewerRole === 'bn_staff') return true;
  if (!Array.isArray(message.audience) || message.audience.length === 0) return true;
  return message.audience.includes(viewerRole);
}

// Team list: subs never get other parties' contact details.
export function projectParties(parties, viewerRole) {
  const clean = parties.map(({ _id, ...p }) => p);
  if (viewerRole === 'subcontractor') {
    return clean.map(({ userEmail, invitedByEmail, message, ...rest }) => ({
      ...rest,
      userEmail: maskEmail(userEmail)
    }));
  }
  return clean;
}

function maskEmail(email = '') {
  const [name, domain] = email.split('@');
  if (!domain) return '•••';
  return `${name.slice(0, 1)}•••@${domain}`;
}
