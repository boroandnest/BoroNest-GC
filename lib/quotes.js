// T33 · The only writer for desk_quotes.
//
// A quote is frozen at issue. There is deliberately no update path here: a
// re-quote after a second site visit inserts a new row and points the old one
// forward, so what was promised in June still reads as June's promise in
// October. Same rule as statutory dates.

import { v4 as uuid } from 'uuid';
import { getCollection } from './mongo.js';
import { HttpError } from './api.js';
import { toMoney, round2 } from './money.js';
import { toDecimal128 } from './money-storage.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function getLiveQuote(projectId) {
  return (await getCollection('desk_quotes')).findOne({ projectId: String(projectId), supersededBy: null });
}

export async function quoteHistory(projectId) {
  return (await getCollection('desk_quotes')).find({ projectId: String(projectId) }).sort({ quotedAt: -1 }).limit(50).toArray();
}

export function quoteFields(body) {
  let amount;
  try { amount = toMoney(body.amount); } catch { throw new HttpError(422, 'Quote amount must be a number'); }
  if (amount.lessThanOrEqualTo(0)) throw new HttpError(422, 'Quote amount must be greater than zero');

  const quotedAt = String(body.quotedAt || '').slice(0, 10);
  if (!DATE.test(quotedAt)) throw new HttpError(422, 'Site visit date must be YYYY-MM-DD');

  let durationDays = null;
  if (body.durationDays !== undefined && body.durationDays !== null && body.durationDays !== '') {
    durationDays = Math.trunc(Number(body.durationDays));
    if (Number.isNaN(durationDays) || durationDays < 0) throw new HttpError(422, 'Duration must be a whole number of days');
  }

  return {
    amount: toDecimal128(round2(amount)),
    durationDays,
    quotedAt,
    scopeSummary: String(body.scopeSummary || '').trim().slice(0, 2000) || null,
    basis: body.basis && typeof body.basis === 'object' ? body.basis : null
  };
}

// Supersede-then-insert. MongoDB here is a standalone server with no
// transactions, and the partial unique index allows only one live quote per
// project, so the old row must leave the index before the new one enters it.
// If the insert then fails, the old row is put back live rather than leaving
// the project pointing at a quote that was never written.
export async function issueQuote({ projectId, body, user }) {
  const quotes = await getCollection('desk_quotes');
  const fields = quoteFields(body);
  const id = uuid();
  const previous = await getLiveQuote(projectId);

  if (previous) {
    await quotes.updateOne(
      { id: previous.id, supersededBy: null },
      { $set: { supersededBy: id, supersededReason: String(body.supersededReason || 'Re-quoted after a further site visit').slice(0, 500) } }
    );
  }

  const doc = {
    id, projectId: String(projectId), ...fields,
    quotedBy: user.id, supersededBy: null, supersededReason: null, createdAt: new Date()
  };

  try {
    await quotes.insertOne(doc);
  } catch (e) {
    if (previous) {
      await quotes.updateOne({ id: previous.id }, { $set: { supersededBy: null, supersededReason: null } });
    }
    if (e.code === 11000) throw new HttpError(409, 'A quote was issued for this project at the same moment. Reload and try again.');
    if (e.code === 121) throw new HttpError(422, 'Quote rejected: an amount, a site visit date and an author are required');
    throw e;
  }
  return doc;
}
