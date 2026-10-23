// Q4 · Rate card persistence. A PUBLISHED card is frozen, same discipline as
// a desk quote or a statutory date: quotes have already been issued against
// it, so editing it in place would make them unreproducible. A card still in
// draft (published: false) can be freely edited — nothing depends on it yet.
import { Decimal128 } from 'mongodb';
import { getCollection } from '../mongo.js';
import { HttpError } from '../api.js';
import { assertPublishable } from './card.js';

const D = (v) => (v === null || v === undefined || v === '' ? null : Decimal128.fromString(String(v)));
const n = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

// Converts the editable (string) fields of a card into storage types.
// Structural shape is trusted to the Mongo $jsonSchema validator; this only
// handles the numeric/decimal conversions a plain JSON body can't carry.
function toStorage(editable) {
  return {
    effectiveFrom: editable.effectiveFrom,
    effectiveTo: editable.effectiveTo || null,
    contingencyLo: D(editable.contingencyLo), contingencyHi: D(editable.contingencyHi),
    minCommercial: D(editable.minCommercial), minResidential: D(editable.minResidential),
    notes: editable.notes || null,
    concepts: (editable.concepts || []).map(c => ({
      conceptKey: c.conceptKey, label: c.label,
      psfLo: D(c.psfLo), psfHi: D(c.psfHi),
      defaultModel: c.defaultModel, isFnb: !!c.isFnb,
      permitWkLo: n(c.permitWkLo), permitWkHi: n(c.permitWkHi),
      buildWkLo: n(c.buildWkLo), buildWkHi: n(c.buildWkHi),
      marketLo: D(c.marketLo), marketHi: D(c.marketHi),
      marketSource: c.marketSource || null, notes: c.notes || null
    })),
    modifiers: (editable.modifiers || []).map(m => ({
      key: m.key, label: m.label, multLo: D(m.multLo), multHi: D(m.multHi),
      appliesTo: m.appliesTo || [], source: m.source || null, customerExplain: m.customerExplain || null
    })),
    adders: (editable.adders || []).map(a => ({
      key: a.key, label: a.label, trigger: a.trigger || {},
      amountLo: D(a.amountLo), amountHi: D(a.amountHi), tieredOn: a.tieredOn || null, source: a.source || null,
      tiers: (a.tiers || []).map(t => ({ label: t.label, maxValue: n(t.maxValue), amountLo: D(t.amountLo), amountHi: D(t.amountHi), seq: n(t.seq) }))
    })),
    tradeSplits: (editable.tradeSplits || []).map(s => ({ profile: s.profile, trade: s.trade, pct: D(s.pct), seq: n(s.seq) }))
  };
}

export async function listCards() {
  const cards = await (await getCollection('rate_cards')).find({}, { projection: { concepts: 0, modifiers: 0, adders: 0, tradeSplits: 0 } }).sort({ version: -1 }).toArray();
  return cards.map(({ _id, ...c }) => c);
}

export async function getCard(id) {
  const card = await (await getCollection('rate_cards')).findOne({ id: String(id) });
  if (!card) throw new HttpError(404, 'Rate card not found');
  const { _id, ...c } = card;
  return c;
}

// Draft-only edit. A published card 409s rather than silently no-op-ing, so
// staff get a clear reason instead of a save that quietly didn't happen.
export async function updateCard(id, body) {
  const cards = await getCollection('rate_cards');
  const existing = await cards.findOne({ id: String(id) });
  if (!existing) throw new HttpError(404, 'Rate card not found');
  if (existing.published) {
    throw new HttpError(409, 'This card is published and frozen — quotes have been issued against it. Create a new version to change pricing.');
  }
  await cards.updateOne({ id: String(id) }, { $set: toStorage(body) });
  return getCard(id);
}

// Publishing requires a clean trade-split set (card.js) and unpublishes any
// other card first, so the "exactly one published" invariant never has a gap
// where either zero or two cards are live.
export async function publishCard(id) {
  const cards = await getCollection('rate_cards');
  const card = await cards.findOne({ id: String(id) });
  if (!card) throw new HttpError(404, 'Rate card not found');
  try {
    assertPublishable(card);
  } catch (e) {
    if (e.code === 'no_trade_splits') throw new HttpError(422, 'Add trade splits for every profile before publishing.');
    if (e.code === 'splits_not_100') throw new HttpError(422, `Trade splits must sum to 100 per profile. Currently: ${e.detail}.`);
    throw e;
  }
  await cards.updateMany({ published: true }, { $set: { published: false } });
  await cards.updateOne({ id: String(id) }, { $set: { published: true } });
  return getCard(id);
}
