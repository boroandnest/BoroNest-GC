// T31 · Share links. The link is the credential, so it is handled like one.
//
// Only a SHA-256 hash is stored, the same way Phase 1 stores sessions: reading
// the database must not hand anyone a working deck. The plaintext token is
// returned exactly once, at creation, and never again — if staff lose it they
// issue a new link, which is also the behaviour you want when a link has been
// forwarded somewhere it should not have gone.

import crypto from 'crypto';
import { v4 as uuid } from 'uuid';
import { getCollection } from '../mongo.js';
import { HttpError } from '../api.js';

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');

// 36 hours, set by the owner. Short enough that a forwarded link goes stale
// before it travels far; staff re-issue when a recipient needs longer.
export const SHARE_TTL_HOURS = 36;

export async function createShare({ presentationId, user, audience = null, recipientNote = null, now = new Date() }) {
  const presentations = await getCollection('presentations');
  const deck = await presentations.findOne({ id: String(presentationId) });
  if (!deck) throw new HttpError(404, 'Presentation not found');

  // 32 bytes of randomness, url-safe. Not a guessable id.
  const token = crypto.randomBytes(32).toString('base64url');
  const share = {
    id: uuid(),
    presentationId: deck.id,
    tokenHash: sha256(token),
    audience: audience ? String(audience).slice(0, 200) : null,
    recipientNote: recipientNote ? String(recipientNote).slice(0, 500) : null,
    expiresAt: new Date(now.getTime() + SHARE_TTL_HOURS * 3600 * 1000),
    revokedAt: null,
    revokedBy: null,
    createdBy: user.id,
    createdAt: now
  };
  await (await getCollection('presentation_shares')).insertOne(share);
  // The only moment the plaintext exists outside the recipient's inbox.
  return { share, token };
}

// Resolution failures are deliberately indistinguishable to the caller: an
// unknown, expired and revoked token all answer the same way, so a link that
// stopped working does not confirm that it ever existed.
export async function resolveShare(token, { now = new Date() } = {}) {
  if (typeof token !== 'string' || token.length < 20) throw new HttpError(404, 'This link is not available');
  const shares = await getCollection('presentation_shares');
  const share = await shares.findOne({ tokenHash: sha256(token) });
  if (!share) throw new HttpError(404, 'This link is not available');
  if (share.revokedAt) throw new HttpError(404, 'This link is not available');
  if (share.expiresAt <= now) throw new HttpError(404, 'This link is not available');
  const deck = await (await getCollection('presentations')).findOne({ id: share.presentationId });
  if (!deck) throw new HttpError(404, 'This link is not available');
  return { share, presentation: deck };
}

export async function revokeShare({ shareId, user, now = new Date() }) {
  const shares = await getCollection('presentation_shares');
  const r = await shares.updateOne(
    { id: String(shareId), revokedAt: null },
    { $set: { revokedAt: now, revokedBy: user.id } }
  );
  if (!r.matchedCount) throw new HttpError(404, 'Share not found or already revoked');
  return shares.findOne({ id: String(shareId) });
}

// Every view is recorded. A deck sent to a prospective partner is a document
// leaving the building, and someone will eventually ask where it went.
export async function recordView({ share, ip = null, userAgent = null, now = new Date() }) {
  try {
    await (await getCollection('presentation_views')).insertOne({
      id: uuid(),
      shareId: share.id,
      presentationId: share.presentationId,
      at: now,
      ip,
      userAgent: userAgent ? String(userAgent).slice(0, 300) : null
    });
  } catch (e) {
    // A failed audit write must not take the deck down for the recipient, but
    // it must be visible to us.
    console.warn('presentation view log failed:', e.message);
  }
}

export async function sharesFor(presentationId) {
  const shares = await (await getCollection('presentation_shares'))
    .find({ presentationId: String(presentationId) }).sort({ createdAt: -1 }).limit(100).toArray();
  const views = await (await getCollection('presentation_views'))
    .find({ presentationId: String(presentationId) }).sort({ at: -1 }).limit(500).toArray();
  const byShare = new Map();
  for (const v of views) byShare.set(v.shareId, (byShare.get(v.shareId) || 0) + 1);
  const lastByShare = new Map();
  for (const v of views) if (!lastByShare.has(v.shareId)) lastByShare.set(v.shareId, v.at);

  // tokenHash never leaves the server, not even to staff.
  return shares.map(({ _id, tokenHash, ...s }) => ({
    ...s,
    views: byShare.get(s.id) || 0,
    lastViewedAt: lastByShare.get(s.id) || null,
    live: !s.revokedAt && s.expiresAt > new Date()
  }));
}
