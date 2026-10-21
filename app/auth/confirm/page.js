'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import SiteNav from '@/components/site-nav';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export default function ConfirmPage() {
  return (
    <Suspense fallback={null}>
      <Confirm />
    </Suspense>
  );
}

// Landing page for emailed sign-in links. The token is only redeemed when the person
// clicks Continue, so email security scanners that pre-open links can't use it up.
function Confirm() {
  const router = useRouter();
  const token = useSearchParams().get('token') || '';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function go() {
    setLoading(true);
    const res = await fetch('/api/auth/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error || 'Sign-in failed'); setLoading(false); return; }
    router.replace(d.redirect || '/dashboard');
  }

  return (
    <>
      <SiteNav />
      <div className="container flex min-h-[calc(100vh-4rem)] items-center justify-center py-12">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-xl">
          <div className="text-xs font-semibold uppercase tracking-widest text-primary">Boro &amp; Nest</div>
          <h1 className="mt-2 text-2xl font-bold">{error ? 'Link expired' : 'Finish signing in'}</h1>
          {error ? (
            <>
              <p className="mt-2 text-sm text-muted-foreground">{error}</p>
              <Button asChild className="mt-6 w-full"><Link href="/login">Request a new link</Link></Button>
            </>
          ) : (
            <Button onClick={go} disabled={loading || !token} size="lg" className="mt-6 w-full">
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…</> : 'Continue to your workspace'}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
