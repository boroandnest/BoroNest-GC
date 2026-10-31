'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SiteNav from '@/components/site-nav';
import { Loader2, MailCheck } from 'lucide-react';

// AUTH_PASSWORD_SPEC_1.md §3: the reset page must not reveal whether the
// address exists — the success state below shows unconditionally, whether
// or not /api/auth/forgot-password actually found an account.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    }).catch(() => {});
    setLoading(false);
    setSent(true);
  }

  return (
    <>
      <SiteNav />
      <div className="container flex min-h-[calc(100vh-4rem)] items-center justify-center py-12">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl">
          {sent ? (
            <div className="text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/15"><MailCheck className="h-6 w-6 text-primary" /></div>
              <h1 className="mt-4 text-2xl font-bold">Check your email</h1>
              <p className="mt-2 text-sm text-muted-foreground">If an account exists for <strong className="text-foreground">{email}</strong>, we sent a password reset link. It expires in 30 minutes.</p>
              <Button asChild variant="ghost" className="mt-6"><Link href="/login">Back to sign in</Link></Button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold">Reset your password</h1>
              <p className="mt-2 text-sm text-muted-foreground">Enter your email and we'll send a reset link if an account exists.</p>
              <form onSubmit={submit} className="mt-6 space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1.5" />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>{loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…</> : 'Send reset link'}</Button>
              </form>
              <div className="mt-6 text-center text-sm text-muted-foreground"><Link href="/login" className="text-primary hover:underline">Back to sign in</Link></div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
