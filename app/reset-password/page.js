'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SiteNav from '@/components/site-nav';
import { Loader2 } from 'lucide-react';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPassword />
    </Suspense>
  );
}

function ResetPassword() {
  const router = useRouter();
  const token = useSearchParams().get('token') || '';
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword })
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) { setError(data.error || 'Could not reset password'); return; }
    router.push('/login');
  }

  return (
    <>
      <SiteNav />
      <div className="container flex min-h-[calc(100vh-4rem)] items-center justify-center py-12">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl">
          <h1 className="text-2xl font-bold">Set a new password</h1>
          {!token ? (
            <>
              <p className="mt-2 text-sm text-muted-foreground">This link is missing its token.</p>
              <Button asChild className="mt-6 w-full"><Link href="/forgot-password">Request a new link</Link></Button>
            </>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="newPassword">New password</Label>
                <Input id="newPassword" type="password" autoComplete="new-password" required minLength={12} value={newPassword} onChange={e => setNewPassword(e.target.value)} className="mt-1.5" />
                <p className="mt-1 text-xs text-muted-foreground">At least 12 characters.</p>
              </div>
              {error && (
                <div className="text-sm text-destructive">
                  {error}
                  {/* A used/expired token has no recovery except asking again. */}
                  {/This link has expired/i.test(error) && <> <Link href="/forgot-password" className="underline">Request a new one</Link>.</>}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>{loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : 'Set password'}</Button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
