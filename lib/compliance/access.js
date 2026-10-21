// Who may see a building's violation register / density:
// staff, or the client / management company on a project in that building. Nobody else (not subs).
import { getCollection } from '../mongo.js';
import { HttpError, requireUser } from '../api.js';
import { isStaff } from '../auth.js';
import { resolveAccess } from '../access.js';

export async function buildingAccess(user, buildingId) {
  requireUser(user);
  const building = await (await getCollection('buildings')).findOne({ id: String(buildingId) });
  if (!building) throw new HttpError(404, 'Not found');
  if (isStaff(user)) return { building, role: 'bn_staff' };
  const projects = await (await getCollection('projects')).find({ buildingId: building.id }).toArray();
  for (const p of projects) {
    const a = await resolveAccess(user, p);
    if (a && (a.role === 'client' || a.role === 'management')) return { building, role: a.role };
  }
  throw new HttpError(404, 'Not found');
}
