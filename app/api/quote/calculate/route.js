import { route, json, readJson, HttpError } from '@/lib/api';
import { rateLimit } from '@/lib/auth';
import { serverDerivedIp } from '@/lib/request-ip';
import { getPublishedCard } from '@/lib/quote/store';
import { calculate, serializeQuote, QuoteError } from '@/lib/quote/calculate';
import { projectPublic } from '@/lib/quote/project';
import { readQuoteInput, InputError } from '@/lib/quote/input';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PUBLIC. No contact info required — "give the number before asking for the
// email" (playbook §3.1). Nothing is written to the database here; a
// `rate_quotes` row is only created at capture, once a prospect chooses to
// save or send the breakdown.
export const POST = route(async ({ request }) => {
  if (!rateLimit(`quote-calc:${serverDerivedIp(request)}`, 60, 3600000)) {
    throw new HttpError(429, 'Too many requests. Try again shortly.');
  }
  const card = await getPublishedCard();
  if (!card) throw new HttpError(503, 'The calculator is temporarily unavailable. Please contact us directly.');

  try {
    const input = readQuoteInput(await readJson(request));
    const result = projectPublic(serializeQuote(calculate(input, card)));
    return json({ rateCardVersion: card.version, effectiveFrom: card.effectiveFrom, result });
  } catch (e) {
    if (e instanceof InputError || e instanceof QuoteError) throw new HttpError(422, e.message);
    throw e;
  }
});
