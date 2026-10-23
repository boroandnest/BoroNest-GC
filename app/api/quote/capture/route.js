import { v4 as uuid } from 'uuid';
import { getCollection } from '@/lib/mongo';
import { route, json, readJson, str, HttpError } from '@/lib/api';
import { rateLimit } from '@/lib/auth';
import { serverDerivedIp } from '@/lib/request-ip';
import { getCardByVersion } from '@/lib/quote/store';
import { calculate, serializeQuote, QuoteError } from '@/lib/quote/calculate';
import { projectPublic, projectStaff } from '@/lib/quote/project';
import { readQuoteInput, InputError } from '@/lib/quote/input';
import { routeCta } from '@/lib/quote/cta';
import { generatePublicRef } from '@/lib/quote/ref';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LEASE_STATUSES = ['not_looking', 'touring', 'loi', 'signed'];

// PUBLIC. Step 3 of the progressive disclosure: "save this quote / send me
// the breakdown." Recomputes from the raw inputs against the EXACT card
// version the prospect saw (lib/quote/store.js's getCardByVersion) — never
// trusts a client-supplied result, and never silently re-prices against
// whatever happens to be published now if a new version went live in the gap.
export const POST = route(async ({ request }) => {
  if (!rateLimit(`quote-capture:${serverDerivedIp(request)}`, 5, 3600000)) {
    throw new HttpError(429, 'Too many requests. Please call or email us directly.');
  }
  const body = await readJson(request);
  let input;
  try {
    input = readQuoteInput(body);
  } catch (e) {
    if (e instanceof InputError) throw new HttpError(422, e.message);
    throw e;
  }
  if (!body.rateCardVersion) throw new HttpError(422, 'Missing rate card version');
  const card = await getCardByVersion(body.rateCardVersion);

  const contactName = str(body.contactName, 200);
  const contactEmail = str(body.contactEmail, 200);
  const contactPhone = str(body.contactPhone, 40);
  if (!contactName || (!contactEmail && !contactPhone)) {
    throw new HttpError(422, 'Name and an email or phone are required');
  }
  const leaseStatus = LEASE_STATUSES.includes(body.leaseStatus) ? body.leaseStatus : null;

  let result;
  try {
    result = calculate(input, card);
  } catch (e) {
    if (e instanceof QuoteError) throw new HttpError(422, e.message);
    throw e;
  }
  const cta = routeCta({ result, holdingCompetingBid: !!body.holdingCompetingBid, multiUnit: !!body.multiUnit });

  const doc = {
    id: uuid(),
    publicRef: await generatePublicRef(),
    rateCardVersion: card.version,
    conceptKey: input.conceptKey, sqft: input.sqft, borough: input.borough, condition: input.condition,
    floors: input.floors ?? null,
    serviceTierKey: input.serviceTierKey ?? null,
    flags: { cooking: input.cooking, afterHours: input.afterHours, existingHood: input.existingHood, existingGrease: input.existingGrease, existingExhaust: input.existingExhaust },
    model: result.model,
    // Full internal detail (trade splits, Model B structure) kept for staff
    // review; the response below sends the prospect only the public cut.
    result: projectStaff(serializeQuote(result)),
    contactName, contactEmail: contactEmail || null, contactPhone: contactPhone || null,
    company: str(body.company, 200) || null,
    leaseStatus, targetOpen: str(body.targetOpen, 20) || null,
    source: str(body.source, 60) || 'organic',
    cta, holdingCompetingBid: !!body.holdingCompetingBid, multiUnit: !!body.multiUnit,
    status: 'captured',
    projectId: null,
    createdAt: new Date(), updatedAt: null
  };

  try {
    await (await getCollection('rate_quotes')).insertOne(doc);
  } catch (e) {
    if (e.code === 121) throw new HttpError(422, 'Could not save: missing required fields');
    throw e;
  }

  return json({ publicRef: doc.publicRef, cta, result: projectPublic(serializeQuote(result)) }, 201);
});
