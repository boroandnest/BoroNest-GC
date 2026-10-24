import { getCollection } from '@/lib/mongo';
import { route, json, HttpError } from '@/lib/api';
import { rateLimit } from '@/lib/auth';
import { serverDerivedIp } from '@/lib/request-ip';
import { resolveShare, recordView } from '@/lib/presentations/shares';
import { buildDeck } from '@/lib/presentations/build';
import { computeVariance } from '@/lib/variance';
import { computeDensity } from '@/lib/compliance/density';
import { getLiveQuote } from '@/lib/quotes';
import { today as todayIso } from '@/lib/dates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PUBLIC. No session: whoever holds the link sees the deck. Everything that
// keeps this safe happens elsewhere —
//
//   * the token is 32 random bytes and only its hash is stored;
//   * it expires after 36 hours and can be revoked;
//   * the deck's audience was fixed when it was composed, so a partner deck
//     cannot render an owner section even if someone edits the stored list;
//   * content is projected at view time and scrubbed of client PII.
//
// Unknown, expired and revoked all answer identically, so a dead link never
// confirms it once existed.
export const GET = route(async ({ request, params }) => {
  // A public endpoint taking a secret needs a brake on guessing. The token
  // space makes brute force hopeless, but this also caps someone replaying a
  // leaked link to scrape it.
  if (!rateLimit(`deck:${serverDerivedIp(request)}`, 60, 600000)) {
    throw new HttpError(429, 'Too many requests. Try again shortly.');
  }

  const { share, presentation } = await resolveShare(params.token);

  let project = null, scopeLines = [], variance = null, density = null, portfolio = null;

  if (presentation.kind === 'owner' && presentation.projectId) {
    project = await (await getCollection('projects')).findOne({ id: presentation.projectId });
    if (!project) throw new HttpError(404, 'This link is not available');
    scopeLines = await (await getCollection('scope_lines')).find({ projectId: project.id }).limit(500).toArray();

    const quote = await getLiveQuote(project.id);
    if (quote) {
      const changeOrders = await (await getCollection('change_orders')).find({ projectId: project.id }).toArray();
      // The owner's own figures, so the client projection — never the staff one,
      // which carries estimating accuracy.
      const full = computeVariance({ quote, project, changeOrders, today: todayIso() });
      const { vsQuote, absorbedLosses, ...clientSafe } = full;
      variance = clientSafe;
    }
    if (project.buildingId) {
      const building = await (await getCollection('buildings')).findOne({ id: project.buildingId });
      if (building) {
        const violations = await (await getCollection('violations')).find({ buildingId: building.id }).limit(5000).toArray();
        density = computeDensity(building, violations);
      }
    }
  }

  if (presentation.kind === 'partner') {
    // Counts only. Nothing here can be traced back to a client.
    const projects = await (await getCollection('projects')).find({}).limit(1000).toArray();
    const buildings = await (await getCollection('buildings')).countDocuments();
    portfolio = {
      projects: projects.length,
      buildings,
      boroughs: [...new Set(projects.map(p => p.borough).filter(Boolean))].sort()
    };
  }

  const deck = buildDeck({ presentation, project, scopeLines, variance, density, portfolio });

  await recordView({
    share,
    ip: serverDerivedIp(request),
    userAgent: request.headers.get('user-agent')
  });

  return json({ deck, expiresAt: share.expiresAt });
});
