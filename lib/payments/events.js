// Webhook event -> payment_events row. Stores ONLY ids, amounts and status: never bank accounts,
// routing numbers, tax ids, names or addresses (Stripe's hosted onboarding collects those and they
// stay at Stripe).
import { Decimal } from '../money.js';
import { toDecimal128 } from '../money-storage.js';

export const LOGGED_TYPES = ['transfer.created', 'transfer.paid', 'transfer.failed', 'transfer.reversed', 'transfer.updated', 'payment_intent.succeeded', 'payout.paid', 'payout.failed'];

export function paymentEventRow(event) {
  const o = event.data?.object || {};
  const cents = Number.isInteger(o.amount) ? o.amount : Number.isInteger(o.amount_received) ? o.amount_received : null;
  return {
    eventId: event.id,
    type: event.type,
    objectId: o.id || null,
    account: event.account || (typeof o.destination === 'string' ? o.destination : null),
    amount: cents === null ? null : toDecimal128(new Decimal(cents).dividedBy(100)),
    currency: o.currency || null,
    milestoneId: o.metadata?.milestoneId || null,
    projectId: o.metadata?.projectId || null,
    livemode: !!event.livemode,
    stripeCreated: event.created ? new Date(event.created * 1000) : null,
    at: new Date()
  };
}

export function accountStatus(acct) {
  return { payoutsEnabled: !!acct.payouts_enabled, detailsSubmitted: !!acct.details_submitted, chargesEnabled: !!acct.charges_enabled };
}
