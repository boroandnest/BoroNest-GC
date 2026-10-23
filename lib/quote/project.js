// Q2 · Public/staff projection. Trade splits and the Model B fee structure
// never reach a public response body — not hidden in CSS, absent from the
// JSON. Verify in the network response, not the rendered page (the Phase 1
// acceptance test applies here too).
export function projectPublic(r) {
  const { tradeSplits, modelBStructure, ...pub } = r;
  return pub;
}

export const projectStaff = (r) => r;
