import Decimal from 'decimal.js';

// Decimal128 / Decimal -> exact decimal string; strips Mongo _id. Money leaves the server as strings,
// so no client ever receives a float it might do arithmetic on.
// (Duck-typed on _bsontype so this file never pulls the MongoDB driver into a browser bundle.)
export function serialize(v) {
  if (Decimal.isDecimal(v)) return v.toString();
  if (Array.isArray(v)) return v.map(serialize);
  if (v instanceof Date || v === null || typeof v !== 'object') return v;
  if (v._bsontype) return v.toString();
  const out = {};
  for (const [k, val] of Object.entries(v)) if (k !== '_id' && val !== undefined) out[k] = serialize(val);
  return out;
}
