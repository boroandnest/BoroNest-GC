'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function DashboardRedirect() {
  const router = useRouter();
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.user) { router.replace('/login?next=/dashboard'); return; }
        if (d.user.isStaff) { router.replace('/admin'); return; }
        if (d.user.status === 'pending') { router.replace('/pending'); return; }
        router.replace(`/dashboard/${d.user.role}`);
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
