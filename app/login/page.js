'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import SiteNav from '@/components/site-nav';
import { Loader2, MailCheck, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

// AUTH_PASSWORD_SPEC_1.md §5 — one email field, then: password is the
// primary action when the account has one, the emailed link is always the
// secondary option, and "Forgot password" only shows up after a failed
// password attempt, so it never confuses someone who has never set one.
function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sentLink, setSentLink] = useState(false);
  const [failedOnce, setFailedOnce] = useState(false);
  const [pendingTotp, setPendingTotp] = useState(null); // { pendingToken }
  const [totpCode, setTotpCode] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/dashboard';

  async function signInWithPassword(e) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, next })
      });
      const data = await res.json().catch(() => ({}));
      setLoading(false);
      if (!res.ok) { toast.error(data.error || 'Sign-in failed'); setFailedOnce(true); return; }
      if (data.totpRequired) { setPendingTotp({ pendingToken: data.pendingToken }); return; }
      toast.success(`Welcome back, ${data.user.name || data.user.email}`);
      router.push(data.redirect || '/dashboard');
    } catch {
      setLoading(false);
      toast.error('Network error');
    }
  }

  async function verifyTotp(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login/totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingToken: pendingTotp.pendingToken, code: totpCode, next })
      });
      const data = await res.json().catch(() => ({}));
      setLoading(false);
      if (!res.ok) { toast.error(data.error || 'Invalid code'); setTotpCode(''); return; }
      router.push(data.redirect || '/admin');
    } catch {
      setLoading(false);
      toast.error('Network error');
    }
  }

  async function emailMeALink() {
    if (!email) { toast.error('Enter your email first'); return; }
    setLoading(true);
    try {
      await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, next })
      });
      setLoading(false);
      setSentLink(true);
    } catch {
      setLoading(false);
      toast.error('Network error');
    }
  }

  if (pendingTotp) {
    return (
      <>
        <SiteNav />
        <div className="container flex min-h-[calc(100vh-4rem)] items-center justify-center py-12">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/15"><ShieldCheck className="h-6 w-6 text-primary" /></div>
            <h1 className="mt-4 text-center text-2xl font-bold">Enter your code</h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">Open your authenticator app and enter the current 6-digit code.</p>
            <form onSubmit={verifyTotp} className="mt-6 space-y-4">
              <Input
                inputMode="numeric" autoComplete="one-time-code" required maxLength={6} autoFocus
                value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))}
                className="text-center text-lg tracking-[0.3em]"
              />
              <Button type="submit" className="w-full" size="lg" disabled={loading || totpCode.length !== 6}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…</> : 'Continue'}
              </Button>
            </form>
            <Button variant="ghost" className="mt-4 w-full" onClick={() => { setPendingTotp(null); setTotpCode(''); }}>Start over</Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SiteNav />
      <div className="container flex min-h-[calc(100vh-4rem)] items-center justify-center py-12">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl">
          {sentLink ? (
            <div className="text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/15"><MailCheck className="h-6 w-6 text-primary" /></div>
              <h1 className="mt-4 text-2xl font-bold">Check your email</h1>
              <p className="mt-2 text-sm text-muted-foreground">If an account exists for <strong className="text-foreground">{email}</strong>, we sent a one-time sign-in link. It expires in 15 minutes.</p>
              <Button variant="ghost" className="mt-6" onClick={() => setSentLink(false)}>Use a different email</Button>
            </div>
          ) : (
            <>
              <div className="mb-6 text-center">
                <h1 className="text-2xl font-bold">Sign in to Boro &amp; Nest</h1>
                <p className="mt-2 text-sm text-muted-foreground">Your password if you've set one, or we'll email you a link.</p>
              </div>
              <form onSubmit={signInWithPassword} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1.5" />
                  {failedOnce && (
                    <div className="mt-1.5 text-right">
                      <Link href="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
                    </div>
                  )}
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={loading || !password}>
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…</> : 'Continue with password'}
                </Button>
              </form>
              <Button type="button" variant="outline" className="mt-3 w-full" disabled={loading} onClick={emailMeALink}>
                Email me a sign-in link instead
              </Button>
              <div className="mt-6 flex flex-col items-center gap-2 text-sm text-muted-foreground">
                <div>No account yet? <Link href="/join" className="text-primary hover:underline">Apply here</Link></div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
