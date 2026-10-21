import { v4 as uuid } from 'uuid';
import { getCollection } from '@/lib/mongo';
import { route, json, readJson, requireStaff, HttpError } from '@/lib/api';
import { logEvent } from '@/lib/access';
import { buildingAccess } from '@/lib/compliance/access';
import { computeDensity, VIOLATION_CLASSES, EVIDENCE_STATUSES } from '@/lib/compliance/density';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// GET — register + density. Staff, or client / management on a project in this building.
export const GET = route(async ({ user, params }) => {
  const { building, role } = await buildingAccess(user, params.id);
  const violations = await (await getCollection('violations')).find({ buildingId: building.id }).sort({ agencyClosedAt: 1, class: -1, issuedOn: 1 }).limit(5000).toArray();
  return json({
    building: { id: building.id, name: building.name, address: building.address, unitCount: building.unitCount ?? null, unitCountVerified: !!building.unitCountVerified, unitCountSource: building.unitCountSource || null },
    density: computeDensity(building, violations),
    violations,
    viewerRole: role
  });
});

// POST — staff add one violation or bulk import an array (e.g. pasted from HPD Online).
// Re-importing the same HPD violation number updates nothing and is skipped.
export const POST = route(async ({ request, user, params }) => {
  requireStaff(user);
  const { building } = await buildingAccess(user, params.id);
  const body = await readJson(request);
  const rows = Array.isArray(body) ? body : Array.isArray(body.violations) ? body.violations : [body];
  const col = await getCollection('violations');
  let inserted = 0, skipped = 0;
  const errors = [];
  for (const [i, r] of rows.slice(0, 2000).entries()) {
    const cls = String(r.class || '').toUpperCase();
    if (!VIOLATION_CLASSES.includes(cls) || !String(r.description || '').trim()) { errors.push({ row: i, error: 'class (A/B/C/I) and description are required' }); continue; }
    if ((r.issuedOn && !DATE.test(r.issuedOn)) || (r.correctBy && !DATE.test(r.correctBy))) { errors.push({ row: i, error: 'dates must be YYYY-MM-DD' }); continue; }
    const doc = {
      id: uuid(), buildingId: building.id, projectId: r.projectId || null,
      hpdId: r.hpdId ? String(r.hpdId).trim() : undefined,
      class: cls, unit: r.unit ? String(r.unit).slice(0, 20) : null,
      description: String(r.description).slice(0, 2000),
      issuedOn: r.issuedOn || null, correctBy: r.correctBy || null,
      workCompletedAt: null, clientAcceptedAt: null, certifiedFiledAt: null, agencyClosedAt: r.agencyClosedAt ? new Date(r.agencyClosedAt) : null,
      evidenceStatus: EVIDENCE_STATUSES.includes(r.evidenceStatus) ? r.evidenceStatus : 'reported',
      photoIds: [], createdAt: new Date(), createdBy: user.id
    };
    if (!doc.hpdId) delete doc.hpdId;
    try { await col.insertOne(doc); inserted++; } catch (e) { if (e.code === 11000) skipped++; else errors.push({ row: i, error: e.code === 121 ? 'failed validation' : 'insert failed' }); }
  }
  await logEvent(null, user, 'bn_staff', 'violations_imported', { buildingId: building.id, inserted, skipped, errors: errors.length });
  if (!inserted && errors.length) throw new HttpError(422, 'Nothing imported', { errors });
  return json({ inserted, skipped, errors }, 201);
});
