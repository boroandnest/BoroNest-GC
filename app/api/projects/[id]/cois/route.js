import { v4 as uuid } from 'uuid';
import path from 'path';
import { getCollection } from '@/lib/mongo';
import { route, json, loadProject, HttpError } from '@/lib/api';
import { logEvent } from '@/lib/access';
import { putObject } from '@/lib/storage';
import { checkUpload } from '@/lib/uploads';
import { round2 } from '@/lib/money';
import { toDecimal128 } from '@/lib/money-storage';
import { requirementsView } from '@/lib/coi/buildings';
import { fullCoi, coiChip } from '@/lib/coi/views';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function context(user, id) {
  const { project, access } = await loadProject(user, id, { hide: true });
  const building = project.buildingId ? await (await getCollection('buildings')).findOne({ id: project.buildingId }) : null;
  return { project, access, building };
}

// GET /api/projects/:id/cois
//   staff: every certificate with compliance detail
//   subcontractor/expediter: their own certificates + the building's requirements
//   everyone else on the project: one status chip per trade company — no limits, files or licences
export const GET = route(async ({ user, params }) => {
  const { project, access, building } = await context(user, params.id);
  const cois = await getCollection('cois');
  const requirements = requirementsView(building, project);
  const ai = project.requiredAi || [];

  if (access.role === 'bn_staff') {
    const all = await cois.find({ projectId: project.id }).sort({ submittedAt: -1 }).toArray();
    const holders = await (await getCollection('users')).find({ id: { $in: all.map(c => c.holderId) } }, { projection: { id: 1, name: 1, company: 1, email: 1 } }).toArray();
    const by = new Map(holders.map(h => [h.id, h]));
    return json({ role: access.role, requirements, cois: all.map(c => ({ ...fullCoi(c, building, ai), holder: by.get(c.holderId) || null })) });
  }
  if (access.role === 'subcontractor' || access.role === 'expediter') {
    const mine = await cois.find({ projectId: project.id, holderId: user.id }).sort({ submittedAt: -1 }).toArray();
    return json({ role: access.role, requirements, cois: mine.map(c => fullCoi(c, building, ai)), canSubmit: true });
  }
  // Chips: latest certificate per trade member on the project.
  const parties = await (await getCollection('project_parties')).find({ projectId: project.id, status: 'accepted', role: { $in: ['subcontractor', 'expediter'] } }).toArray();
  const users = await (await getCollection('users')).find({ email: { $in: parties.map(p => p.userEmail) } }, { projection: { id: 1, name: 1, company: 1, email: 1 } }).toArray();
  const chips = [];
  for (const u of users) {
    const latest = await cois.find({ projectId: project.id, holderId: u.id }).sort({ submittedAt: -1 }).limit(1).next();
    chips.push({ company: u.company || u.name, trade: parties.find(p => p.userEmail === u.email)?.scopeTrades?.join(', ') || '', chip: coiChip(latest, building, ai) });
  }
  return json({ role: access.role, requirements: requirements && { buildingName: requirements.buildingName, certificateHolder: requirements.certificateHolder, leadDays: requirements.leadDays }, chips });
});

// POST /api/projects/:id/cois  multipart: file + glLimit, wcPresent, autoLimit, elLimit,
//   additionalInsured (one per line), certHolderText, effectiveOn, expiresOn
// Submitted by the trade holder; staff verify it before it counts. The file is private.
export const POST = route(async ({ request, user, params }) => {
  const { project, access } = await context(user, params.id);
  if (!['subcontractor', 'expediter'].includes(access.role)) throw new HttpError(403, 'Only the insured trade can submit its certificate');
  const form = await request.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') throw new HttpError(422, 'Attach the certificate (PDF or image)');
  if (file.size > 15 * 1024 * 1024) throw new HttpError(422, 'File exceeds 15 MB');
  const typeErr = checkUpload(file);
  if (typeErr || !['.pdf', '.png', '.jpg', '.jpeg'].includes(path.extname(file.name || '').toLowerCase())) throw new HttpError(422, typeErr || 'Certificates must be PDF, PNG or JPG');
  const expiresOn = String(form.get('expiresOn') || '');
  const effectiveOn = String(form.get('effectiveOn') || '');
  if (!DATE.test(expiresOn)) throw new HttpError(422, 'Expiration date is required');
  if (effectiveOn && !DATE.test(effectiveOn)) throw new HttpError(422, 'Effective date must be a date');
  const money = (k) => (form.get(k) ? toDecimal128(round2(String(form.get(k)))) : undefined);

  const id = uuid();
  const ext = path.extname(file.name).toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  const stored = await putObject(`cois/${project.id}/${id}${ext}`, buf, ext === '.pdf' ? 'application/pdf' : `image/${ext === '.png' ? 'png' : 'jpeg'}`);
  const fileId = uuid();
  await (await getCollection('files')).insertOne({
    id: fileId, kind: 'coi', private: true, projectId: project.id, ownerUserId: user.id,
    filename: `coi-${id}${ext}`, size: buf.length, type: ext === '.pdf' ? 'application/pdf' : 'image/jpeg',
    storageKey: stored.key, backend: stored.backend, uploadedAt: new Date()
  });
  const coi = {
    id, holderId: user.id, projectId: project.id, status: 'pending', fileId,
    glLimit: money('glLimit'), autoLimit: money('autoLimit'), elLimit: money('elLimit'),
    wcPresent: form.get('wcPresent') === 'true' || form.get('wcPresent') === 'on',
    additionalInsured: String(form.get('additionalInsured') || '').split('\n').map(x => x.trim()).filter(Boolean).slice(0, 50),
    certHolderText: String(form.get('certHolderText') || '').slice(0, 500),
    effectiveOn: effectiveOn || undefined, expiresOn,
    submittedAt: new Date()
  };
  for (const k of Object.keys(coi)) if (coi[k] === undefined) delete coi[k];
  await (await getCollection('cois')).insertOne(coi);
  await logEvent(project.id, user, access.role, 'coi_submitted', { coiId: id, expiresOn });
  return json({ coi: fullCoi(coi, null, []) }, 201);
});
