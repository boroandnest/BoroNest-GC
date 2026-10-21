import { getCollection } from '@/lib/mongo';
import { route, json, HttpError } from '@/lib/api';
import { billingProject } from '@/lib/billing/http';
import { getSignedUrl } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET -> { url } (2-minute signed URL) — client, management and staff only.
export const GET = route(async ({ user, params }) => {
  const { project } = await billingProject(user, params.id);
  const pt = await (await getCollection('material_passthroughs')).findOne({ id: params.ptid, projectId: project.id });
  const file = pt && await (await getCollection('files')).findOne({ id: pt.invoiceFileId });
  if (!file) throw new HttpError(404, 'Not found');
  return json({ url: await getSignedUrl(file.storageKey, { backend: file.backend, expiresIn: 120, filename: file.filename, contentType: file.type, inline: true }) });
});
