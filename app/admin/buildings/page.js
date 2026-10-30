'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SiteNav from '@/components/site-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { formatMoney } from '@/lib/format';

const BLANK = { name: '', address: '', managingAgent: '', certHolderName: '', certHolderCo: '', certHolderAddr: '', requiredAiStatic: '', requiredAiTokens: '{resident_name}, Apt {unit}\n{resident_phone}', coiLeadDays: '4', coiLeadIsBusinessDays: true, coiRecipients: '', requiredGl: '1000000', requiresWc: true, requiredAuto: '0', requiredEl: '0' };

// Staff: buildings and what their managing agents require on every certificate.
export default function BuildingsPage() {
  const router = useRouter();
  const [list, setList] = useState(null);
  const [form, setForm] = useState(null);
  const [editingId, setEditingId] = useState(null);

  async function load() {
    const r = await fetch('/api/buildings');
    if (r.status === 401) { router.replace('/login?next=/admin/buildings'); return; }
    if (r.status === 403) { router.replace('/dashboard'); return; }
    setList((await r.json()).buildings);
  }
  useEffect(() => { load(); }, []);

  function edit(b) {
    setEditingId(b.id);
    setForm({ ...BLANK, ...b, requiredAiStatic: (b.requiredAiStatic || []).join('\n'), requiredAiTokens: (b.requiredAiTokens || []).join('\n'), coiRecipients: (b.coiRecipients || []).join('\n'), coiLeadDays: String(b.coiLeadDays ?? 4) });
  }

  async function save(e) {
    e.preventDefault();
    const body = { ...form, requiredAiStatic: form.requiredAiStatic.split('\n'), requiredAiTokens: form.requiredAiTokens.split('\n'), coiRecipients: form.coiRecipients.split('\n') };
    const r = await fetch(editingId ? `/api/buildings/${editingId}` : '/api/buildings', { method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast.error(d.error || 'Could not save'); return; }
    toast.success('Building saved');
    setForm(null); setEditingId(null); load();
  }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  return (
    <>
      <SiteNav />
      <div className="container max-w-5xl py-8">
        <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">← PM Console</Link>
        <div className="mt-4 flex items-end justify-between gap-3">
          <div><div className="font-mono text-[10px] uppercase tracking-[2px] text-[var(--d-brick-lo)]">Buildings</div><h1 className="mt-1 text-3xl font-bold tracking-tight">Buildings &amp; COI requirements</h1></div>
          <Button onClick={() => { setEditingId(null); setForm({ ...BLANK }); }}>New building</Button>
        </div>

        {form && (
          <Card className="mt-6">
            <CardHeader><CardTitle className="text-base">{editingId ? 'Edit building' : 'New building'}</CardTitle><CardDescription>Tokens: {'{resident_name}'}, {'{resident_phone}'}, {'{unit}'}, {'{building_name}'} — resolved per project at creation.</CardDescription></CardHeader>
            <CardContent>
              <form onSubmit={save} className="grid gap-3 md:grid-cols-3">
                <Input required placeholder="Building / owner entity" value={form.name} onChange={set('name')} />
                <Input placeholder="Address" value={form.address} onChange={set('address')} />
                <Input placeholder="Managing agent" value={form.managingAgent} onChange={set('managingAgent')} />
                <div className="md:col-span-3 font-mono text-[10px] uppercase tracking-[2px] text-muted-foreground">Certificate holder (separate from additional insured)</div>
                <Input placeholder="Holder name" value={form.certHolderName} onChange={set('certHolderName')} />
                <Input placeholder="C/O line" value={form.certHolderCo} onChange={set('certHolderCo')} />
                <Input placeholder="Holder address" value={form.certHolderAddr} onChange={set('certHolderAddr')} />
                <label className="text-xs text-muted-foreground md:col-span-1">Additional insured — fixed entities (one per line)<Textarea rows={4} value={form.requiredAiStatic} onChange={set('requiredAiStatic')} /></label>
                <label className="text-xs text-muted-foreground md:col-span-1">Additional insured — per-unit templates<Textarea rows={4} value={form.requiredAiTokens} onChange={set('requiredAiTokens')} /></label>
                <label className="text-xs text-muted-foreground md:col-span-1">Send certificates to (emails)<Textarea rows={4} value={form.coiRecipients} onChange={set('coiRecipients')} /></label>
                <label className="text-xs text-muted-foreground">GL minimum ($)<Input value={form.requiredGl} onChange={set('requiredGl')} /></label>
                <label className="text-xs text-muted-foreground">Auto minimum ($, 0 = not required)<Input value={form.requiredAuto} onChange={set('requiredAuto')} /></label>
                <label className="text-xs text-muted-foreground">Employer's liability minimum ($)<Input value={form.requiredEl} onChange={set('requiredEl')} /></label>
                <label className="text-xs text-muted-foreground">Lead time (days)<Input value={form.coiLeadDays} onChange={set('coiLeadDays')} /></label>
                <label className="flex items-center gap-2 pt-5 text-sm"><input type="checkbox" checked={form.coiLeadIsBusinessDays} onChange={set('coiLeadIsBusinessDays')} /> Business days</label>
                <label className="flex items-center gap-2 pt-5 text-sm"><input type="checkbox" checked={form.requiresWc} onChange={set('requiresWc')} /> Workers' comp required</label>
                <div className="flex gap-2 md:col-span-3"><Button type="submit">Save</Button><Button type="button" variant="ghost" onClick={() => setForm(null)}>Cancel</Button></div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="mt-6 space-y-3">
          {!list ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : list.length === 0 ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No buildings yet.</CardContent></Card> : list.map(b => (
            <Card key={b.id}>
              <CardContent className="flex flex-wrap items-start justify-between gap-3 p-5">
                <div className="text-sm">
                  <div className="font-medium">{b.name}</div>
                  <div className="text-xs text-muted-foreground">{b.address}{b.managingAgent ? ` · ${b.managingAgent}` : ''}</div>
                  <div className="mt-1 text-xs text-muted-foreground">GL {formatMoney(b.requiredGl, { cents: false })}{b.requiresWc ? ' · WC' : ''}{b.requiredAuto !== '0.00' ? ` · Auto ${formatMoney(b.requiredAuto, { cents: false })}` : ''}{b.requiredEl !== '0.00' ? ` · EL ${formatMoney(b.requiredEl, { cents: false })}` : ''} · {b.coiLeadDays} {b.coiLeadIsBusinessDays === false ? 'calendar' : 'business'} days lead</div>
                  <div className="mt-1 text-xs text-muted-foreground">AI: {[...(b.requiredAiStatic || []), ...(b.requiredAiTokens || [])].join(' · ')}</div>
                </div>
                <div className="flex gap-2">
                  <Button asChild size="sm" variant="outline"><Link href={`/admin/buildings/${b.id}`}>Violations &amp; density</Link></Button>
                  <Button size="sm" variant="ghost" onClick={() => edit(b)}>Edit</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
