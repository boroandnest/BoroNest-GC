import { Figure, SectionLabel } from './brand/stat';

// AEP density. Figures come from the API (lib/compliance/density.js); nothing is computed here.
// Tones follow §7: over threshold is a genuine problem (--alert), approaching is
// attention (--sand), below is fine (--forest).
const STATUS = {
  over_threshold: ['Over AEP threshold', 'text-alert-ink'],
  approaching: ['Approaching AEP threshold', 'text-sand-ink'],
  clear: ['Below AEP threshold', 'text-forest'],
  unknown: ['Unit count not on file', 'text-muted-foreground']
};

export default function DensityCard({ name, density: d }) {
  if (!d) return null;
  const [label, tone] = STATUS[d.aepStatus] || STATUS.unknown;
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <SectionLabel>{name ? `${name} · ` : ''}HPD violation density</SectionLabel>
      <div className="mt-2 flex flex-wrap items-end gap-6">
        <div>
          <Figure size="lg" className={tone}>{d.density ?? '—'}</Figure>
          <div className="mt-1 text-xs text-muted-foreground">open per unit · threshold 3.0</div>
        </div>
        <div className="text-sm">
          <div className={`font-medium ${tone}`}>{label}</div>
          <div className="text-xs text-muted-foreground">{d.openViolations} open ({d.openClassC} class C) · {d.unitCount ?? '?'} units</div>
          <div className="text-xs text-muted-foreground">{d.awaitingClosure} fixed and awaiting HPD closure — these still count until HPD closes them</div>
        </div>
      </div>
      {d.aepStatus === 'unknown' && <div className="mt-2 text-xs text-muted-foreground">No density is shown without a unit count: a figure built on a guess is worse than none.</div>}
      {d.aepStatus !== 'unknown' && !d.unitCountVerified && <div className="mt-2 text-xs text-sand-ink">Unit count not yet verified{d.unitCountSource ? ` (source: ${d.unitCountSource})` : ''} — treat this density as provisional.</div>}
    </div>
  );
}
