'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import SiteNav from '@/components/site-nav';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Login failed'); setLoading(false); return; }
      toast.success(`Welcome back, ${data.user.name || data.user.email}`);
      router.push('/dashboard');
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
          <div className="mb-6 text-center">
            <div className="text-xs font-semibold uppercase tracking-widest text-primary">Welcome back</div>
            <h1 className="mt-2 text-2xl font-bold">Sign in to Boro & Nest</h1>
            <p className="mt-2 text-sm text-muted-foreground">Enter the email associated with your account.</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" className="mt-1.5" />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…</> : 'Sign in'}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            No account yet? <Link href="/join" className="text-primary hover:underline">Apply here</Link>
          </div>
        </div>
      </div>
    </>
  );
}
