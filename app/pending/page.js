'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SiteNav from '@/components/site-nav';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldCheck } from 'lucide-react';
import { ROLE_LABELS } from '@/lib/api-helpers';

export default function PendingPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d?.user) { router.replace('/login?next=/pending'); return; }
        if (d.user.status !== 'pending') { router.replace('/dashboard'); return; }
        setUser(d.user);
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  if (!user) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <>
      <SiteNav />
      <div className="container flex min-h-[60vh] items-center justify-center py-16">
        <div className="max-w-lg text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/15"><ShieldCheck className="h-8 w-8 text-primary" /></div>
          <div className="mt-6 text-xs font-semibold uppercase tracking-widest text-primary">{ROLE_LABELS[user.role] || user.role} application</div>
          <h1 className="mt-2 text-3xl font-bold">We're reviewing your application</h1>
          <p className="mt-3 text-muted-foreground">
            Boro &amp; Nest verifies licenses and insurance for every trade professional before granting project access.
            You'll get an email once you're approved — usually within two business days.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild variant="outline"><Link href={`/join/${user.role}`}>Update application</Link></Button>
            <Button asChild><Link href="/">Back to site</Link></Button>
          </div>
        </div>
      </div>
    </>
  );
}
