import { HttpError, loadProject } from '../api.js';

export const BILLING_ROLES = ['client', 'management', 'bn_staff'];

// Retainer and pass-through data exists only for the client, management company and staff.
// Everyone else gets 404 — not an empty list that reveals a billing arrangement exists.
export async function billingProject(user, id) {
  const { project, access } = await loadProject(user, id, { hide: true });
  if (!BILLING_ROLES.includes(access.role)) throw new HttpError(404, 'Not found');
  return { project, access };
}
