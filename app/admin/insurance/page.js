'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SiteNav from '@/components/site-nav';
import CoiChip from '@/components/coi-chip';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { formatMoney } from '@/lib/format';

// Staff verification queue. Open the certificate (signed URL), correct what the trade typed against
// the actual ACORD, then verify or reject.
export default function InsuranceQueue() {
  const router = useRouter();
  const [status, setStatus] = useState('pending');
  const [list, setList] = useState(null);

  async function load(s = status) {
    const r = await fetch(`/api/admin/cois?status=${s}`);
    if (r.status === 401) { router.replace('/login?next=/admin/insurance'); return; }
    if (r.status === 403) { router.replace('/dashboard'); return; }
    setList((await r.json()).cois);
  }
  useEffect(() => { load(status); }, [status]);

  return (
    <>
      <SiteNav />
      <div className="container max-w-5xl py-8">
        <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">← PM Console</Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div><div className="font-mono text-[10px] uppercase tracking-[2px] text-[var(--d-brick-lo)]">Insurance</div><h1 className="mt-1 text-3xl font-bold tracking-tight">Certificate queue</h1></div>
          <div className="flex gap-2">{['pending', 'verified', 'rejected', 'all'].map(s => <Button key={s} size="sm" variant={s === status ? 'default' : 'outline'} onClick={() => setStatus(s)} className="capitalize">{s}</Button>)}<Button asChild size="sm" variant="ghost"><Link href="/admin/buildings">Buildings</Link></Button></div>
        </div>
        <div className="mt-6 space-y-4">
          {!list ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : list.length === 0 ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nothing here.</CardContent></Card> : list.map(c => <Review key={c.id} c={c} onDone={() => load()} />)}
        </div>
      </div>
    </>
  );
}

function Review({ c, onDone }) {
  const [f, setF] = useState({ glLimit: c.glLimit || '', autoLimit: c.autoLimit || '', elLimit: c.elLimit || '', wcPresent: !!c.wcPresent, expiresOn: c.expiresOn, effectiveOn: c.effectiveOn || '', additionalInsured: (c.additionalInsured || []).join('\n'), certHolderText: c.certHolderText || '' });
  const [note, setNote] = useState('');
  async function open() {
    const r = await fetch(`/api/projects/${c.project.id}/cois/${c.id}/file`);
    const d = await r.json();
    if (r.ok) window.open(d.url, '_blank', 'noopener'); else toast.error(d.error || 'Not available');
  }
  async function decide(status) {
    const r = await fetch(`/api/admin/cois/${c.id}/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, note, corrections: { ...f, additionalInsured: f.additionalInsured.split('\n') } }) });
    if (r.ok) { toast.success(status === 'verified' ? 'Verified' : 'Rejected'); onDone(); } else toast.error('Could not save');
  }
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-medium">{c.holder?.company || c.holder?.name} <span className="text-xs text-muted-foreground">· {c.holder?.email}</span></div>
            <div className="text-xs text-muted-foreground">{c.project?.code} {c.project?.name}{c.building ? ` · ${c.building.name}` : ''} · submitted {new Date(c.submittedAt).toLocaleString()}</div>
          </div>
          <div className="flex items-center gap-2"><CoiChip chip={c.chip} /><Button size="sm" variant="outline" onClick={open}>Open certificate</Button></div>
        </div>
        {c.compliance && !c.compliance.ok && <div className="text-xs text-alert-ink">{c.chip.label}{c.compliance.missingAi?.length ? ` — missing AI: ${c.compliance.missingAi.join('; ')}` : ''}</div>}
        {c.requiredAi?.length > 0 && <div className="text-xs text-muted-foreground">Required AI: {c.requiredAi.join(' · ')}{c.building?.certHolderName ? ` — Holder: ${c.building.certHolderName} ${c.building.certHolderCo || ''}` : ''}</div>}
        {c.status === 'pending' && (
          <div className="grid gap-2 md:grid-cols-4">
            <label className="text-[11px] text-muted-foreground">GL ($)<Input value={f.glLimit} onChange={e => setF({ ...f, glLimit: e.target.value })} /></label>
            <label className="text-[11px] text-muted-foreground">Auto ($)<Input value={f.autoLimit} onChange={e => setF({ ...f, autoLimit: e.target.value })} /></label>
            <label className="text-[11px] text-muted-foreground">Employer's liability ($)<Input value={f.elLimit} onChange={e => setF({ ...f, elLimit: e.target.value })} /></label>
            <label className="flex items-center gap-2 pt-4 text-sm"><input type="checkbox" checked={f.wcPresent} onChange={e => setF({ ...f, wcPresent: e.target.checked })} /> WC</label>
            <label className="text-[11px] text-muted-foreground">Effective<Input type="date" value={f.effectiveOn} onChange={e => setF({ ...f, effectiveOn: e.target.value })} /></label>
            <label className="text-[11px] text-muted-foreground">Expires<Input type="date" value={f.expiresOn} onChange={e => setF({ ...f, expiresOn: e.target.value })} /></label>
            <label className="text-[11px] text-muted-foreground md:col-span-2">Certificate holder as printed<Input value={f.certHolderText} onChange={e => setF({ ...f, certHolderText: e.target.value })} /></label>
            <label className="text-[11px] text-muted-foreground md:col-span-4">Additional insured as printed (one per line)<Textarea rows={3} value={f.additionalInsured} onChange={e => setF({ ...f, additionalInsured: e.target.value })} /></label>
            <Input placeholder="Note to the trade (optional)" value={note} onChange={e => setNote(e.target.value)} className="md:col-span-2" />
            <div className="flex gap-2 md:col-span-2"><Button size="sm" onClick={() => decide('verified')}>Verify</Button><Button size="sm" variant="outline" onClick={() => decide('rejected')}>Reject</Button></div>
          </div>
        )}
        {c.status !== 'pending' && <div className="text-xs text-muted-foreground">GL {formatMoney(c.glLimit, { cents: false })} · expires {c.expiresOn}{c.reviewNote ? ` · note: ${c.reviewNote}` : ''}</div>}
      </CardContent>
    </Card>
  );
}
