import { v4 as uuid } from 'uuid';
import { getCollection } from '@/lib/mongo';
import { route, json, requireStaff, loadProject, HttpError } from '@/lib/api';
import { verifyMilestone, milestoneView } from '@/lib/payments/milestones';
import { saveUploadedFile, checkUpload } from '@/lib/uploads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST multipart { photos[] } — PM verifies with site photos (kept as evidence originals).
// Sets release_eta = now + 24h; the client can dispute inside that window.
export const POST = route(async ({ request, user, params }) => {
  requireStaff(user);
  const { project } = await loadProject(user, params.id);
  const photoIds = [];
  const ct = request.headers.get('content-type') || '';
  if (ct.includes('multipart/form-data')) {
    const form = await request.formData();
    for (const f of form.getAll('photos').filter(x => typeof x !== 'string').slice(0, 20)) {
      const bad = await checkUpload(f, { imagesOnly: true });
      if (bad) throw new HttpError(422, bad);
      const saved = await saveUploadedFile(f, `projects/${project.id}/milestones/${params.mid}`, { photo: true, keepOriginal: true });
      await (await getCollection('files')).insertOne({ ...saved, kind: 'photo', projectId: project.id, ownerUserId: user.id, milestoneId: params.mid, uploadedAt: new Date() });
      await (await getCollection('photos')).insertOne({ id: uuid(), projectId: project.id, url: `/api/files/${saved.id}`, caption: `Milestone verification`, milestoneId: params.mid, uploadedBy: user.name || user.email, uploadedAt: new Date() });
      photoIds.push(saved.id);
    }
  }
  const m = await verifyMilestone({ project, milestoneId: params.mid, user, photoIds });
  return json({ milestone: milestoneView(m) });
});
