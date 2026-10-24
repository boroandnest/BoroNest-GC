// Public quote reference: short enough to read aloud on the phone, e.g.
// "BN-Q-7K2M". No 0/O or 1/I — those are the pair that causes a dictated
// code to be re-typed wrong.
import crypto from 'crypto';
import { getCollection } from '../mongo.js';

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function randomCode(len = 4) {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export async function generatePublicRef() {
  const quotes = await getCollection('rate_quotes');
  for (let i = 0; i < 5; i++) {
    const ref = `BN-Q-${randomCode()}`;
    if (!(await quotes.findOne({ publicRef: ref }))) return ref;
  }
  throw new Error('Could not generate a unique quote reference after 5 attempts');
}
