import { route, json } from '@/lib/api';
import { getPublishedCard } from '@/lib/quote/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PUBLIC. Just enough to draw the step-1 form: which concepts exist, and
// whether each is F&B (so the form knows to ask about cooking/hood/grease).
// No pricing — that only exists once sqft/borough/condition are given.
export const GET = route(async () => {
  const card = await getPublishedCard();
  if (!card) return json({ available: false });
  return json({
    available: true,
    version: card.version,
    effectiveFrom: card.effectiveFrom,
    concepts: card.concepts.map(c => ({ conceptKey: c.conceptKey, label: c.label, isFnb: c.isFnb, defaultModel: c.defaultModel }))
  });
});
