import { getCollection } from '@/lib/mongo';
import { route, json, readJson, requireStaff, loadProject, HttpError } from '@/lib/api';
import { instantiateIntoProject } from '@/lib/templates/persist';
import { TemplateError } from '@/lib/templates/params';
import { today } from '@/lib/dates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/projects/:id/estimate  { templateId, inputs: { name: value }, startDate: 'YYYY-MM-DD' }
// Staff only. Instantiates (or re-instantiates) the project's scope from a template.
export const POST = route(async ({ request, user, params }) => {
  requireStaff(user);
  const { project } = await loadProject(user, params.id);
  const body = await readJson(request);
  const templateDoc = await (await getCollection('scope_templates')).findOne({ id: String(body.templateId || '') });
  if (!templateDoc) throw new HttpError(404, 'Template not found');
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(body.startDate || '') ? body.startDate : (project.estimate?.startDate || today());
  try {
    const result = await instantiateIntoProject({ project, templateDoc, inputs: body.inputs || {}, startDate, user });
    return json(result);
  } catch (e) {
    if (e instanceof TemplateError) throw new HttpError(422, e.message, { code: e.code, ...e.meta });
    throw e;
  }
});
