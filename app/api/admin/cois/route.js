import { getCollection } from '@/lib/mongo';
import { route, json, requireStaff } from '@/lib/api';
import { fullCoi } from '@/lib/coi/views';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Staff verification queue. ?status=pending (default) | verified | rejected | all
export const GET = route(async ({ user, url }) => {
  requireStaff(user);
  const status = url.searchParams.get('status') || 'pending';
  const cois = await (await getCollection('cois')).find(status === 'all' ? {} : { status }).sort({ submittedAt: 1 }).limit(300).toArray();
  const projects = await (await getCollection('projects')).find({ id: { $in: [...new Set(cois.map(c => c.projectId))] } }).toArray();
  const buildings = await (await getCollection('buildings')).find({ id: { $in: projects.map(p => p.buildingId).filter(Boolean) } }).toArray();
  const holders = await (await getCollection('users')).find({ id: { $in: cois.map(c => c.holderId) } }, { projection: { id: 1, name: 1, company: 1, email: 1 } }).toArray();
  const P = new Map(projects.map(p => [p.id, p])), B = new Map(buildings.map(b => [b.id, b])), H = new Map(holders.map(h => [h.id, h]));
  return json({
    cois: cois.map(c => {
      const p = P.get(c.projectId);
      const b = p?.buildingId ? B.get(p.buildingId) : null;
      return { ...fullCoi(c, b, p?.requiredAi || []), holder: H.get(c.holderId) || null, project: p ? { id: p.id, name: p.name, code: p.code } : null, building: b ? { name: b.name, certHolderName: b.certHolderName, certHolderCo: b.certHolderCo } : null, requiredAi: p?.requiredAi || [] };
    })
  });
});
