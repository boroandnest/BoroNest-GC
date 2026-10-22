'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import SiteNav from '@/components/site-nav';
import CoStatus from '@/components/co-status';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { formatMoney } from '@/lib/format';

// One change order in plain language, with typed-name signature for the client / management company.
export default function ChangePage() {
  const { id, coId } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [name, setName] = useState('');
  const [agree, setAgree] = useState(false);
  const [signing, setSigning] = useState(false);

  async function load() {
    const r = await fetch(`/api/projects/${id}/changes/${coId}`);
    if (r.status === 401) { router.replace(`/login?next=/projects/${id}/changes/${coId}`); return; }
    if (!r.ok) { toast.error('Change order not found'); router.replace(`/projects/${id}/changes`); return; }
    setData(await r.json());
  }
  useEffect(() => { load(); }, [id, coId]);

  async function sign(e) {
    e.preventDefault();
    setSigning(true);
    const r = await fetch(`/api/projects/${id}/changes/${coId}/sign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ signedName: name }) });
    const d = await r.json().catch(() => ({}));
    setSigning(false);
    if (!r.ok) { toast.error(d.error || 'Could not sign'); return; }
    toast.success('Signed. Work on this change can now go ahead.');
    load();
  }

  if (!data) return <><SiteNav /><div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></>;
  const { changeOrder: co, project } = data;

  return (
    <>
      <SiteNav />
      <div className="container max-w-3xl py-8">
        <Link href={`/projects/${id}/changes`} className="text-sm text-muted-foreground hover:text-foreground">← Change orders · {project.name}</Link>
        <div className="mt-4 flex items-center gap-2"><span className="font-mono text-[10px] uppercase tracking-[2px] text-muted-foreground">{project.code} · {co.code}</span><CoStatus status={co.status} /></div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{co.title}</h1>

        <Card className="mt-6">
          <CardContent className="space-y-5 p-6">
            {co.reasonText && (
              <section>
                <h2 className="font-mono text-[10px] uppercase tracking-[2px] text-muted-foreground">Why</h2>
                <p className="mt-1">{co.reasonText}.</p>
              </section>
            )}
            {co.description && (
              <section>
                <h2 className="font-mono text-[10px] uppercase tracking-[2px] text-muted-foreground">What changes</h2>
                <p className="mt-1 whitespace-pre-wrap text-sm">{co.description}</p>
              </section>
            )}
            {co.lines?.length > 0 && (
              <section>
                <h2 className="font-mono text-[10px] uppercase tracking-[2px] text-muted-foreground">Affected work</h2>
                <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
                  {co.lines.map((l, i) => (
                    <li key={i} className="flex justify-between gap-3 p-3 text-sm"><span><span className="capitalize text-muted-foreground">{l.trade}</span> · {l.title}</span>{l.costDelta !== undefined && <span className="font-mono">{formatMoney(l.costDelta)}</span>}</li>
                  ))}
                </ul>
              </section>
            )}
            <section className="grid gap-4 sm:grid-cols-3">
              {co.costDelta !== undefined && (
                <div><div className="font-mono text-[10px] uppercase tracking-[2px] text-muted-foreground">Cost</div><div className="mt-1 font-mono text-2xl">{formatMoney(co.costDelta)}</div>
                  {co.noCostToYou && <div className="text-xs text-muted-foreground">No cost to you</div>}
                  {co.againstContingency && !co.noCostToYou && <div className="text-xs text-muted-foreground">Paid from the contingency already in your GMP</div>}
                </div>
              )}
              <div><div className="font-mono text-[10px] uppercase tracking-[2px] text-muted-foreground">Schedule</div><div className="mt-1 text-sm">{co.scheduleImpactDays ? `${co.scheduleImpactDays} working day${co.scheduleImpactDays === 1 ? '' : 's'} added` : 'No change to the schedule'}</div></div>
              {co.affectsPermit !== undefined && <div><div className="font-mono text-[10px] uppercase tracking-[2px] text-muted-foreground">Permits</div><div className="mt-1 text-sm">{co.affectsPermit ? 'Needs a permit amendment' : 'No permit change'}</div></div>}
            </section>
            {co.status === 'signed' && co.signedName && <p className="text-sm text-muted-foreground">Signed by {co.signedName} on {new Date(co.signedAt).toLocaleString()}{co.signatureIp ? ` · IP ${co.signatureIp}` : ''}.</p>}
          </CardContent>
        </Card>

        {co.canSign && (
          <Card className="mt-6 border-sand">
            <CardContent className="p-6">
              <form onSubmit={sign} className="space-y-4">
                <p className="text-sm">By typing your full name you approve this change{co.costDelta !== undefined && !co.noCostToYou ? ` and its cost of ${formatMoney(co.costDelta)}` : ''}. Your name, the time and your connection's IP address are recorded.</p>
                <Input required minLength={2} placeholder="Your full name" value={name} onChange={e => setName(e.target.value)} aria-label="Full name" />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} /> I approve this change order</label>
                <Button type="submit" disabled={signing || !agree || name.trim().length < 2}>{signing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Sign change order</Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
