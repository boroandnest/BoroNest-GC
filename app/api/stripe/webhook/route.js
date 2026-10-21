import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getCollection } from '@/lib/mongo';
import { bootstrap } from '@/lib/server/bootstrap';
import { paymentEventRow, accountStatus, LOGGED_TYPES } from '@/lib/payments/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Stripe webhook. Signature verification is mandatory: anything unsigned or mis-signed is a 400
// and touches nothing. Events are recorded once (unique eventId), so Stripe retries are harmless.
// Nothing from the payload except ids/amounts/status is stored or logged.
export async function POST(request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  const raw = await request.text();
  let event;
  try {
    event = Stripe.webhooks.constructEvent(raw, request.headers.get('stripe-signature') || '', secret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }
  try {
    await bootstrap();
    const events = await getCollection('payment_events');
    if (await events.findOne({ eventId: event.id })) return NextResponse.json({ received: true, duplicate: true });

    if (event.type === 'account.updated') {
      const acct = event.data.object;
      const s = accountStatus(acct);
      await (await getCollection('users')).updateOne(
        { 'payouts.stripeAccountId': acct.id },
        { $set: { 'payouts.payoutsEnabled': s.payoutsEnabled, 'payouts.detailsSubmitted': s.detailsSubmitted, 'payouts.syncedAt': new Date() } }
      );
      await events.insertOne({ eventId: event.id, type: event.type, objectId: acct.id, account: acct.id, payoutsEnabled: s.payoutsEnabled, livemode: !!event.livemode, at: new Date() });
    } else if (LOGGED_TYPES.includes(event.type)) {
      const row = paymentEventRow(event);
      await events.insertOne(row);
      if (row.milestoneId && (event.type === 'transfer.reversed' || event.type === 'transfer.failed')) {
        await (await getCollection('milestones')).updateOne({ id: row.milestoneId }, { $set: { releaseStatus: 'transfer_failed', releaseError: event.type } });
      }
    } else {
      await events.insertOne({ eventId: event.id, type: event.type, ignored: true, at: new Date() });
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    if (e.code === 11000) return NextResponse.json({ received: true, duplicate: true });
    console.error('stripe webhook error:', event.type, e.message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
