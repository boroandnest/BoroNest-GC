// Server-side role projection for change orders (PHASE2_EXECUTE T7). Pure.
//
// | role                 | sees                   | cost delta     | reason | can sign |
// |----------------------|------------------------|----------------|--------|----------|
// | client, management   | all                    | yes            | yes    | yes      |
// | bn_staff             | all                    | yes            | yes    | no       |
// | building-rep         | schedule impact only   | no             | no     | no       |
// | expediter            | permit-affecting only  | no             | no     | no       |
// | subcontractor        | own trade only         | own scope only | no*    | no       |
//
// * subs always see reason = scope_revision: a sub must never learn that a change was classified
//   as bn_error (our own mistake). Returns null when the viewer may not see the CO at all — callers
//   turn that into 404 (not a filtered 200).
import { toMoney, toMoneyString, Decimal } from '../money.js';
import { REASON_PROSE } from './financials.js';

const money = (v) => toMoneyString(toMoney(v ?? 0));
const base = (co) => ({ id: co.id, number: co.number, code: `CO-${String(co.number).padStart(3, '0')}`, title: co.title, status: co.status, createdAt: co.createdAt });

export function projectChangeOrder(co, viewer) {
  if (!co) return null;
  const role = viewer.role;

  if (role === 'bn_staff') {
    return {
      ...base(co), description: co.description, reason: co.reason, reasonText: REASON_PROSE[co.reason],
      costDelta: money(co.costDelta), againstContingency: !!co.againstContingency,
      scheduleImpactDays: co.scheduleImpactDays || 0, affectsPermit: !!co.affectsPermit,
      lines: (co.lines || []).map(l => ({ scopeLineId: l.scopeLineId, trade: l.trade, title: l.title, costDelta: money(l.costDelta), block: !!l.block })),
      signedName: co.signedName, signedAt: co.signedAt, signatureIp: co.signatureIp, signedRole: co.signedRole,
      voidedAt: co.voidedAt, voidReason: co.voidReason, legacy: !!co.legacy, canSign: false
    };
  }

  if (role === 'client' || role === 'management') {
    return {
      ...base(co), description: co.description, reasonText: REASON_PROSE[co.reason],
      costDelta: co.reason === 'bn_error' ? '0.00' : money(co.costDelta), noCostToYou: co.reason === 'bn_error',
      againstContingency: !!co.againstContingency,
      scheduleImpactDays: co.scheduleImpactDays || 0, affectsPermit: !!co.affectsPermit,
      lines: (co.lines || []).map(l => ({ trade: l.trade, title: l.title, costDelta: co.reason === 'bn_error' ? '0.00' : money(l.costDelta) })),
      signedName: co.signedName, signedAt: co.signedAt, voidedAt: co.voidedAt,
      canSign: co.status === 'pending_signature'
    };
  }

  if (role === 'building-rep') {
    if (!co.scheduleImpactDays) return null;
    return { ...base(co), scheduleImpactDays: co.scheduleImpactDays, canSign: false };
  }

  if (role === 'expediter') {
    if (!co.affectsPermit) return null;
    return { ...base(co), affectsPermit: true, scheduleImpactDays: co.scheduleImpactDays || 0, canSign: false };
  }

  if (role === 'subcontractor') {
    const trades = (viewer.trades || []).map(t => String(t).toLowerCase());
    const own = (co.lines || []).filter(l => trades.includes(String(l.trade).toLowerCase()));
    if (!own.length) return null;
    const ownTotal = own.reduce((a, l) => a.plus(toMoney(l.costDelta ?? 0)), new Decimal(0));
    return {
      ...base(co),
      reason: 'scope_revision', reasonText: REASON_PROSE.scope_revision,
      costDelta: toMoneyString(ownTotal),
      scheduleImpactDays: co.scheduleImpactDays || 0,
      lines: own.map(l => ({ trade: l.trade, title: l.title, costDelta: money(l.costDelta) })),
      canSign: false
    };
  }

  return null;
}

export function projectChangeOrderList(cos, viewer) {
  return cos.map(co => projectChangeOrder(co, viewer)).filter(Boolean);
}
