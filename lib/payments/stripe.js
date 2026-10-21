// Stripe client — server only. Never import this from a client component: STRIPE_SECRET_KEY must
// not reach a browser bundle (checked in tests by grepping .next/static).
import Stripe from 'stripe';

let client;
export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-08-27.basil', maxNetworkRetries: 0, appInfo: { name: 'boro-nest' } });
  return client;
}

// For tests / injection.
export function setStripeForTests(fake) { client = fake; }

export const PAYEE_ROLES = ['subcontractor', 'expediter'];
