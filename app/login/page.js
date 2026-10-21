'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import SiteNav from '@/components/site-nav';
import { Loader2, MailCheck, KeyRound } from 'lucide-react';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [staffMode, setStaffMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/dashboard';

  async function submit(e) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(staffMode ? { email, password, next } : { email, next })
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Sign-in failed'); setLoading(false); return; }
      if (staffMode) {
        toast.success(`Welcome back, ${data.user.name || data.user.email}`);
        router.push(data.redirect || '/admin');
        return;
      }
      setSent({ devLink: data.devLink, emailConfigured: data.emailConfigured });
      setLoading(false);
    } catch (e) {
      toast.error('Network error');
      setLoading(false);
    }
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
              <p className="mt-2 text-sm text-muted-foreground">If an account exists for <strong className="text-foreground">{email}</strong>, we sent a one-time sign-in link. It expires in 15 minutes.</p>
              {sent.emailConfigured === false && !sent.devLink && (
                <p className="mt-3 text-xs text-muted-foreground">Email delivery is not configured on this server yet — contact Boro &amp; Nest to finish signing in.</p>
              )}
              {sent.devLink && (
                <a href={sent.devLink} className="mt-4 inline-block text-xs text-primary underline">Dev only: open sign-in link</a>
              )}
              <Button variant="ghost" className="mt-6" onClick={() => setSent(null)}>Use a different email</Button>
            </div>
          ) : (
            <>
              <div className="mb-6 text-center">
                <div className="text-xs font-semibold uppercase tracking-widest text-primary">{staffMode ? 'Boro & Nest staff' : 'Welcome back'}</div>
                <h1 className="mt-2 text-2xl font-bold">Sign in to Boro &amp; Nest</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {staffMode ? 'Sign in with your staff email and password.' : "Enter your email and we'll send you a secure sign-in link."}
                </p>
              </div>
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" className="mt-1.5" />
                </div>
                {staffMode && (
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-1.5" />
                  </div>
                )}
                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {staffMode ? 'Signing in…' : 'Sending link…'}</> : (staffMode ? 'Sign in' : 'Email me a sign-in link')}
                </Button>
              </form>
              <div className="mt-6 flex flex-col items-center gap-2 text-sm text-muted-foreground">
                <div>No account yet? <Link href="/join" className="text-primary hover:underline">Apply here</Link></div>
                <button type="button" onClick={() => { setStaffMode(v => !v); setPassword(''); }} className="inline-flex items-center gap-1 text-xs hover:text-foreground">
                  <KeyRound className="h-3 w-3" /> {staffMode ? 'Not staff? Sign in with an email link' : 'Staff sign-in'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
