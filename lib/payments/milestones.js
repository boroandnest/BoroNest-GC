// Milestone lifecycle: create -> verify (PM, with photos; opens a 24h dispute window) ->
// [client may dispute inside the window; staff resolve] -> release job pays after the window.
import { v4 as uuid } from 'uuid';
import { getCollection } from '../mongo.js';
import { HttpError } from '../api.js';
import { logEvent } from '../access.js';
import { round2, toMoneyString, toMoney } from '../money.js';
import { toDecimal128 } from '../money-storage.js';

export const DISPUTE_WINDOW_MS = 24 * 3600000;

export async function createMilestone({ project, input, user }) {
  const title = String(input.title || '').trim().slice(0, 200);
  if (!title) throw new HttpError(422, 'Milestone needs a title');
  const amount = round2(input.amount || 0);
  if (amount.lessThanOrEqualTo(0)) throw new HttpError(422, 'Amount must be greater than zero');
  let payee = null;
  if (input.payeeId) {
    payee = await (await getCollection('users')).findOne({ id: String(input.payeeId) });
    if (!payee || !['subcontractor', 'expediter'].includes(payee.role)) throw new HttpError(422, 'Payee must be a subcontractor or expediter');
    const onProject = await (await getCollection('project_parties')).findOne({ projectId: project.id, userEmail: payee.email, status: 'accepted' });
    if (!onProject) throw new HttpError(422, 'Payee is not on this project');
  }
  const ms = await getCollection('milestones');
  const count = await ms.countDocuments({ projectId: project.id });
  const m = {
    id: uuid(), projectId: project.id, seq: count + 1,
    title, name: title, trigger: String(input.trigger || '').slice(0, 500),
    amount: toDecimal128(amount),
    payeeId: payee?.id || null, payeeEmail: payee?.email || null, payeeName: payee ? (payee.company || payee.name || '') : 'Client draw',
    dueDate: input.dueDate ? new Date(input.dueDate) : null,
    status: 'upcoming', paymentStatus: 'not_started',
    releaseStatus: payee ? 'awaiting_verification' : 'not_applicable',
    createdAt: new Date(), createdBy: user.id
  };
  await ms.insertOne(m);
  await logEvent(project.id, user, 'bn_staff', 'milestone_created', { milestoneId: m.id, amount: toMoneyString(amount) });
  return m;
}

export async function verifyMilestone({ project, milestoneId, user, photoIds = [], now = new Date() }) {
  const ms = await getCollection('milestones');
  const m = await ms.findOneAndUpdate(
    { id: milestoneId, projectId: project.id, verifiedAt: { $exists: false } },
    // one atomic pipeline update: verification, the 24h window and the release state together
    [{ $set: {
      status: 'complete', completedAt: now, verifiedAt: now, verifiedBy: user.id,
      releaseEta: new Date(now.getTime() + DISPUTE_WINDOW_MS), paymentStatus: 'processing', photoIds: { $literal: photoIds },
      releaseStatus: { $cond: [{ $eq: [{ $type: '$payeeId' }, 'string'] }, 'in_window', 'not_applicable'] }
    } }],
    { returnDocument: 'after' }
  );
  if (!m) {
    const exists = await ms.findOne({ id: milestoneId, projectId: project.id });
    if (!exists) throw new HttpError(404, 'Milestone not found');
    throw new HttpError(409, 'Milestone already verified');
  }
  await logEvent(project.id, user, 'bn_staff', 'milestone_verified', { milestoneId: m.id, releaseEta: m.releaseEta, photos: photoIds.length });
  return m;
}

export async function openDispute({ project, milestoneId, user, role, reason, now = new Date() }) {
  const ms = await getCollection('milestones');
  const m = await ms.findOneAndUpdate(
    { id: milestoneId, projectId: project.id, releaseEta: { $gt: now }, stripeTransferId: { $exists: false }, $or: [{ disputeOpenedAt: { $exists: false } }, { disputeOpenedAt: null }] },
    { $set: { disputeOpenedAt: now, disputeOpenedBy: user.id, disputeReason: String(reason || '').slice(0, 2000), releaseStatus: 'disputed' } },
    { returnDocument: 'after' }
  );
  if (!m) throw new HttpError(409, 'This milestone can no longer be disputed (outside the 24-hour window, already paid, or already disputed)');
  await logEvent(project.id, user, role, 'milestone_disputed', { milestoneId });
  return m;
}

export async function resolveDispute({ project, milestoneId, user, note }) {
  const ms = await getCollection('milestones');
  const m = await ms.findOneAndUpdate(
    { id: milestoneId, projectId: project.id, disputeOpenedAt: { $type: 'date' }, disputeResolvedAt: { $exists: false } },
    { $set: { disputeResolvedAt: new Date(), disputeResolvedBy: user.id, disputeResolution: String(note || '').slice(0, 2000), releaseStatus: 'in_window' } },
    { returnDocument: 'after' }
  );
  if (!m) throw new HttpError(409, 'No open dispute on this milestone');
  await logEvent(project.id, user, 'bn_staff', 'milestone_dispute_resolved', { milestoneId });
  return m;
}

// After a logged failure (e.g. payee finished Stripe onboarding), staff re-queue explicitly.
export async function retryRelease({ project, milestoneId, user }) {
  const ms = await getCollection('milestones');
  const r = await ms.updateOne(
    { id: milestoneId, projectId: project.id, releaseStatus: 'transfer_failed', stripeTransferId: { $exists: false } },
    { $set: { releaseStatus: 'in_window' }, $unset: { releaseError: '' } }
  );
  if (!r.matchedCount) throw new HttpError(409, 'Only a failed, unpaid release can be retried');
  await logEvent(project.id, user, 'bn_staff', 'milestone_release_retry', { milestoneId });
}

export function milestoneView(m, now = new Date()) {
  const { _id, ...rest } = m;
  return {
    ...rest,
    amount: m.amount === undefined || m.amount === null ? undefined : toMoneyString(toMoney(m.amount)),
    inDisputeWindow: !!(m.releaseEta && new Date(m.releaseEta) > now && !m.stripeTransferId),
    canDispute: !!(m.releaseEta && new Date(m.releaseEta) > now && !m.stripeTransferId && !m.disputeOpenedAt)
  };
}
