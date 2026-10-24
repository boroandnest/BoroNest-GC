// npm run seed:rate-card — writes rate card v1 (lib/quote/seed.js) if it
// doesn't already exist. Idempotent: upserts by id, never overwrites a card
// that's already there, since a card is immutable once created (new numbers
// mean a new version, not an edit).
import { MongoClient, Decimal128 } from 'mongodb';
import { buildCardV1 } from '../lib/quote/seed.js';

const D = (v) => (v === null || v === undefined ? null : Decimal128.fromString(String(v)));
const MONEY_FIELDS = ['contingencyLo', 'contingencyHi', 'minCommercial', 'minResidential'];
const MOD_FIELDS = ['multLo', 'multHi'];
const ADDER_FIELDS = ['amountLo', 'amountHi'];
const TIER_FIELDS = ['amountLo', 'amountHi'];
const CONCEPT_FIELDS = ['psfLo', 'psfHi', 'marketLo', 'marketHi'];

function toStorageDoc(card) {
  const doc = { ...card };
  for (const f of MONEY_FIELDS) doc[f] = D(card[f]);
  doc.concepts = card.concepts.map(c => {
    const out = { ...c };
    for (const f of CONCEPT_FIELDS) out[f] = D(c[f]);
    return out;
  });
  doc.modifiers = card.modifiers.map(m => {
    const out = { ...m };
    for (const f of MOD_FIELDS) out[f] = D(m[f]);
    return out;
  });
  doc.adders = card.adders.map(a => {
    const out = { ...a };
    for (const f of ADDER_FIELDS) out[f] = D(a[f]);
    out.tiers = a.tiers.map(t => {
      const to = { ...t };
      for (const f of TIER_FIELDS) to[f] = D(t[f]);
      return to;
    });
    return out;
  });
  return doc;
}

const client = await MongoClient.connect(process.env.MONGO_URL);
try {
  const db = client.db(process.env.DB_NAME || 'boro_nest');
  const col = db.collection('rate_cards');
  const card = buildCardV1();
  const existing = await col.findOne({ id: card.id });
  if (existing) {
    console.log(`rate card ${card.id} already exists (version ${existing.version}); nothing to do`);
  } else {
    await col.insertOne(toStorageDoc(card));
    console.log(`seeded rate card version ${card.version} (unpublished — trade splits not yet entered)`);
  }
} finally {
  await client.close();
}
