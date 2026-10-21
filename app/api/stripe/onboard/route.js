import { getCollection } from '@/lib/mongo';
import { route, json, requireUser, HttpError } from '@/lib/api';
import { isVerified } from '@/lib/auth';
import { stripe, PAYEE_ROLES } from '@/lib/payments/stripe';
import { accountStatus } from '@/lib/payments/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

function payee(user) {
  requireUser(user);
  if (!PAYEE_ROLES.includes(user.role)) throw new HttpError(403, 'Payout setup is for subcontractors and expediters');
  if (!isVerified(user)) throw new HttpError(403, 'Your account is still under review');
}

// GET — current payout status. Refreshes from Stripe when an account exists (e.g. on return from onboarding).
export const GET = route(async ({ user }) => {
  payee(user);
  const s = stripe();
  let payouts = user.payouts || null;
  if (s && payouts?.stripeAccountId) {
    const status = accountStatus(await s.accounts.retrieve(payouts.stripeAccountId));
    payouts = { ...payouts, ...status };
    await (await getCollection('users')).updateOne({ id: user.id }, { $set: { 'payouts.payoutsEnabled': status.payoutsEnabled, 'payouts.detailsSubmitted': status.detailsSubmitted, 'payouts.syncedAt': new Date() } });
  }
  return json({ configured: !!s, hasAccount: !!payouts?.stripeAccountId, payoutsEnabled: !!payouts?.payoutsEnabled, detailsSubmitted: !!payouts?.detailsSubmitted });
});

// POST — create (once) the Express account and return a Stripe-hosted onboarding link.
// Stripe collects tax id and bank details; we store only the account id and payouts flag.
export const POST = route(async ({ user }) => {
  payee(user);
  const s = stripe();
  if (!s) throw new HttpError(503, 'Payments are not configured yet');
  const users = await getCollection('users');
  let accountId = user.payouts?.stripeAccountId;
  if (!accountId) {
    const acct = await s.accounts.create(
      { type: 'express', country: 'US', email: user.email, capabilities: { transfers: { requested: true } }, metadata: { userId: user.id } },
      { idempotencyKey: `acct_${user.id}` }
    );
    accountId = acct.id;
    await users.updateOne({ id: user.id }, { $set: { payouts: { stripeAccountId: accountId, payoutsEnabled: false, detailsSubmitted: false, createdAt: new Date() } } });
  }
  const link = await s.accountLinks.create({
    account: accountId,
    type: 'account_onboarding',
    refresh_url: `${APP_URL()}/payments/setup?refresh=1`,
    return_url: `${APP_URL()}/payments/setup?return=1`
  });
  return json({ url: link.url });
});
