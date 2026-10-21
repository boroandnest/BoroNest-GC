import { getCollection } from '@/lib/mongo';
import { route, json, readJson, requireStaff, loadProject, HttpError } from '@/lib/api';
import { instantiateIntoProject } from '@/lib/templates/persist';
import { TemplateError } from '@/lib/templates/params';
import { today } from '@/lib/dates';
import { estimateRollup, worksheetRow } from '@/lib/estimate';
import { toMoney, toMoneyString } from '@/lib/money';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/projects/:id/estimate — the GMP worksheet (staff only). Every figure is computed here
// with lib/money and sent as a string; the page does no arithmetic.
export const GET = route(async ({ user, params }) => {
  requireStaff(user);
  const { project } = await loadProject(user, params.id);
  const lines = await (await getCollection('scope_lines')).find({ projectId: project.id }).sort({ seq: 1 }).limit(1000).toArray();
  const now = new Date();
  const rows = lines.map(l => worksheetRow(l, now));
  const templates = await (await getCollection('scope_templates'))
    .find({}, { projection: { id: 1, name: 1, params: 1 } }).sort({ name: 1 }).limit(200).toArray();
  return json({
    project: {
      id: project.id, code: project.code, name: project.name, address: project.address,
      gmpCeiling: toMoneyString(toMoney(project.gmpCeiling ?? 0)),
      contingency: toMoneyString(toMoney(project.contingency ?? 0)),
      estimate: project.estimate || null
    },
    rows,
    staleCount: rows.filter(r => r.staleCost).length,
    rollup: estimateRollup(lines, project.contingency ?? 0),
    templates: templates.map(t => ({
      id: t.id, name: t.name,
      inputs: (t.params || []).filter(p => p.kind === 'input').map(p => ({ name: p.name, label: p.label, unit: p.unit || '', defaultVal: p.defaultVal }))
    }))
  });
});

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
