// Status / role pill. PHASE1_BUILD.md §7.
//
// Callers pass a TONE, never a color. That is deliberate: --alert is reserved
// for genuine problems, and the compliance screens are made of problems, so
// "paint this red" has to be a decision made here once rather than on every
// screen. A rule that is merely approaching its deadline is `warn`, not
// `problem` — see docs/PHASE3_REVIEW.md §D2.
//
//   ok       something is satisfied / current / signed      forest
//   warn     needs attention, has not failed yet            sand
//   problem  genuinely wrong: overdue, expired, failed      alert
//   neutral  a normal state carrying no judgement           border + muted
//   strong   emphasis without judgement (an owner's role)   solid forest

const TONE = {
  ok:      { tint: 'bg-forest/10 text-forest',        outline: 'border-forest/40 text-forest',        solid: 'bg-forest text-cream' },
  warn:    { tint: 'bg-sand/25 text-sand-ink',        outline: 'border-sand text-sand-ink',           solid: 'bg-sand text-forest' },
  problem: { tint: 'bg-alert/12 text-alert-ink',      outline: 'border-alert/50 text-alert-ink',      solid: 'bg-alert text-cream' },
  neutral: { tint: 'bg-muted text-muted-foreground',  outline: 'border-border text-muted-foreground', solid: 'bg-muted-foreground text-cream' },
  strong:  { tint: 'bg-forest/10 text-forest',        outline: 'border-forest/40 text-forest',        solid: 'bg-forest text-cream' }
};

const SIZE = {
  // §7 mono rules: uppercase, 1–2.6px tracking, 9–11px.
  xs: 'px-1.5 py-0.5 text-[9px] tracking-[1.5px] uppercase',
  sm: 'px-2 py-0.5 text-[10px] tracking-[1.6px] uppercase',
  // Sentence case, for pills that carry a person's role rather than a state.
  md: 'px-2.5 py-1 text-xs tracking-normal normal-case'
};

export default function Pill({ tone = 'neutral', variant = 'tint', size = 'xs', title, className = '', children }) {
  const style = (TONE[tone] || TONE.neutral)[variant] || TONE.neutral.tint;
  const border = variant === 'outline' ? 'border' : 'border border-transparent';
  return (
    <span title={title} className={`inline-flex items-center rounded-full font-mono font-medium ${border} ${style} ${SIZE[size] || SIZE.xs} ${className}`}>
      {children}
    </span>
  );
}
