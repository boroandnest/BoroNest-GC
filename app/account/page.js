'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SiteNav from '@/components/site-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, KeyRound } from 'lucide-react';

export default function AccountPage() {
  return (
    <Suspense fallback={null}>
      <Account />
    </Suspense>
  );
}

function Account() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const wantsTotpSetup = searchParams.get('setup') === 'totp';
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => {
      if (!d?.user) { router.replace('/login?next=/account'); return; }
      setUser(d.user);
    }).catch(() => router.replace('/login'));
  }, [router]);

  if (!user) return <><SiteNav /><div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></>;

  return (
    <>
      <SiteNav />
      <div className="container max-w-xl py-10">
        <h1 className="text-2xl font-bold">Account &amp; security</h1>
        <p className="mt-1 text-sm text-muted-foreground">{user.name || user.email}</p>

        {wantsTotpSetup && user.isStaff && !user.totpEnabled && (
          <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
            Set up two-factor authentication below to continue to the PM Console — staff accounts require it.
          </div>
        )}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4" /> Password</CardTitle>
            <CardDescription>{user.hasPassword ? 'Change your password.' : "You've only ever signed in with an emailed link. Set a password to sign in faster next time."}</CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordForm hasPassword={user.hasPassword} onChanged={() => setUser(u => ({ ...u, hasPassword: true }))} />
          </CardContent>
        </Card>

        {user.isStaff && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" /> Two-factor authentication</CardTitle>
              <CardDescription>Required for staff accounts. Uses any TOTP authenticator app (Google Authenticator, 1Password, Authy…).</CardDescription>
            </CardHeader>
            <CardContent>
              {user.totpEnabled ? (
                <p className="text-sm text-muted-foreground">Enabled. Every sign-in asks for a code from your authenticator app.</p>
              ) : (
                <TotpSetup onEnabled={() => { setUser(u => ({ ...u, totpEnabled: true })); toast.success('Two-factor authentication is on.'); }} />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

function PasswordForm({ hasPassword, onChanged }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const res = await fetch('/api/auth/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(data.error || 'Could not save'); return; }
    setCurrentPassword('');
    setNewPassword('');
    toast.success(hasPassword ? 'Password changed. Other devices were signed out.' : 'Password set.');
    onChanged?.();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {hasPassword && (
        <div>
          <Label htmlFor="currentPassword">Current password</Label>
          <Input id="currentPassword" type="password" autoComplete="current-password" required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="mt-1.5" />
        </div>
      )}
      <div>
        <Label htmlFor="newPassword">{hasPassword ? 'New password' : 'Password'}</Label>
        <Input id="newPassword" type="password" autoComplete="new-password" required minLength={12} value={newPassword} onChange={e => setNewPassword(e.target.value)} className="mt-1.5" />
        <p className="mt-1 text-xs text-muted-foreground">At least 12 characters. Length matters more than symbols.</p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={saving}>{saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : (hasPassword ? 'Change password' : 'Set password')}</Button>
    </form>
  );
}

function TotpSetup({ onEnabled }) {
  const [setup, setSetup] = useState(null); // { secret, otpauthUrl }
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function start() {
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/totp/setup', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) { setError(data.error || 'Could not start setup'); return; }
    setSetup(data);
  }

  async function verify(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/totp/verify-setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) { setError(data.error || 'Invalid code'); return; }
    onEnabled?.();
  }

  if (!setup) {
    return (
      <>
        <Button onClick={start} disabled={loading}>{loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting…</> : 'Set up two-factor authentication'}</Button>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </>
    );
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      <div>
        <p className="text-sm">Add this to your authenticator app, then enter the 6-digit code it shows.</p>
        <div className="mt-2 break-all rounded-md bg-muted p-3 font-mono text-xs">{setup.secret}</div>
        <p className="mt-1 text-xs text-muted-foreground">Manual entry key — most apps also take the otpauth:// link directly if you paste it into a QR generator of your choosing.</p>
      </div>
      <div>
        <Label htmlFor="totpCode">6-digit code</Label>
        <Input id="totpCode" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} className="mt-1.5 max-w-[12ch]" />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={loading || code.length !== 6}>{loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…</> : 'Verify & enable'}</Button>
    </form>
  );
}
