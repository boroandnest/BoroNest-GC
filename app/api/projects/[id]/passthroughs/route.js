import { v4 as uuid } from 'uuid';
import path from 'path';
import { getCollection } from '@/lib/mongo';
import { route, json, requireStaff, loadProject, HttpError } from '@/lib/api';
import { putObject } from '@/lib/storage';
import { checkUpload } from '@/lib/uploads';
import { toMoney, round2 } from '@/lib/money';
import { toDecimal128, toDecimal128Exact } from '@/lib/money-storage';
import { passthroughBilled } from '@/lib/billing/retainers';
import { logEvent } from '@/lib/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST multipart { vendor, description, cost, markupPct (default 10), periodStart, invoice (file) } — staff.
// The vendor invoice is the whole basis of "materials at cost + markup", so it is required.
export const POST = route(async ({ request, user, params }) => {
  requireStaff(user);
  const { project } = await loadProject(user, params.id);
  const f = await request.formData();
  const file = f.get('invoice');
  if (!file || typeof file === 'string') throw new HttpError(422, 'Attach the vendor invoice');
  const bad = checkUpload(file);
  if (bad) throw new HttpError(422, bad);
  const vendor = String(f.get('vendor') || '').trim(), description = String(f.get('description') || '').trim();
  const periodStart = String(f.get('periodStart') || '');
  if (!vendor || !description || !/^\d{4}-\d{2}-\d{2}$/.test(periodStart)) throw new HttpError(422, 'vendor, description and period are required');
  let cost, markup;
  try { cost = round2(String(f.get('cost'))); markup = toMoney(String(f.get('markupPct') || '10')).toDecimalPlaces(2); } catch { throw new HttpError(422, 'cost and markup must be numbers'); }
  if (cost.lessThanOrEqualTo(0) || markup.lessThan(0)) throw new HttpError(422, 'cost must be positive and markup non-negative');

  const id = uuid();
  const ext = path.extname(file.name || '').toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  const stored = await putObject(`passthroughs/${project.id}/${id}${ext}`, buf, ext === '.pdf' ? 'application/pdf' : 'application/octet-stream');
  const fileId = uuid();
  await (await getCollection('files')).insertOne({ id: fileId, kind: 'vendor_invoice', private: true, projectId: project.id, ownerUserId: user.id, filename: `invoice-${vendor.replace(/[^\w]+/g, '_')}${ext}`, size: buf.length, type: ext === '.pdf' ? 'application/pdf' : 'application/octet-stream', storageKey: stored.key, backend: stored.backend, uploadedAt: new Date() });
  const doc = {
    id, projectId: project.id, periodStart, vendor: vendor.slice(0, 200), description: description.slice(0, 1000),
    cost: toDecimal128(cost), markupPct: toDecimal128Exact(markup), billed: toDecimal128(passthroughBilled(cost, markup)),
    invoiceFileId: fileId, createdAt: new Date(), createdBy: user.id
  };
  await (await getCollection('material_passthroughs')).insertOne(doc);
  await logEvent(project.id, user, 'bn_staff', 'passthrough_added', { passthroughId: id });
  return json({ ok: true, id }, 201);
});
