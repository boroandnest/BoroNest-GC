import { route, json, readJson, requireStaff, loadProject, HttpError } from '@/lib/api';
import { createRetainer, BillingError } from '@/lib/billing/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST { label, monthlyAmount, startsOn, endsOn?, billDay?, guaranteeKind?, guaranteeMetric?, guaranteeCreditPct? }
export const POST = route(async ({ request, user, params }) => {
  requireStaff(user);
  const { project } = await loadProject(user, params.id);
  try {
    return json({ retainer: await createRetainer({ project, input: await readJson(request), user }) }, 201);
  } catch (e) {
    if (e instanceof BillingError) throw new HttpError(422, e.message);
    throw e;
  }
});
