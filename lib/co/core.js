// Change orders: create / sign / void, the scope-line work block, and project financials.
// The block itself is enforced by MongoDB (migrations/002_change_orders.js validator); this module
// keeps openBlocks in sync and turns the database rejection into a clear 409.
import { v4 as uuid } from 'uuid';
import { getCollection } from '../mongo.js';
import { round2, toMoneyString, Decimal } from '../money.js';
import { toDecimal128 } from '../money-storage.js';
import { logEvent } from '../access.js';
import { HttpError } from '../api.js';

import { CO_REASONS } from './financials.js';
export { CO_REASONS, REASON_PROSE } from './financials.js';

const BLOCKING = ['draft', 'pending_signature'];
const WORK_STATUSES = ['in_progress', 'complete'];

// ---------- create ----------
// input: { title, description, reason, againstContingency, scheduleImpactDays, affectsPermit,
//          costDelta?, lines: [{ scopeLineId, costDelta, block }] , status? ('draft'|'pending_signature') }
export async function createChangeOrder({ project, input, user }) {
  const title = String(input.title || '').trim().slice(0, 200);
  if (!title) throw new HttpError(422, 'A change order needs a title');
  if (!CO_REASONS.includes(input.reason)) throw new HttpError(422, 'Choose a reason');
  const scope = await getCollection('scope_lines');

  const lines = [];
  for (const l of Array.isArray(input.lines) ? input.lines : []) {
    const line = await scope.findOne({ id: String(l.scopeLineId || ''), projectId: project.id });
    if (!line) throw new HttpError(422, `Scope line ${l.scopeLineId} is not on this project`);
    if (lines.some(x => x.scopeLineId === line.id)) continue;
    lines.push({ scopeLineId: line.id, trade: line.trade || 'general', title: line.title, costDelta: round2(l.costDelta || 0), block: l.block !== false });
  }
  // Total = sum of line deltas when lines carry money; otherwise the stated total.
  const lineSum = lines.reduce((a, l) => a.plus(l.costDelta), new Decimal(0));
  const costDelta = lines.length && !lineSum.isZero() ? round2(lineSum) : round2(input.costDelta || 0);

  const cos = await getCollection('change_orders');
  const last = await cos.find({ projectId: project.id }).sort({ number: -1 }).limit(1).toArray();
  const co = {
    id: uuid(),
    projectId: project.id,
    number: (last[0]?.number || 0) + 1,
    title,
    description: String(input.description || '').slice(0, 5000),
    reason: input.reason,
    status: input.status === 'draft' ? 'draft' : 'pending_signature',
    costDelta: toDecimal128(costDelta),
    againstContingency: !!input.againstContingency && input.reason !== 'bn_error',
    scheduleImpactDays: Math.trunc(+input.scheduleImpactDays || 0),
    affectsPermit: !!input.affectsPermit,
    lines: lines.map(l => ({ ...l, costDelta: toDecimal128(l.costDelta) })),
    createdBy: user.id,
    createdAt: new Date()
  };
  await cos.insertOne(co);
  await applyBlocks(co, user);
  await logEvent(project.id, user, 'bn_staff', 'change_order_created', { coId: co.id, number: co.number, reason: co.reason, costDelta: toMoneyString(costDelta) });
  return co;
}

// Block every linked line. A line already in progress is paused in the same atomic update —
// the validator would otherwise reject "in_progress with an open block".
async function applyBlocks(co, user) {
  const scope = await getCollection('scope_lines');
  const blocks = await getCollection('scope_blocks');
  for (const l of co.lines.filter(x => x.block)) {
    await blocks.updateOne(
      { coId: co.id, scopeLineId: l.scopeLineId },
      { $setOnInsert: { id: uuid(), coId: co.id, scopeLineId: l.scopeLineId, projectId: co.projectId, createdAt: new Date(), createdBy: user.id, clearedAt: null } },
      { upsert: true }
    );
    await scope.updateOne(
      { id: l.scopeLineId, status: { $in: WORK_STATUSES } },
      { $set: { status: 'paused', pausedByCo: co.id }, $addToSet: { openBlocks: co.id } }
    );
    await scope.updateOne({ id: l.scopeLineId, status: { $nin: WORK_STATUSES } }, { $addToSet: { openBlocks: co.id } });
  }
}

