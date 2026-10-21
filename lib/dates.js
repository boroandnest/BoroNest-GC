// Calendar-date helpers on 'YYYY-MM-DD' strings (UTC, no time-of-day drift).
// Business days skip Saturday and Sunday only. Federal / NYC holidays are a KNOWN GAP:
// they are not modelled, so a lead time spanning a holiday is one day short. Do not half-solve
// this with a hard-coded list; add a holiday calendar collection if it starts to matter.

const DAY = 86400000;

export function toDate(s) {
  if (s instanceof Date) return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()));
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  if (!m) throw new Error(`invalid date: ${s}`);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}

export const iso = (d) => toDate(d).toISOString().slice(0, 10);
export const isWeekend = (d) => { const w = toDate(d).getUTCDay(); return w === 0 || w === 6; };
export const addDays = (d, n) => iso(new Date(toDate(d).getTime() + n * DAY));
export const today = () => iso(new Date());

// Same day if it is a business day, otherwise the next one.
export function rollForward(d) {
  let x = iso(d);
  while (isWeekend(x)) x = addDays(x, 1);
  return x;
}

// n business days after d (n >= 0). addBusinessDays(Fri, 1) = Mon.
export function addBusinessDays(d, n) {
  let x = iso(d);
  let left = n;
  while (left > 0) { x = addDays(x, 1); if (!isWeekend(x)) left--; }
  return x;
}

// n business days before d. subtractBusinessDays(Fri, 4) = Mon.
export function subtractBusinessDays(d, n) {
  let x = iso(d);
  let left = n;
  while (left > 0) { x = addDays(x, -1); if (!isWeekend(x)) left--; }
  return x;
}

export function daysBetween(a, b) {
  return Math.round((toDate(b) - toDate(a)) / DAY);
}
