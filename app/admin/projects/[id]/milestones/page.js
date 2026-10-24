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

const RELEASE = {
  awaiting_verification: ['Awaiting verification', 'text-muted-foreground border-border'],
  in_window: ['24h dispute window', 'text-sand-ink border-sand'],
  disputed: ['Disputed — release paused', 'text-alert-ink border-alert/50'],
  releasing: ['Releasing', 'text-sand-ink border-sand'],
  released: ['Paid', 'text-forest border-forest/30'],
  transfer_failed: ['Transfer failed', 'text-alert-ink border-alert/50'],
  not_applicable: ['Client draw', 'text-muted-foreground border-border']
};

// Staff: create milestones from the agreed payment schedule, verify with photos, handle disputes.
export default function MilestonesAdmin() {
  const { id } = useParams();
  const router = useRouter();
  const [list, setList] = useState(null);
  const [payees, setPayees] = useState([]);
  const [form, setForm] = useState({ title: '', trigger: '', amount: '', payeeId: '', dueDate: '' });

  async function load() {
    const r = await fetch(`/api/projects/${id}/milestones`);
    if (r.status === 401) { router.replace(`/login?next=/admin/projects/${id}/milestones`); return; }
    const d = await r.json();
    if (d.viewerRole !== 'bn_staff') { router.replace(`/projects/${id}`); return; }
    setList(d.milestones);
  }
  useEffect(() => {
    load();
    Promise.all([fetch(`/api/projects/${id}`).then(r => r.json()), fetch('/api/subcontractors').then(r => r.json())]).then(([p, s]) => {
      const on = new Set((p.parties || []).filter(x => x.status === 'accepted' && ['subcontractor', 'expediter'].includes(x.role)).map(x => x.userEmail));
      setPayees((s.subcontractors || []).filter(u => on.has(u.email)));
    });
  }, [id]);

  async function post(path, body, ok) {
    const isForm = body instanceof FormData;
    const r = await fetch(`/api/projects/${id}/milestones${path}`, { method: 'POST', headers: isForm ? undefined : { 'Content-Type': 'application/json' }, body: isForm ? body : JSON.stringify(body || {}) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast.error(d.error || 'Failed'); return false; }
    toast.success(ok); load(); return true;
  }

  async function create(e) {
    e.preventDefault();
    if (await post('', { ...form, payeeId: form.payeeId || null }, 'Milestone added')) setForm({ title: '', trigger: '', amount: '', payeeId: '', dueDate: '' });
  }

  return (
    <>
      <SiteNav />
      <div className="container max-w-5xl py-8">
        <Link href={`/projects/${id}`} className="text-sm text-muted-foreground hover:text-foreground">← Project</Link>
        <div className="mt-4 font-mono text-[10px] uppercase tracking-[2px] text-primary">Payments</div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Milestones</h1>
        <p className="mt-1 text-sm text-muted-foreground">Verifying opens a 24-hour window for the client to dispute. After it closes, payment releases to the subcontractor's Stripe account automatically.</p>

        <Card className="mt-6">
          <CardHeader><CardTitle className="text-base">Add milestone</CardTitle><CardDescription>From the agreed payment schedule. Leave payee empty for a client-to-B&amp;N draw.</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={create} className="grid gap-3 md:grid-cols-6">
              <Input required placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="md:col-span-2" />
              <Input placeholder="Trigger (e.g. Rough plumbing inspection passed)" value={form.trigger} onChange={e => setForm({ ...form, trigger: e.target.value })} className="md:col-span-2" />
              <Input required inputMode="decimal" placeholder="Amount $" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
              <select value={form.payeeId} onChange={e => setForm({ ...form, payeeId: e.target.value })} className="rounded-md border border-border bg-background px-2 text-sm"><option value="">Client draw</option>{payees.map(p => <option key={p.id} value={p.id}>{p.company || p.name}</option>)}</select>
              <Button type="submit" className="md:col-span-6 md:w-fit">Add</Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 space-y-3">
          {!list ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : list.map(m => {
            const [label, cls] = RELEASE[m.releaseStatus] || [m.status, 'text-muted-foreground border-border'];
            return (
              <Card key={m.id}>
                <CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <div className="font-medium">{m.title || m.name}</div>
                    <div className="text-xs text-muted-foreground">{m.trigger || m.phase}{m.payeeName ? ` · ${m.payeeName}` : ''}{m.releaseEta ? ` · releases after ${new Date(m.releaseEta).toLocaleString()}` : ''}</div>
                    {m.disputeOpenedAt && !m.disputeResolvedAt && <div className="mt-1 text-xs text-alert-ink">Client dispute: {m.disputeReason || '(no reason given)'}</div>}
                    {m.releaseError && <div className="mt-1 text-xs text-alert-ink">{m.releaseError === 'payouts_not_enabled' ? 'Payee has not finished Stripe payout setup.' : m.releaseError}</div>}
                    {m.stripeTransferId && <div className="mt-1 font-mono text-[10px] text-muted-foreground">{m.stripeTransferId}</div>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono">{formatMoney(m.amount)}</span>
                    <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[1.5px] ${cls}`}>{label}</span>
                    {!m.verifiedAt && (
                      <label className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-xs hover:border-primary">
                        Verify with photos
                        <input type="file" accept="image/*" multiple className="hidden" onChange={e => { const f = new FormData(); for (const x of e.target.files) f.append('photos', x); post(`/${m.id}/verify`, f, 'Verified — 24h window open'); }} />
                      </label>
                    )}
                    {!m.verifiedAt && <Button size="sm" variant="ghost" onClick={() => post(`/${m.id}/verify`, {}, 'Verified — 24h window open')}>Verify without photos</Button>}
                    {m.disputeOpenedAt && !m.disputeResolvedAt && <Button size="sm" variant="outline" onClick={() => { const note = prompt('Resolution note'); if (note !== null) post(`/${m.id}/resolve`, { note }, 'Dispute resolved'); }}>Resolve dispute</Button>}
                    {m.releaseStatus === 'transfer_failed' && <Button size="sm" variant="outline" onClick={() => post(`/${m.id}/retry`, {}, 'Re-queued for release')}>Retry release</Button>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
