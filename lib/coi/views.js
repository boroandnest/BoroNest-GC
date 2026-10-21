// What each role receives about certificates. Policy numbers / files / limits are for the holder and
// staff only; everyone else gets a status chip. Licence numbers are never included for non-staff.
import { coiCompliant, REASON_TEXT } from './compliance.js';
import { iso, daysBetween } from '../dates.js';

export function coiChip(coi, building, requiredAi, asOf = iso(new Date())) {
  if (!coi) return { state: 'missing', label: 'No certificate' };
  if (coi.status === 'rejected') return { state: 'rejected', label: 'Rejected' };
  if (coi.status === 'pending') return { state: 'pending', label: 'Awaiting verification' };
  const c = building ? coiCompliant(coi, building, requiredAi, asOf) : { ok: coi.expiresOn >= asOf, reasons: coi.expiresOn >= asOf ? [] : ['expired'] };
  if (!c.ok) return { state: c.reasons.includes('expired') ? 'expired' : 'non_compliant', label: c.reasons.map(r => REASON_TEXT[r] || r).join('; ') };
  const daysLeft = daysBetween(asOf, coi.expiresOn);
  if (daysLeft <= 7) return { state: 'expiring_7', label: `Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`, daysLeft };
  if (daysLeft <= 30) return { state: 'expiring_30', label: `Expires in ${daysLeft} days`, daysLeft };
  return { state: 'compliant', label: 'Compliant', daysLeft };
}

export function fullCoi(coi, building, requiredAi) {
  const { _id, fileId, ...rest } = coi;
  const compliance = building ? coiCompliant(coi, building, requiredAi) : null;
  return { ...rest, hasFile: !!fileId, compliance, chip: coiChip(coi, building, requiredAi) };
}
