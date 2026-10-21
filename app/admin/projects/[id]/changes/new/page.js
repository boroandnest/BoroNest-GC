'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import SiteNav from '@/components/site-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { formatMoney } from '@/lib/format';

const REASONS = [
  ['owner_request', 'Client asked for it'],
  ['unforeseen_condition', 'Found when we opened the wall'],
  ['code_requirement', 'Required by code / inspector'],
  ['design_change', 'Design updated'],
  ['value_engineering', 'Value engineering'],
  ['bn_error', 'Our error (absorbed by B&N — never charged)']
];

// Staff: draft a change order. The total is computed on the server from the line deltas.
export default function NewChangePage() {
  const { id } = useParams();
  const router = useRouter();
  const [lines, setLines] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', reason: 'owner_request', againstContingency: false, scheduleImpactDays: '', affectsPermit: false, costDelta: '' });
  const [picked, setPicked] = useState({}); // lineId -> delta string
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${id}/scope`).then(r => r.ok ? r.json() : null).then(d => setLines(d?.lines || []));
  }, [id]);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    const body = { ...form, lines: Object.entries(picked).map(([scopeLineId, costDelta]) => ({ scopeLineId, costDelta: costDelta || '0' })) };
    const r = await fetch(`/api/projects/${id}/changes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) { toast.error(d.error || 'Could not create'); return; }
    toast.success(`Change order CO-${String(d.changeOrder.number).padStart(3, '0')} sent for signature`);
    router.push(`/projects/${id}/changes/${d.changeOrder.id}`);
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  return (
    <>
      <SiteNav />
      <div className="container max-w-4xl py-8">
        <Link href={`/projects/${id}/changes`} className="text-sm text-muted-foreground hover:text-foreground">← Change orders</Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">New change order</h1>
        <form onSubmit={submit} className="mt-6 space-y-6">
          <Card>
            <CardContent className="space-y-4 p-6">
              <Input required placeholder="Title (plain language — the client reads this)" value={form.title} onChange={set('title')} />
              <Textarea rows={4} placeholder="What changes and why" value={form.description} onChange={set('description')} />
              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-xs text-muted-foreground">Reason
                  <select value={form.reason} onChange={set('reason')} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
                    {REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </label>
                <label className="text-xs text-muted-foreground">Schedule impact (working days)
                  <Input className="mt-1" inputMode="numeric" value={form.scheduleImpactDays} onChange={set('scheduleImpactDays')} />
                </label>
                <label className="text-xs text-muted-foreground">Total if no lines are priced ($)
                  <Input className="mt-1" inputMode="decimal" value={form.costDelta} onChange={set('costDelta')} />
                </label>
              </div>
              <div className="flex flex-wrap gap-6 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.againstContingency} onChange={set('againstContingency')} disabled={form.reason === 'bn_error'} /> Paid from contingency</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.affectsPermit} onChange={set('affectsPermit')} /> Affects permit filings</label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Affected scope lines</CardTitle><CardDescription>Ticked lines are blocked from starting until the change order is signed or voided. Subcontractors only see lines in their own trade.</CardDescription></CardHeader>
            <CardContent>
              {!lines ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : lines.length === 0 ? <div className="text-sm text-muted-foreground">No scope lines yet.</div> : (
                <div className="divide-y divide-border rounded-lg border border-border">
                  {lines.map(l => (
                    <div key={l.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                      <input type="checkbox" checked={l.id in picked} onChange={e => { const n = { ...picked }; if (e.target.checked) n[l.id] = ''; else delete n[l.id]; setPicked(n); }} aria-label={`Include ${l.title}`} />
                      <span className="w-28 capitalize text-muted-foreground">{l.trade}</span>
                      <span className="flex-1">{l.title} <span className="text-xs text-muted-foreground">· {l.status?.replace('_', ' ')} · {formatMoney(l.lineTotal)}</span></span>
                      {l.id in picked && <Input className="w-36" inputMode="decimal" placeholder="Δ $" value={picked[l.id]} onChange={e => setPicked({ ...picked, [l.id]: e.target.value })} />}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send for signature</Button>
        </form>
      </div>
    </>
  );
}