async function clearBlocks(co, how, user) {
  await (await getCollection('scope_blocks')).updateMany({ coId: co.id, clearedAt: null }, { $set: { clearedAt: new Date(), clearedBy: how, clearedByUser: user.id } });
  await (await getCollection('scope_lines')).updateMany({ openBlocks: co.id }, { $pull: { openBlocks: co.id } });
}

// ---------- sign (client / management only; enforced by the caller) ----------
export async function signChangeOrder({ project, coId, signedName, ip, user, role }) {
  const name = String(signedName || '').trim().slice(0, 120);
  if (name.length < 2) throw new HttpError(422, 'Type your full name to sign');
  const cos = await getCollection('change_orders');
  const signedAt = new Date();
  // Atomic: only a CO that is still awaiting signature can be signed, exactly once.
  const co = await cos.findOneAndUpdate(
    { id: coId, projectId: project.id, status: 'pending_signature' },
    { $set: { status: 'signed', signedBy: user.id, signedName: name, signedAt, signatureIp: ip, signedRole: role } },
    { returnDocument: 'after' }
  );
  if (!co) {
    const exists = await cos.findOne({ id: coId, projectId: project.id });
    if (!exists) throw new HttpError(404, 'Not found');
    throw new HttpError(409, `This change order is ${exists.status.replace('_', ' ')} and cannot be signed`);
  }
  await clearBlocks(co, 'signed', user);
  await logEvent(project.id, user, role, 'change_order_signed', { coId: co.id, number: co.number, signatureIp: ip });
  return co;
}

// ---------- void (staff) ----------
export async function voidChangeOrder({ project, coId, reason, user }) {
  const cos = await getCollection('change_orders');
  const co = await cos.findOneAndUpdate(
    { id: coId, projectId: project.id, status: { $in: BLOCKING } },
    { $set: { status: 'void', voidedAt: new Date(), voidedBy: user.id, voidReason: String(reason || '').slice(0, 1000) } },
    { returnDocument: 'after' }
  );
  if (!co) throw new HttpError(409, 'Only a draft or unsigned change order can be voided');
  await clearBlocks(co, 'void', user);
  await logEvent(project.id, user, 'bn_staff', 'change_order_voided', { coId: co.id, number: co.number });
  return co;
}

// ---------- the guarded status transition ----------
// Every scope-line status change goes through here. MongoDB is the final authority (validator);
// this adds a readable error naming the blocking change orders.
export async function setScopeLineStatus({ projectId, lineId, status, user, role }) {
  const allowed = ['not_started', 'in_progress', 'paused', 'complete'];
  if (!allowed.includes(status)) throw new HttpError(422, 'invalid status');
  const scope = await getCollection('scope_lines');
  const line = await scope.findOne({ id: lineId, projectId });
  if (!line) throw new HttpError(404, 'Scope line not found');
  try {
    await scope.updateOne({ id: lineId, projectId }, { $set: { status, statusChangedAt: new Date() }, $unset: status === 'in_progress' ? { pausedByCo: '' } : {} });
  } catch (e) {
    if (e.code === 121) {
      const blocking = await (await getCollection('change_orders')).find({ id: { $in: line.openBlocks || [] } }, { projection: { number: 1, title: 1, status: 1 } }).toArray();
      throw new HttpError(409, `Blocked by unsigned change order${blocking.length > 1 ? 's' : ''} ${blocking.map(b => `CO-${String(b.number).padStart(3, '0')}`).join(', ')}. Work cannot start until it is signed or voided.`, {
        code: 'blocked_by_change_order', blockedBy: blocking.map(b => ({ number: b.number, title: b.title, status: b.status }))
      });
    }
    throw e;
  }
  await logEvent(projectId, user, role, 'scope_status_changed', { lineId, from: line.status, to: status });
  return { ...line, status };
}

export { computeFinancials, projectFinancialsFor } from './financials.js';
