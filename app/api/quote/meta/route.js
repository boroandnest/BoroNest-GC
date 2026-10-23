import { route, json } from '@/lib/api';
import { getPublishedCard } from '@/lib/quote/store';
import { toMoneyString } from '@/lib/money';

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
    concepts: card.concepts.map(c => ({ conceptKey: c.conceptKey, label: c.label, isFnb: c.isFnb, defaultModel: c.defaultModel })),
    // Public tier info for the pricing page and the /quote tier selector —
    // fee basis and inclusions only, nothing staff-only.
    serviceTiers: (card.serviceTiers || []).map(t => ({
      key: t.key, name: t.name, tierLabel: t.tierLabel, featured: t.featured, feeLabel: t.feeLabel,
      inclusions: t.inclusions, exclusions: t.exclusions, forWho: t.forWho, commitment: t.commitment,
      addOns: (t.addOns || []).map(a => ({
        label: a.label, atCost: a.atCost,
        amountLo: a.amountLo ? toMoneyString(a.amountLo) : null,
        amountHi: a.amountHi ? toMoneyString(a.amountHi) : null
      }))
    }))
  });
});
