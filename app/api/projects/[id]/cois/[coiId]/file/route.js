import { getCollection } from '@/lib/mongo';
import { route, json, loadProject, HttpError } from '@/lib/api';
import { getSignedUrl } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET -> { url } : a 2-minute signed URL. Certificates carry policy numbers, so only the holder
// and staff can get one, and there is no other route to the file.
export const GET = route(async ({ user, params }) => {
  const { project, access } = await loadProject(user, params.id, { hide: true });
  const coi = await (await getCollection('cois')).findOne({ id: params.coiId, projectId: project.id });
  if (!coi || (access.role !== 'bn_staff' && coi.holderId !== user.id)) throw new HttpError(404, 'Not found');
  const file = await (await getCollection('files')).findOne({ id: coi.fileId });
  if (!file) throw new HttpError(404, 'Not found');
  const url = await getSignedUrl(file.storageKey, { backend: file.backend, expiresIn: 120, filename: file.filename, contentType: file.type, inline: true });
  return json({ url, expiresIn: 120 });
});
