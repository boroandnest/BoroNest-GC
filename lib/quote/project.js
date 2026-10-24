// Q2 · Public/staff projection. Trade splits, the Model B fee structure, and
// the market-source attribution never reach a public response body — not
// hidden in CSS, absent from the JSON. Verify in the network response, not
// the rendered page (the Phase 1 acceptance test applies here too).
//
// marketSource names the firm a comparison figure came from (e.g. "LOD
// Construction, 2026") — a competitor whose numbers we use for comparison but
// whose name must never reach a client or prospect. marketLo/marketHi (the
// figures themselves) stay public as an unattributed "published NYC market
// range": the owner has approved using the numbers, never the name.
export function projectPublic(r) {
  const { tradeSplits, modelBStructure, marketSource, ...pub } = r;
  return pub;
}

export const projectStaff = (r) => r;
