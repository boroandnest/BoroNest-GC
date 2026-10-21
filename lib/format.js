// Display formatting for money that arrives from the API as decimal strings ("12345.6", "-0.01").
// String manipulation only — no arithmetic, safe to use in client components.
export function formatMoney(v, { cents = true } = {}) {
  if (v === null || v === undefined || v === '') return '—';
  const s = String(v);
  const neg = s.startsWith('-');
  const [intRaw, frac = ''] = (neg ? s.slice(1) : s).split('.');
  const int = intRaw.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const dec = cents ? `.${(frac + '00').slice(0, 2)}` : '';
  return `${neg ? '-' : ''}$${int}${dec}`;
}

export function formatQty(v) {
  if (v === null || v === undefined || v === '') return '—';
  const [i, f] = String(v).split('.');
  const frac = (f || '').replace(/0+$/, '');
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (frac ? `.${frac}` : '');
}
