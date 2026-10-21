import { getCollection } from '@/lib/mongo';
import { route, json, loadProject, HttpError } from '@/lib/api';
import { projectChangeOrder } from '@/lib/co/project';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A CO the viewer may not see is a 404 — indistinguishable from one that does not exist.
export const GET = route(async ({ user, params }) => {
  const { project, access } = await loadProject(user, params.id, { hide: true });
  const co = await (await getCollection('change_orders')).findOne({ id: params.coId, projectId: project.id });
  const view = projectChangeOrder(co, { role: access.role, trades: access.trades });
  if (!view) throw new HttpError(404, 'Not found');
  return json({ changeOrder: view, viewerRole: access.role, project: { id: project.id, name: project.name, code: project.code } });
});
