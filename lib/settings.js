import { getCollection } from './mongo';

// Single-document site settings (admin-editable marketing copy + email
// routing) so these don't require a code deploy to change. Defaults below
// match what's already shipped on the homepage / in lib/email.js, so an
// unconfigured install behaves exactly as it did before this existed.
const DEFAULTS = {
  ledgerProjects: '50+',
  ledgerOverruns: '$0',
  ledgerTurnaround: '48hr',
  replyToEmail: null,
  adminNotifyEmail: null
};

const ID = 'site';

export async function getSiteSettings() {
  const col = await getCollection('settings');
  const doc = await col.findOne({ _id: ID });
  return { ...DEFAULTS, ...(doc || {}) };
}

const FIELDS = ['ledgerProjects', 'ledgerOverruns', 'ledgerTurnaround', 'replyToEmail', 'adminNotifyEmail'];

export async function updateSiteSettings(patch) {
  const col = await getCollection('settings');
  const set = { updatedAt: new Date().toISOString() };
  for (const k of FIELDS) if (k in patch) set[k] = patch[k];
  await col.updateOne({ _id: ID }, { $set: set }, { upsert: true });
  return getSiteSettings();
}
