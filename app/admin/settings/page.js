'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SiteNav from '@/components/site-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

// Everything here is read by app/page.js (the Ledger stat tiles) or
// lib/email.js (reply-to / new-request notifications) at request time —
// saving takes effect on the live site immediately, no deploy needed.
export default function SiteSettingsPage() {
  const router = useRouter();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState('');

  async function load() {
    const r = await fetch('/api/admin/settings');
    if (r.status === 401) { router.replace('/login?next=/admin/settings'); return; }
    if (r.status === 403) { router.replace('/dashboard'); return; }
    setForm((await r.json()).settings);
  }
  useEffect(() => { load(); }, []);

  function set(key, value) { setForm(f => ({ ...f, [key]: value })); }

  async function save() {
    setSaving(true);
    setProblem('');
    const r = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    const d = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) { setProblem(d.error || 'Could not save'); return; }
    setForm(d.settings);
    toast.success('Settings saved');
  }

  if (!form) return <><SiteNav /><div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></>;

  return (
    <>
      <SiteNav />
      <div className="container max-w-2xl py-8">
        <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">← PM Console</Link>
        <div className="mt-4">
          <div className="font-mono text-[10px] uppercase tracking-[2px] text-[var(--d-brick-lo)]">Internal</div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Site settings</h1>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Homepage track record</CardTitle>
            <CardDescription>The three "Ledger" figures on the homepage. Leave as-is to keep today's copy.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="ledgerProjects">Projects delivered</Label>
              <Input id="ledgerProjects" value={form.ledgerProjects || ''} onChange={e => set('ledgerProjects', e.target.value)} placeholder="50+" maxLength={40} />
            </div>
            <div>
              <Label htmlFor="ledgerOverruns">Cost overruns (GMP) — or overage absorbed</Label>
              <Input id="ledgerOverruns" value={form.ledgerOverruns || ''} onChange={e => set('ledgerOverruns', e.target.value)} placeholder="$0" maxLength={40} />
            </div>
            <div>
              <Label htmlFor="ledgerTurnaround">Sub payment turnaround</Label>
              <Input id="ledgerTurnaround" value={form.ledgerTurnaround || ''} onChange={e => set('ledgerTurnaround', e.target.value)} placeholder="48hr" maxLength={40} />
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Email routing</CardTitle>
            <CardDescription>
              Where replies and new-request alerts go. Blank uses the server default
              (<code>RESEND_REPLY_TO</code> / <code>ADMIN_EMAIL</code> env vars). This does not change which
              address Boro &amp; Nest emails are <em>sent from</em> — that's <code>RESEND_FROM_EMAIL</code>,
              set at the hosting level once your sending domain is verified in Resend.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="replyToEmail">Reply-to address</Label>
              <Input id="replyToEmail" type="email" value={form.replyToEmail || ''} onChange={e => set('replyToEmail', e.target.value)} placeholder="jdavis@boroandnest.com" maxLength={200} />
              <p className="mt-1 text-xs text-muted-foreground">Where a client's "Reply" lands when they answer a sign-in link, invite, or COI-expiry email.</p>
            </div>
            <div>
              <Label htmlFor="adminNotifyEmail">New-request notifications</Label>
              <Input id="adminNotifyEmail" type="email" value={form.adminNotifyEmail || ''} onChange={e => set('adminNotifyEmail', e.target.value)} placeholder="jdavis@boroandnest.com" maxLength={200} />
              <p className="mt-1 text-xs text-muted-foreground">Where new scoping-call requests and failed-release alerts are sent.</p>
            </div>
          </CardContent>
        </Card>

        {problem && <p className="mt-4 text-sm text-destructive">{problem}</p>}
        <Button className="mt-6" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
      </div>
    </>
  );
}
