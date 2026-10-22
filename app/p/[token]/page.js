'use client';

// Public deck view. No session, no nav, no links back into the app: whoever
// holds the link is not a user and must not be offered one.
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import Pill from '@/components/brand/pill';
import { Figure, SectionLabel } from '@/components/brand/stat';

const TONE = { ok: 'ok', warn: 'warn', neutral: 'neutral' };

function LabelledFigure({ f }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      {f.caption && <SectionLabel>{f.caption}</SectionLabel>}
      <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
        <Figure size="md">{f.amount ? `$${Number(f.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `${f.days} days`}</Figure>
        <Pill tone={TONE[f.tone] || 'neutral'}>{f.labelShort || f.labelText}</Pill>
      </div>
      {/* The label is only honest if its meaning is on the page too. */}
      {f.meaning && <div className="mt-1.5 text-xs text-muted-foreground">{f.meaning}</div>}
      {f.basis && <div className="mt-1 text-xs text-muted-foreground"><span className="label-mono">Based on</span> {f.basis}</div>}
    </div>
  );
}

export default function DeckPage() {
  const { token } = useParams();
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    fetch(`/api/p/${token}`)
      .then(async r => (r.ok ? { deck: (await r.json()).deck } : { error: (await r.json().catch(() => ({}))).error || 'This link is not available' }))
      .then(s => setState({ loading: false, ...s }))
      .catch(() => setState({ loading: false, error: 'This link is not available' }));
  }, [token]);

  if (state.loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  if (state.error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl">This link is not available</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Shared links expire after 36 hours and can be withdrawn. Ask whoever sent it for a new one.
          </p>
        </div>
      </div>
    );
  }

  const d = state.deck;
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-16">
        <header>
          <SectionLabel>Boro &amp; Nest Collective{d.subject?.code ? ` · ${d.subject.code}` : ''}</SectionLabel>
          <h1 className="mt-2 text-3xl tracking-tight sm:text-4xl">{d.title}</h1>
          {d.claimSummary && (
            <p className="mt-4 rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">{d.claimSummary}</p>
          )}
        </header>

        {d.sections.map(s => (
          <section key={s.key} className="mt-10">
            <h2 className="text-xl tracking-tight">{s.title}</h2>

            {s.lines && <ul className="mt-3 space-y-1.5 text-sm">{s.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>}

            {s.trades && (
              <div className="mt-3 space-y-3">
                {s.trades.map(t => (
                  <div key={t.trade}>
                    <SectionLabel>{t.trade}</SectionLabel>
                    <ul className="mt-1 space-y-0.5 text-sm">{t.items.map((i, n) => <li key={n}>{i}</li>)}</ul>
                  </div>
                ))}
              </div>
            )}

            {s.items && Array.isArray(s.items) && typeof s.items[0] === 'string' && (
              <ul className="mt-3 space-y-1.5 text-sm">{s.items.map((i, n) => <li key={n}>{i}</li>)}</ul>
            )}

            {s.items && Array.isArray(s.items) && typeof s.items[0] === 'object' && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">{s.items.map((f, n) => <LabelledFigure key={n} f={f} />)}</div>
            )}

            {s.key === 'cost_position' && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">{s.figures.map((f, n) => <LabelledFigure key={n} f={f} />)}</div>
            )}

            {s.key === 'compliance_posture' && (
              <div className="mt-3 rounded-lg border border-border bg-card p-4 text-sm">
                <div className="flex flex-wrap items-baseline gap-3">
                  <Figure size="md">{s.density ?? '—'}</Figure>
                  <span className="text-muted-foreground">open violations per unit · {s.openViolations} open</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{s.note}</p>
              </div>
            )}

            {s.key === 'track_record' && (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-card p-4"><SectionLabel>Projects</SectionLabel><Figure size="md" className="mt-1.5">{s.projects}</Figure></div>
                <div className="rounded-lg border border-border bg-card p-4"><SectionLabel>Buildings</SectionLabel><Figure size="md" className="mt-1.5">{s.buildings}</Figure></div>
                <div className="rounded-lg border border-border bg-card p-4"><SectionLabel>Boroughs</SectionLabel><Figure size="md" className="mt-1.5">{s.boroughs?.length || 0}</Figure></div>
              </div>
            )}
            {s.note && s.key === 'track_record' && <p className="mt-2 text-xs text-muted-foreground">{s.note}</p>}
          </section>
        ))}

        {d.notes && <section className="mt-10 text-sm text-muted-foreground">{d.notes}</section>}

        <footer className="mt-14 border-t border-border pt-5 text-xs text-muted-foreground">
          Prepared by Boro &amp; Nest Collective. This link expires 36 hours after it was issued.
        </footer>
      </div>
    </div>
  );
}
