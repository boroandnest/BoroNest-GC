// AEP density. Figures come from the API (lib/compliance/density.js); nothing is computed here.
const STATUS = {
  over_threshold: ['Over AEP threshold', '#D4654A'],
  approaching: ['Approaching AEP threshold', '#C8B89A'],
  clear: ['Below AEP threshold', '#253D35'],
  unknown: ['Unit count not on file', undefined]
};

export default function DensityCard({ name, density: d }) {
  if (!d) return null;
  const [label, color] = STATUS[d.aepStatus] || STATUS.unknown;
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="font-mono text-[10px] uppercase tracking-[2px] text-muted-foreground">{name ? `${name} · ` : ''}HPD violation density</div>
      <div className="mt-2 flex flex-wrap items-end gap-6">
        <div>
          <div className="font-mono text-3xl" style={{ color }}>{d.density ?? '—'}</div>
          <div className="text-xs text-muted-foreground">open per unit · threshold 3.0</div>
        </div>
        <div className="text-sm">
          <div className="font-medium" style={{ color }}>{label}</div>
          <div className="text-xs text-muted-foreground">{d.openViolations} open ({d.openClassC} class C) · {d.unitCount ?? '?'} units</div>
          <div className="text-xs text-muted-foreground">{d.awaitingClosure} fixed and awaiting HPD closure — these still count until HPD closes them</div>
        </div>
      </div>
      {d.aepStatus === 'unknown' && <div className="mt-2 text-xs text-muted-foreground">No density is shown without a unit count: a figure built on a guess is worse than none.</div>}
      {d.aepStatus !== 'unknown' && !d.unitCountVerified && <div className="mt-2 text-xs text-[#C8B89A]">Unit count not yet verified{d.unitCountSource ? ` (source: ${d.unitCountSource})` : ''} — treat this density as provisional.</div>}
    </div>
  );
}
