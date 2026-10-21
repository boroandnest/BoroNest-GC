// Expiry tiers for the nightly sweep. Pure.
//   <= 30 days -> 'day30' (holder + staff, --sand)
//   <=  7 days -> 'day7'  (holder + staff + PM, --alert)
//   <=  0 days -> 'expired' (everyone; unassign future-dated lines, flag in-progress ones)
import { daysBetween } from '../dates.js';

export function expiryTier(expiresOn, today) {
  const d = daysBetween(today, expiresOn);
  if (d <= 0) return { tier: 'expired', daysOut: d };
  if (d <= 7) return { tier: 'day7', daysOut: d };
  if (d <= 30) return { tier: 'day30', daysOut: d };
  return { tier: null, daysOut: d };
}
