'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SiteNav from '@/components/site-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, ShieldCheck } from 'lucide-react';

// Payout setup for trades. Bank and tax details are entered on Stripe's own pages — never here.
export default function PaymentsSetup() {
  const router = useRouter();
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/stripe/onboard').then(async r => {
      if (r.status === 401) { router.replace('/login?next=/payments/setup'); return; }
      const d = await r.json();
      if (!r.ok) { toast.error(d.error); router.replace('/dashboard'); return; }
      setS(d);
    });
  }, [router]);

  async function start() {
    setBusy(true);
    const r = await fetch('/api/stripe/onboard', { method: 'POST' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setBusy(false); toast.error(d.error || 'Could not start'); return; }
    window.location.href = d.url;
  }

  return (
    <>
      <SiteNav />
      <div className="container max-w-xl py-12">
        <div className="font-mono text-[10px] uppercase tracking-[2px] text-primary">Payments</div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Get paid by Boro &amp; Nest</h1>
        <p className="mt-2 text-sm text-muted-foreground">Milestone payments release 24 hours after a verified milestone. Payouts go through Stripe; your bank and tax details are entered on Stripe's secure pages and never stored by Boro &amp; Nest.</p>
        <Card className="mt-6">
          <CardContent className="p-6">
            {!s ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : !s.configured ? (
              <p className="text-sm text-muted-foreground">Online payouts are being set up. Boro &amp; Nest will contact you to arrange payment in the meantime.</p>
            ) : s.payoutsEnabled ? (
              <div className="flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-emerald-400" /><div><div className="font-medium">Payouts are active</div><div className="text-sm text-muted-foreground">Released milestones are transferred to your Stripe account.</div></div></div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm">{s.hasAccount ? (s.detailsSubmitted ? 'Stripe is reviewing your details. This page updates once payouts are enabled.' : 'Finish your Stripe setup to start receiving payments.') : 'Set up payouts once; every released milestone is paid automatically.'}</p>
                <Button onClick={start} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {s.hasAccount ? 'Continue with Stripe' : 'Set up payouts with Stripe'}</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
