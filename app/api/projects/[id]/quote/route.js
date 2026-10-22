import { getCollection } from '@/lib/mongo';
import { route, json, readJson, requireStaff, loadProject, HttpError } from '@/lib/api';
import { getLiveQuote, quoteHistory, issueQuote } from '@/lib/quotes';
import { computeVariance, varianceFor } from '@/lib/variance';
import { today as todayIso } from '@/lib/dates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COMMERCIAL_ROLES = ['bn_staff', 'client', 'management'];

async function buildVariance(project, role) {
  const quote = await getLiveQuote(project.id);
  if (!quote) return null;
  const changeOrders = await (await getCollection('change_orders')).find({ projectId: project.id }).toArray();
  return varianceFor(computeVariance({ quote, project, changeOrders, today: todayIso() }), role) ?? null;
}

// GET — the variance, projected for the viewer. A trade or building rep has no
// business with the client's commercial position, so varianceFor returns
// undefined for them and this answers 404 rather than an empty 200: the
// response must not reveal that a quote exists.
export const GET = route(async ({ user, params }) => {
  const { project, access } = await loadProject(user, params.id, { hide: true });
  // Decided by role, never by whether a quote happens to exist, so the response
  // cannot reveal one to a trade by its shape.
  if (!COMMERCIAL_ROLES.includes(access.role)) throw new HttpError(404, 'Not found');
  const variance = await buildVariance(project, access.role);
  const history = access.role === 'bn_staff' ? await quoteHistory(project.id) : [];
  return json({
    variance,
    history: history.map(({ _id, ...q }) => ({ ...q, amount: q.amount?.toString() }))
  });
});

// POST — issue or re-issue the quote. Staff only: this is the number B&N stands
// behind. Writing it also records the job's start and completion when supplied,
// because a schedule variance is unknowable without them and staff enter both
// facts at the same moment.
export const POST = route(async ({ request, user, params }) => {
  requireStaff(user);
  const { project } = await loadProject(user, params.id);
  const body = await readJson(request);
  const quote = await issueQuote({ projectId: project.id, body, user });

  const dates = {};
  for (const f of ['startedAt', 'completedAt']) {
    if (body[f] === '' || body[f] === null) dates[f] = null;
    else if (typeof body[f] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body[f])) dates[f] = body[f];
  }
  if (Object.keys(dates).length) {
    await (await getCollection('projects')).updateOne({ id: project.id }, { $set: dates });
    Object.assign(project, dates);
  }

  const changeOrders = await (await getCollection('change_orders')).find({ projectId: project.id }).toArray();
  return json({
    quote: { ...quote, amount: quote.amount.toString(), _id: undefined },
    variance: computeVariance({ quote, project, changeOrders, today: todayIso() })
  }, 201);
});
