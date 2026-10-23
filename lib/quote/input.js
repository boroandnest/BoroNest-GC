// Shared input sanitation for the two public quote endpoints (calculate and
// capture), so a bad request fails the same way in both places rather than
// drifting as the routes evolve separately.
//
// Throws its own InputError rather than importing HttpError from lib/api.js:
// that file pulls in NextResponse, which only resolves inside Next's own
// runtime. A pure lib module that unit-tests under plain `node --test` can't
// depend on it, same reason lib/quote/calculate.js has its own QuoteError.
// The route layer converts InputError to HttpError(422, ...).
export class InputError extends Error {}

const BOROUGHS = ['manhattan', 'outer'];
const CONDITIONS = ['second_same', 'second_diff', 'white_box', 'raw', 'unknown'];

export function readQuoteInput(body) {
  const conceptKey = String(body.conceptKey || '').trim().slice(0, 100);
  const sqft = Math.trunc(Number(body.sqft));
  const borough = String(body.borough || '').trim();
  const condition = String(body.condition || '').trim();
  if (!conceptKey) throw new InputError('Choose a concept');
  if (!Number.isFinite(sqft) || sqft <= 0) throw new InputError('Square footage must be a positive number');
  if (!BOROUGHS.includes(borough)) throw new InputError('Borough must be manhattan or outer');
  if (!CONDITIONS.includes(condition)) throw new InputError(`Condition must be one of: ${CONDITIONS.join(', ')}`);

  const bool = (v) => v === true || v === 'true';
  const floors = body.floors === '' || body.floors === undefined || body.floors === null ? undefined : Math.trunc(Number(body.floors));
  if (floors !== undefined && (!Number.isFinite(floors) || floors < 1)) throw new InputError('Floors must be a positive whole number');

  return {
    conceptKey, sqft, borough, condition, floors,
    cooking: bool(body.cooking),
    afterHours: bool(body.afterHours),
    existingHood: bool(body.existingHood),
    existingGrease: bool(body.existingGrease),
    existingExhaust: bool(body.existingExhaust)
  };
}
