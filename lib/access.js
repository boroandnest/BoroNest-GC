// Project access + event logging shared by every API route.
import { getCollection } from './mongo.js';
import { isStaff, isVerified, STAFF_ROLE } from './auth.js';

// Returns the viewer's role on this project ({ role, trades }), or null if they have no access.
// The role drives every pricing / visibility decision downstream.
export async function resolveAccess(user, project) {
  if (!user || !project) return null;
  if (isStaff(user)) return { role: STAFF_ROLE, trades: [] };
  if (!isVerified(user)) return null;
  if ((project.clientEmail || '').toLowerCase() === user.email) return { role: 'client', trades: [] };
  const parties = await getCollection('project_parties');
  const party = await parties.findOne({ projectId: project.id, userEmail: user.email, status: 'accepted' });
  if (party) return { role: party.role, trades: party.scopeTrades?.length ? party.scopeTrades : userTrades(user) };
  if (project.publicDemo && process.env.SHOW_DEMO_PROJECTS === 'true') return { role: user.role, trades: userTrades(user) };
  return null;
}

export function userTrades(user) {
  const t = user?.profile?.trades;
  if (Array.isArray(t)) return t;
  return typeof t === 'string' ? t.split(',').map(s => s.trim()).filter(Boolean) : [];
}

export async function logEvent(projectId, user, actorRole, kind, payload = {}) {
  try {
    const events = await getCollection('project_events');
    await events.insertOne({ projectId, actorId: user?.id || null, actorRole: actorRole || user?.role || null, kind, payload, at: new Date() });
  } catch (e) {
    console.warn('event log failed:', kind, e.message);
  }
}
