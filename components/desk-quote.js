'use client';

// T33 · Desk quote versus live.
//
// Renders strings the server computed. The one rule worth stating here: the
// arrow and the colour come from `intent`, which the server sets, never from
// the sign of the number. Under budget is negative and good news.

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { formatMoney } from '@/lib/format';
import Pill from '@/components/brand/pill';
import { Delta, Figure, SectionLabel } from '@/components/brand/stat';

function VarianceRow({ title, note, v }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <SectionLabel>{title}</SectionLabel>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Figure size="md">{formatMoney(v.live)}</Figure>
        <span className="text-sm text-muted-foreground">against {formatMoney(v.baseline)}</span>
      </div>
      <div className="mt-2">
        <Delta
          intent={v.intent}
          direction={v.direction}
          value={`${v.over ? 'over by ' : v.intent === 'flat' ? 'on the number' : 'under by '}${v.intent === 'flat' ? '' : formatMoney(v.abs)}`}
          label={v.pct !== null && v.intent !== 'flat' ? `(${v.pct.replace('-', '')}%)` : null}
        />
      </div>
      {note && <div className="mt-2 text-xs text-muted-foreground">{note}</div>}
    </div>
  );
}

export default function DeskQuotePanel({ projectId }) {
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ amount: '', quotedAt: '', durationDays: '', scopeSummary: '', startedAt: '', completedAt: '' });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch(`/api/projects/${projectId}/quote`);
    if (r.ok) setData(await r.json());
  }
  useEffect(() => { load(); }, [projectId]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch(`/api/projects/${projectId}/quote`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) {
      toast.success(data?.variance ? 'Re-quoted. The previous quote is kept.' : 'Quote recorded.');
      setOpen(false);
      setForm({ amount: '', quotedAt: '', durationDays: '', scopeSummary: '', startedAt: '', completedAt: '' });
      load();
    } else toast.error(d.error || 'Could not save');
  }

  const v = data?.variance;
  const s = v?.schedule;

  return (
    <Card className="mt-6">
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base">Desk quote vs live</CardTitle>
          <CardDescription>
            The number given after the site visit, frozen at issue. A re-quote keeps the old one.
          </CardDescription>
        </div>
        <Button size="sm" variant={v ? 'outline' : 'default'} onClick={() => setOpen(o => !o)}>
          {v ? 'Re-quote' : 'Record quote'}
        </Button>
      </CardHeader>

      <CardContent>
        {!v && !open && (
          <div className="text-sm text-muted-foreground">
            No desk quote on file. Without one there is no baseline to measure against — the live
            estimate moves as the job moves, so comparing to it would compare a number to itself.
          </div>
        )}

        {v && (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <VarianceRow
                title="Against the agreed baseline"
                v={v.vsRevised}
                note={
                  v.ceilingAdjustments !== '0.00'
                    ? `Quoted ${formatMoney(v.quote.amount)} plus ${formatMoney(v.ceilingAdjustments)} in ${v.signedCount} signed change order${v.signedCount === 1 ? '' : 's'}. Agreed extra work is not an overrun.`
                    : `Quoted ${formatMoney(v.quote.amount)} on ${v.quote.quotedAt}. No signed change orders have moved it.`
                }
              />
              {/* Staff-only, and only when it says something the row beside it
                  does not: with no ceiling-raising change order the two
                  baselines are the same number twice. */}
              {v.vsQuote && v.ceilingAdjustments !== '0.00' && (
                <VarianceRow
                  title="Before change orders — internal"
                  v={v.vsQuote}
                  note="The live quote on its own, ignoring agreed extras. Estimating accuracy, not the client's position."
                />
              )}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-border p-4">
                <SectionLabel>Schedule</SectionLabel>
                {s?.known ? (
                  <>
                    <div className="mt-2 flex flex-wrap items-baseline gap-x-3">
                      <Figure size="md">{s.elapsedDays} days</Figure>
                      <span className="text-sm text-muted-foreground">against {s.revisedDays} agreed</span>
                    </div>
                    <div className="mt-2">
                      <Delta
                        intent={s.intent}
                        direction={s.direction}
                        value={s.deltaDays === 0 ? 'on schedule' : `${s.absDays} days ${s.deltaDays > 0 ? 'over' : 'under'}`}
                        label={s.complete ? '(complete)' : null}
                      />
                    </div>
                    {s.scheduleImpactDays !== 0 && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Quoted {s.quotedDays} days, extended {s.scheduleImpactDays} by signed change orders.
                      </div>
                    )}
                  </>
                ) : (
                  <div className="mt-2 text-sm text-muted-foreground">
                    {s?.reason === 'no_duration_quoted'
                      ? 'No duration was quoted, so there is nothing to measure against.'
                      : 'Not tracked until a start date is recorded. A guess here would measure how long the owner took to decide.'}
                  </div>
                )}
              </div>

              {v.absorbedLosses && v.absorbedLosses !== '0.00' && (
                <div className="rounded-lg border border-border p-4">
                  <SectionLabel>Absorbed by B&amp;N — internal</SectionLabel>
                  <Figure size="md" className="mt-2">{formatMoney(v.absorbedLosses)}</Figure>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Corrections on our side. Never charged to the client and never in their variance.
                  </div>
                </div>
              )}
            </div>

            {data.history?.length > 1 && (
              <div className="mt-4">
                <SectionLabel>Quote history</SectionLabel>
                <ul className="mt-2 space-y-1 text-sm">
                  {data.history.map(q => (
                    <li key={q.id} className="flex items-center gap-2">
                      <span className="data-mono">{q.quotedAt}</span>
                      <span className="data-mono">{formatMoney(q.amount)}</span>
                      {q.supersededBy ? <Pill tone="neutral">Superseded</Pill> : <Pill tone="ok">Live</Pill>}
                      {q.supersededReason && <span className="text-xs text-muted-foreground">{q.supersededReason}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {open && (
          <form onSubmit={submit} className="mt-4 space-y-3 border-t border-border pt-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div><Label className="mb-1.5 block text-sm">Quoted amount ($)</Label>
                <Input required inputMode="decimal" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="248000.00" /></div>
              <div><Label className="mb-1.5 block text-sm">Site visit date</Label>
                <Input required type="date" value={form.quotedAt} onChange={e => setForm({ ...form, quotedAt: e.target.value })} /></div>
              <div><Label className="mb-1.5 block text-sm">Quoted duration (days)</Label>
                <Input type="number" min="0" value={form.durationDays} onChange={e => setForm({ ...form, durationDays: e.target.value })} /></div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div><Label className="mb-1.5 block text-sm">Job started</Label>
                <Input type="date" value={form.startedAt} onChange={e => setForm({ ...form, startedAt: e.target.value })} /></div>
              <div><Label className="mb-1.5 block text-sm">Job completed</Label>
                <Input type="date" value={form.completedAt} onChange={e => setForm({ ...form, completedAt: e.target.value })} /></div>
            </div>
            <div><Label className="mb-1.5 block text-sm">Scope as quoted</Label>
              <Input value={form.scopeSummary} onChange={e => setForm({ ...form, scopeSummary: e.target.value })} placeholder="Full gut, kitchen and two baths, no facade work" /></div>
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {v ? 'Issue new quote' : 'Record quote'}</Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
            {v && <div className="text-xs text-muted-foreground">The current quote is kept and marked superseded. Nothing is overwritten.</div>}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
