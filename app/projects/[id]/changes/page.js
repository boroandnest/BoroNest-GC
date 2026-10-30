'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import SiteNav from '@/components/site-nav';
import CoStatus from '@/components/co-status';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { formatMoney } from '@/lib/format';

// Change orders, as this viewer is allowed to see them. The server decides what each role
// receives (lib/co/project.js) — fields that are absent here were never sent.
export default function ChangesPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch(`/api/projects/${id}/changes`).then(async r => {
      if (r.status === 401) { router.replace(`/login?next=/projects/${id}/changes`); return; }
      if (!r.ok) { router.replace('/dashboard'); return; }
      setData(await r.json());
    });
  }, [id, router]);

  if (!data) return <><SiteNav /><div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></>;
  const { changeOrders, canCreate } = data;

  return (
    <>
      <SiteNav />
      <div className="container max-w-4xl py-8">
        <Link href={`/projects/${id}`} className="text-sm text-muted-foreground hover:text-foreground">← Project</Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[2px] text-[var(--d-brick-lo)]">Changes</div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Change orders</h1>
            <p className="mt-1 text-sm text-muted-foreground">Nothing outside the agreed scope starts until the change is signed.</p>
          </div>
          {canCreate && <Button asChild><Link href={`/admin/projects/${id}/changes/new`}>New change order</Link></Button>}
        </div>
        <div className="mt-6 space-y-3">
          {changeOrders.length === 0 && <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No change orders for you on this project.</CardContent></Card>}
          {changeOrders.map(co => (
            <Link key={co.id} href={`/projects/${id}/changes/${co.id}`} className="block rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/60">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><span className="font-mono text-[10px] uppercase tracking-[2px] text-muted-foreground">{co.code}</span><CoStatus status={co.status} /></div>
                  <div className="mt-1 font-medium">{co.title}</div>
                  {co.reasonText && <div className="mt-0.5 text-sm text-muted-foreground">{co.reasonText}</div>}
                  {co.scheduleImpactDays ? <div className="mt-0.5 text-xs text-muted-foreground">Schedule impact: {co.scheduleImpactDays} working day{co.scheduleImpactDays === 1 ? '' : 's'}</div> : null}
                  {co.affectsPermit && <div className="mt-0.5 text-xs text-muted-foreground">Affects permit filings</div>}
                </div>
                {co.costDelta !== undefined && <div className="shrink-0 text-right font-mono text-lg">{formatMoney(co.costDelta)}</div>}
              </div>
              {co.canSign && <div className="mt-3 font-mono text-[10px] uppercase tracking-[2px] text-sand-ink">Review and sign →</div>}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
