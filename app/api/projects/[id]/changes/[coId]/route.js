import { getCollection } from '@/lib/mongo';
import { route, json, requireStaff, loadProject, HttpError } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async ({ user, params }) => {
  const { project } = await loadProject(user, params.id);
  requireStaff(user);
  const co = await (await getCollection('change_orders')).findOne({ id: params.coId, projectId: project.id });
  if (!co) throw new HttpError(404, 'Not found');
  return json({ changeOrder: co });
});
