import { getCollection } from '@/lib/mongo';
import { route, json, requireStaff, loadProject } from '@/lib/api';
import { computeFinancials } from '@/lib/co/core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The project_financials "view". Staff only: it exposes absorbedLosses (estimating accuracy).
export const GET = route(async ({ user, params }) => {
  requireStaff(user);
  const { project } = await loadProject(user, params.id);
  const cos = await (await getCollection('change_orders')).find({ projectId: project.id }).toArray();
  return json({ financials: computeFinancials(project, cos) });
});
