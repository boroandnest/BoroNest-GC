// COI status chip. --sand at 30 days, --alert at 7 days / expired / non-compliant (real problems).
const STYLE = {
  compliant: 'border-emerald-500/40 text-emerald-400',
  expiring_30: 'border-[#C8B89A]/60 text-[#C8B89A]',
  expiring_7: 'border-[#D4654A]/60 text-[#D4654A]',
  expired: 'border-[#D4654A]/60 text-[#D4654A]',
  non_compliant: 'border-[#D4654A]/60 text-[#D4654A]',
  rejected: 'border-[#D4654A]/60 text-[#D4654A]',
  pending: 'border-border text-muted-foreground',
  missing: 'border-border text-muted-foreground'
};
const SHORT = { compliant: 'Compliant', expiring_30: 'Expiring', expiring_7: 'Expiring', expired: 'Expired', non_compliant: 'Not compliant', rejected: 'Rejected', pending: 'Pending', missing: 'Missing' };

export default function CoiChip({ chip }) {
  if (!chip) return null;
  return <span title={chip.label} className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[1.5px] ${STYLE[chip.state] || STYLE.missing}`}>{SHORT[chip.state] || chip.state}</span>;
}
