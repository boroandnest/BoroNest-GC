// Figure, delta and section label. PHASE1_BUILD.md §7.
//
// These components FORMAT, they do not compute. Every value arrives as a
// string the server already rounded — the same rule Phase 2 holds for money
// (lib/format.js, never toFixed/parseFloat in a page), extended to day counts
// and variances because they fail the same way. See docs/PHASE3_REVIEW.md §D3.

// §7: Playfair for big numbers, ≥18px only. Never below.
const FIGURE = {
  sm: 'text-lg',      // 18px — the floor
  md: 'text-2xl',
  lg: 'text-[2rem]',
  xl: 'text-[2.75rem]'
};

export function SectionLabel({ className = '', children }) {
  return <div className={`label-mono text-muted-foreground ${className}`}>{children}</div>;
}

export function Figure({ size = 'md', className = '', children }) {
  return <div className={`display-figure ${FIGURE[size] || FIGURE.md} ${className}`}>{children}</div>;
}

// A change against a baseline.
//
// `intent` is required and is NOT inferred from the sign. Under budget is a
// negative number and good news; a schedule running short is negative and also
// good news; a contingency draw is positive and bad. Letting the arrow decide
// the color is how a dashboard tells an owner their savings are a problem.
//
//   good     forest     bad   alert     flat/unknown   muted
const INTENT = { good: 'text-forest', bad: 'text-alert-ink', flat: 'text-muted-foreground' };

export function Delta({ intent = 'flat', direction, value, label, className = '' }) {
  const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '';
  return (
    <span className={`data-mono inline-flex items-center gap-1 text-xs font-medium ${INTENT[intent] || INTENT.flat} ${className}`}>
      {arrow && <span aria-hidden="true">{arrow}</span>}
      <span>{value}</span>
      {label && <span className="text-muted-foreground font-normal">{label}</span>}
    </span>
  );
}

// Label / figure / delta, the unit the reference dashboards are built from.
export function Stat({ label, value, size = 'md', delta, footnote, className = '' }) {
  return (
    <div className={className}>
      <SectionLabel>{label}</SectionLabel>
      <div className="mt-1.5 flex items-baseline gap-2">
        <Figure size={size}>{value}</Figure>
        {delta}
      </div>
      {footnote && <div className="mt-1 text-xs text-muted-foreground">{footnote}</div>}
    </div>
  );
}

// A bordered card wrapping a Stat, for grid layouts.
export function StatTile({ className = '', ...props }) {
  return (
    <div className={`rounded-lg border border-border bg-card p-4 ${className}`}>
      <Stat {...props} />
    </div>
  );
}
