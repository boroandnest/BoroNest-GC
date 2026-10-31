'use client';

// Redesign Direction D §8 — console token swap. The `.d-console` class
// (app/globals.css) remaps the existing shadcn variable names to the §1
// palette; every admin component already reads those same variable names,
// so nothing here needs a new layout, new components, or marketing motion.
//
// AUTH_PASSWORD_SPEC_1.md §4 / test 6 — every /api/admin/** route already
// 403s a staff session without totpEnabled (lib/api.js requireStaff). This
// is the single choke point that sends that session somewhere useful (TOTP
// setup) instead of letting each admin page's own 401/403 handling dump it
// on /dashboard with no explanation.
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (cancelled) return;
        const user = d?.user;
        if (!user) { router.replace(`/login?next=${encodeURIComponent(pathname)}`); return; }
        if (!user.isStaff) { router.replace('/dashboard'); return; }
        if (!user.totpEnabled) { router.replace('/account?setup=totp'); return; }
        setReady(true);
      })
      .catch(() => { if (!cancelled) router.replace('/login'); });
    return () => { cancelled = true; };
  }, [pathname, router]);

  if (!ready) return <div className="d-console flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[var(--d-brick-lo)]" /></div>;
  return <div className="d-console">{children}</div>;
}
