'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import SiteNav from '@/components/site-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { formatMoney } from '@/lib/format';

const PERIOD_STATUS = { pending: 'Upcoming / open', invoiced: 'Invoiced', paid: 'Paid', disputed: 'Disputed' };

// Retainer billing + material pass-through. All amounts come from the server (lib/billing).
export default function BillingPage() {
  const { id } = useParams();
  const router = useRouter();
  const [d, setD] = useState(null);

  async function load() {
    const r = await fetch(`/api/projects/${id}/billing`);
    if (r.status === 401) { router.replace(`/login?next=/projects/${id}/billing`); return; }
    if (!r.ok) { router.replace(`/projects/${id}`); return; }
    setD(await r.json());
  }
  useEffect(() => { load(); }, [id]);

  async function invoice(pt) {
    const r = await fetch(`/api/projects/${id}/passthroughs/${pt.id}/invoice`);
    const x = await r.json();
    if (r.ok) window.open(x.url, '_blank', 'noopener'); else toast.error(x.error || 'Not available');
  }
  async function patchPeriod(p, body) {
    const r = await fetch(`/api/projects/${id}/retainers/${p.retainerId}/periods/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) load(); else toast.error((await r.json()).error || 'Failed');
  }

  if (!d) return <><SiteNav /><div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></>;
  const staff = d.viewerRole === 'bn_staff';

  return (
    <>
      <SiteNav />
      <div className="container max-w-5xl py-8">
        <Link href={`/projects/${id}`} className="text-sm text-muted-foreground hover:text-foreground">← Project</Link>
        <div className="mt-4 font-mono text-[10px] uppercase tracking-[2px] text-primary">Billing</div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Retainer &amp; materials</h1>

        {d.retainers.map(r => (
          <Card key={r.id} className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">{r.label} · {formatMoney(r.monthlyAmount)}/month</CardTitle>
              <CardDescription>
                {r.startsOn} → {r.endsOn || 'ongoing'} · billed on day {r.billDay}
                {r.guaranteeKind && <> · Guarantee: {r.guaranteeKind === 'no_violation_growth' ? (r.guaranteeMetric?.max_density ? `violation density at or below ${r.guaranteeMetric.max_density}` : 'no growth in open violations') : 'response time'} — or {r.guaranteeCreditPct}% off that month, applied automatically.</>}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="font-mono text-[10px] uppercase tracking-[1.5px] text-muted-foreground"><tr className="border-b border-border"><th className="p-3 text-left">Period</th><th className="p-3 text-right">Base</th><th className="p-3 text-right">Credit</th><th className="p-3 text-right">Amount</th><th className="p-3 text-left">Guarantee</th><th className="p-3 text-left">Status</th>{staff && <th />}</tr></thead>
                <tbody>
                  {d.periods.filter(p => p.retainerId === r.id).map(p => (
                    <tr key={p.id} className="border-b border-border/40 last:border-0">
                      <td className="p-3 font-mono text-xs">{p.periodStart} – {p.periodEnd}</td>
                      <td className="p-3 text-right font-mono">{formatMoney(p.baseAmount)}</td>
                      <td className="p-3 text-right font-mono">{p.creditApplied !== '0.00' ? `−${formatMoney(p.creditApplied)}` : '—'}</td>
                      <td className="p-3 text-right font-mono font-semibold">{formatMoney(p.amount)}</td>
                      <td className="p-3 text-xs">{!r.guaranteeKind ? '—' : p.deliverablesMet === true ? <span className="text-forest">Met</span> : p.deliverablesMet === false ? <span className="text-alert-ink">Not met — credit applied</span> : <span className="text-muted-foreground">Pending</span>}</td>
                      <td className="p-3 text-xs">{PERIOD_STATUS[p.status]}</td>
                      {staff && (
                        <td className="p-3 text-right whitespace-nowrap">
                          {r.guaranteeKind && <><Button size="sm" variant="ghost" onClick={() => patchPeriod(p, { deliverablesMet: true })}>Met</Button><Button size="sm" variant="ghost" onClick={() => patchPeriod(p, { deliverablesMet: false })}>Not met</Button></>}
                          {p.status === 'pending' && <Button size="sm" variant="ghost" onClick={() => patchPeriod(p, { status: 'invoiced' })}>Invoiced</Button>}
                          {p.status === 'invoiced' && <Button size="sm" variant="ghost" onClick={() => patchPeriod(p, { status: 'paid' })}>Paid</Button>}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ))}
        {d.retainers.length === 0 && <Card className="mt-6"><CardContent className="p-6 text-sm text-muted-foreground">No retainer on this project.</CardContent></Card>}

        <Card className="mt-6">
          <CardHeader><CardTitle className="text-base">Materials at cost + markup</CardTitle><CardDescription>Every line links to the vendor's own invoice.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {d.passthroughs.length === 0 && <div className="text-sm text-muted-foreground">No material pass-throughs yet.</div>}
            {d.passthroughs.map(pt => (
              <div key={pt.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
                <div><div className="font-medium">{pt.vendor} · {pt.description}</div><div className="text-xs text-muted-foreground">{pt.periodStart} · cost {formatMoney(pt.cost)} + {pt.markupPct}%</div></div>
                <div className="flex items-center gap-3"><span className="font-mono">{formatMoney(pt.billed)}</span>{pt.hasInvoice && <Button size="sm" variant="outline" onClick={() => invoice(pt)}>Vendor invoice</Button>}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        {staff && <StaffForms projectId={id} onDone={load} />}
      </div>
    </>
  );
}

function StaffForms({ projectId, onDone }) {
  const [r, setR] = useState({ label: '', monthlyAmount: '', startsOn: '', endsOn: '', guaranteeKind: '', guaranteeCreditPct: '20', maxDensity: '' });
  async function createRetainer(e) {
    e.preventDefault();
    const body = { ...r, guaranteeKind: r.guaranteeKind || null, guaranteeMetric: r.maxDensity ? { max_density: r.maxDensity } : null, endsOn: r.endsOn || null };
    const res = await fetch(`/api/projects/${projectId}/retainers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(d.error || 'Failed'); return; }
    toast.success('Retainer created; periods generated');
    onDone();
  }
  async function addPassthrough(e) {
    e.preventDefault();
    const res = await fetch(`/api/projects/${projectId}/passthroughs`, { method: 'POST', body: new FormData(e.currentTarget) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(d.error || 'Failed'); return; }
    toast.success('Pass-through added');
    e.target.reset();
    onDone();
  }
  return (
    <div className="mt-6 grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">Add retainer (staff)</CardTitle><CardDescription>Starts on the bill day; periods are generated automatically.</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={createRetainer} className="grid gap-2">
            <Input required placeholder="Label (e.g. Crisis response)" value={r.label} onChange={e => setR({ ...r, label: e.target.value })} />
            <Input required inputMode="decimal" placeholder="Monthly amount $" value={r.monthlyAmount} onChange={e => setR({ ...r, monthlyAmount: e.target.value })} />
            <div className="grid grid-cols-2 gap-2"><label className="text-xs text-muted-foreground">Starts<Input required type="date" value={r.startsOn} onChange={e => setR({ ...r, startsOn: e.target.value })} /></label><label className="text-xs text-muted-foreground">Ends (optional)<Input type="date" value={r.endsOn} onChange={e => setR({ ...r, endsOn: e.target.value })} /></label></div>
            <select value={r.guaranteeKind} onChange={e => setR({ ...r, guaranteeKind: e.target.value })} className="rounded-md border border-border bg-background px-2 py-2 text-sm"><option value="">No performance guarantee</option><option value="no_violation_growth">No violation growth</option><option value="response_sla">Response SLA (judged manually)</option></select>
            {r.guaranteeKind && <div className="grid grid-cols-2 gap-2"><Input placeholder="Credit % if missed" value={r.guaranteeCreditPct} onChange={e => setR({ ...r, guaranteeCreditPct: e.target.value })} />{r.guaranteeKind === 'no_violation_growth' && <Input placeholder="Max density (optional)" value={r.maxDensity} onChange={e => setR({ ...r, maxDensity: e.target.value })} />}</div>}
            <Button type="submit" size="sm" className="w-fit">Create retainer</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Add material pass-through (staff)</CardTitle><CardDescription>Attach the vendor invoice — the client sees it.</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={addPassthrough} className="grid gap-2">
            <Input required name="vendor" placeholder="Vendor" />
            <Input required name="description" placeholder="What was bought" />
            <div className="grid grid-cols-3 gap-2"><Input required name="cost" inputMode="decimal" placeholder="Cost $" /><Input name="markupPct" defaultValue="10" placeholder="Markup %" /><Input required type="date" name="periodStart" aria-label="Billing period" /></div>
            <Input required type="file" name="invoice" accept=".pdf,.png,.jpg,.jpeg" />
            <Button type="submit" size="sm" className="w-fit">Add</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
