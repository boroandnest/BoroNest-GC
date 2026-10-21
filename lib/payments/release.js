// Milestone release job (PHASE2_EXECUTE T12). Runs every 15 minutes.
//
// Double-payment defences, in order:
//   1. Atomic claim: a milestone moves to releaseStatus 'releasing' via findOneAndUpdate before any
//      Stripe call, so two concurrent runs cannot both reach Stripe for the same milestone.
//   2. Idempotency key `ms_${milestone.id}` on every transfer: if a run crashes after Stripe accepted
//      the transfer but before we recorded it, the retry gets the SAME transfer back from Stripe.
//   3. The milestones validator requires stripeTransferId on 'released', and a unique index forbids
//      one transfer id on two milestones.
// A payee without payouts_enabled is a logged failure + alert, never a blind retry.
import { getCollection } from '../mongo.js';
import { toMoney } from '../money.js';
import { logEvent } from '../access.js';
import { sendReleaseFailureNotice } from '../email.js';

const SYSTEM = { id: 'system:release', role: 'system' };
const LOCK_MS = 10 * 60000;

export function idempotencyKey(milestone) {
  return `ms_${milestone.id}`;
}

// Integer cents from a Decimal amount, exactly. Refuses fractional cents.
export function toCents(amount) {
  const c = toMoney(amount).times(100);
  if (!c.isInteger() || c.lessThanOrEqualTo(0)) throw new Error(`invalid transfer amount ${amount}`);
  return parseInt(c.toString(), 10);
}

export async function releaseDueMilestones({ stripe, now = new Date(), notify = sendReleaseFailureNotice } = {}) {
  const summary = { due: 0, released: 0, failed: 0, skipped: 0 };
  if (!stripe) return { ...summary, note: 'stripe not configured' };
  const ms = await getCollection('milestones');
  const users = await getCollection('users');
  const events = await getCollection('payment_events');

  const dueFilter = {
    verifiedAt: { $type: 'date' },
    releaseEta: { $lte: now },
    payeeId: { $type: 'string' },
    stripeTransferId: { $exists: false },
    $and: [
      { $or: [{ disputeOpenedAt: { $exists: false } }, { disputeOpenedAt: null }, { disputeResolvedAt: { $type: 'date' } }] },
      { $or: [{ releaseStatus: { $in: ['in_window', 'disputed', 'awaiting_verification', null] } }, { releaseStatus: { $exists: false } }, { releaseStatus: 'releasing', releaseLockAt: { $lt: new Date(now.getTime() - LOCK_MS) } }] }
    ]
  };
  const candidates = await ms.find(dueFilter, { projection: { id: 1 } }).limit(200).toArray();
  summary.due = candidates.length;

  for (const { id } of candidates) {
    // 1. claim
    const m = await ms.findOneAndUpdate({ ...dueFilter, id }, { $set: { releaseStatus: 'releasing', releaseLockAt: new Date() } }, { returnDocument: 'after' });
    if (!m) { summary.skipped++; continue; }

    const payee = await users.findOne({ id: m.payeeId });
    const fail = async (reason, detail) => {
      await ms.updateOne({ id }, { $set: { releaseStatus: 'transfer_failed', releaseError: reason, releaseFailedAt: new Date() }, $unset: { releaseLockAt: '' } });
      await events.insertOne({ type: 'transfer_failed', milestoneId: id, projectId: m.projectId, reason, detail: detail ? String(detail).slice(0, 300) : null, at: new Date() });
      await logEvent(m.projectId, SYSTEM, 'system', 'transfer_failed', { milestoneId: id, reason });
      await notify({ milestone: m, payee, reason }).catch(() => {});
      summary.failed++;
    };

    if (!payee?.payouts?.stripeAccountId || !payee.payouts.payoutsEnabled) { await fail('payouts_not_enabled'); continue; }

    let cents;
    try { cents = toCents(m.amount); } catch (e) { await fail('invalid_amount', e.message); continue; }

    try {
      // 2. idempotent transfer
      const transfer = await stripe.transfers.create(
        { amount: cents, currency: 'usd', destination: payee.payouts.stripeAccountId, transfer_group: `project_${m.projectId}`, metadata: { milestoneId: id, projectId: m.projectId } },
        { idempotencyKey: idempotencyKey(m) }
      );
      // 3. record (validator: released requires stripeTransferId)
      await ms.updateOne({ id }, { $set: { stripeTransferId: transfer.id, releaseStatus: 'released', releasedAt: new Date(), paymentStatus: 'paid' }, $unset: { releaseLockAt: '' } });
      await events.insertOne({ type: 'transfer_created_by_release', milestoneId: id, projectId: m.projectId, objectId: transfer.id, amountCents: cents, at: new Date() });
      await logEvent(m.projectId, SYSTEM, 'system', 'milestone_released', { milestoneId: id, transferId: transfer.id });
      summary.released++;
    } catch (e) {
      await fail('stripe_error', e.message);
    }
  }
  return summary;
}
