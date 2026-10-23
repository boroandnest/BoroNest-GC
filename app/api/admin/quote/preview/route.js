import { route, json, readJson, requireStaff, HttpError } from '@/lib/api';
import { calculate, serializeQuote, QuoteError } from '@/lib/quote/calculate';
import { projectStaff } from '@/lib/quote/project';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Staff-only live preview. Takes a DRAFT card — not a stored id — so the
// editor can recompute from in-progress, unsaved edits on every change. Runs
// the exact same calculate() the public page and the admin builder will use;
// there is no separate "preview math." That is what makes "live from input"
// mean anything: what you see while editing is what the engine will actually
// produce once the card is saved.
export const POST = route(async ({ request, user }) => {
  requireStaff(user);
  const body = await readJson(request);
  if (!body.card || !body.input) throw new HttpError(422, 'Body needs { card, input }');
  try {
    const result = calculate(body.input, body.card);
    return json({ result: serializeQuote(projectStaff(result)) });
  } catch (e) {
    if (e instanceof QuoteError) throw new HttpError(422, e.message);
    throw e;
  }
});
