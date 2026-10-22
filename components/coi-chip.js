import Pill from './brand/pill';

// COI status chip. --sand at 30 days (attention, not yet a failure), --alert at
// 7 days / expired / non-compliant — those are genuine problems.
const TONE = {
  compliant: 'ok',
  expiring_30: 'warn',
  expiring_7: 'problem',
  expired: 'problem',
  non_compliant: 'problem',
  rejected: 'problem',
  pending: 'neutral',
  missing: 'neutral'
};
const SHORT = { compliant: 'Compliant', expiring_30: 'Expiring', expiring_7: 'Expiring', expired: 'Expired', non_compliant: 'Not compliant', rejected: 'Rejected', pending: 'Pending', missing: 'Missing' };

export default function CoiChip({ chip }) {
  if (!chip) return null;
  return (
    <Pill tone={TONE[chip.state] || 'neutral'} variant="outline" title={chip.label}>
      {SHORT[chip.state] || chip.state}
    </Pill>
  );
}
