// Playbook §3.1/§3.2/§4, CTA routing table in QUOTE_ENGINE_BUILD.md §4. Pure —
// decides which call-to-action state a result lands in, not what the button
// says (that's copy, lives in the page). Order matters: a prospect holding a
// competing bid gets the Quote Check regardless of model or size, and a
// disqualified total is shown honestly rather than funneled into a paid offer
// it was never going to convert from.
export function routeCta({ result, holdingCompetingBid = false, multiUnit = false }) {
  if (holdingCompetingBid) return 'quote_check';
  if (multiUnit) return 'multi_site';
  if (result.disqualified) return 'disqualified';
  if (result.model === 'B') return 'model_b_review';
  return 'model_a_review';
}
