import { v4 as uuid } from 'uuid';
import { getCollection } from '@/lib/mongo';
import { route, json, readJson, requireStaff, str, HttpError } from '@/lib/api';
import { SECTION_KEYS, sectionsFor } from '@/lib/presentations/sections';
import { figure } from '@/lib/savings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Staff only. A presentation is a document B&N stands behind; nobody else
// composes one.
export const GET = route(async ({ user, url }) => {
  requireStaff(user);
  const projectId = url.searchParams.get('projectId');
  const q = projectId ? { projectId: String(projectId) } : {};
  const decks = await (await getCollection('presentations')).find(q).sort({ createdAt: -1 }).limit(100).toArray();
  return json({ presentations: decks.map(({ _id, ...d }) => d), sectionKeys: SECTION_KEYS });
});

export const POST = route(async ({ request, user }) => {
  requireStaff(user);
  const b = await readJson(request);
  const kind = b.kind === 'partner' ? 'partner' : 'owner';
  const allowed = new Set(sectionsFor(kind));
  const sections = (Array.isArray(b.sections) ? b.sections : []).filter(s => allowed.has(s));
  if (!sections.length) throw new HttpError(422, `Choose at least one section available to a ${kind} deck`);
  if (kind === 'owner' && !b.projectId) throw new HttpError(422, 'An owner deck needs a project');

  // Every supplied figure is validated here, at the door. A deck that cannot
  // label its numbers is never stored, so it can never be shared.
  let manualFigures = [];
  try {
    manualFigures = (Array.isArray(b.manualFigures) ? b.manualFigures : []).map(f => figure(f));
  } catch (e) {
    if (e.code === 'missing_label') throw new HttpError(422, 'Every figure needs a savings label — observed, realized cash, estimated capacity, risk hypothesis or unverified.');
    if (e.code === 'missing_basis') throw new HttpError(422, 'A modelled or avoided-cost figure must say what it is based on.');
    if (e.code === 'unknown_label') throw new HttpError(422, `Unknown savings label "${e.detail}".`);
    if (e.code === 'not_a_number') throw new HttpError(422, 'A figure amount must be a number.');
    throw e;
  }

  const doc = {
    id: uuid(),
    kind,
    projectId: kind === 'owner' ? str(b.projectId, 100) : null,
    title: str(b.title, 200) || (kind === 'partner' ? 'Boro & Nest' : 'Project update'),
    sections,
    manualFigures,
    notes: str(b.notes, 2000) || null,
    createdBy: user.id,
    createdAt: new Date()
  };
  await (await getCollection('presentations')).insertOne(doc);
  return json({ presentation: { ...doc, _id: undefined } }, 201);
});
