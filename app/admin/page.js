'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SiteNav from '@/components/site-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Plus, Users, Building2, Hammer, ArrowRight, PhoneCall } from 'lucide-react';
import { ROLE_LABELS } from '@/lib/api-helpers';

const BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];

export default function AdminPage() {
  const router = useRouter();
  const [projects, setProjects] = useState([]);
  const [pending, setPending] = useState([]);
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ type: 'Commercial', gmpCeiling: '', contingency: '' });

  async function load() {
    const me = await fetch('/api/auth/me');
    if (!me.ok) { router.replace('/login?next=/admin'); return; }
    const { user } = await me.json();
    if (!user.isStaff) { router.replace('/dashboard'); return; }
    const [pRes, uRes, cRes] = await Promise.all([
      fetch('/api/projects'),
      fetch('/api/admin/users?status=pending'),
      fetch('/api/admin/scoping-calls')
    ]);
    if (pRes.ok) setProjects((await pRes.json()).projects);
    if (uRes.ok) setPending((await uRes.json()).users);
    if (cRes.ok) setCalls((await cRes.json()).calls);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function createProject(e) {
    e.preventDefault();
    setCreating(true);
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { toast.success(`Project ${d.project.code} created`); setForm({ type: 'Commercial', gmpCeiling: '', contingency: '' }); load(); }
    else toast.error(d.error || 'Failed');
    setCreating(false);
  }

  async function setStatus(id, status) {
    const res = await fetch(`/api/admin/users/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (res.ok) { toast.success(status === 'verified' ? 'Approved' : 'Updated'); load(); }
    else toast.error('Could not update');
  }

  if (loading) return <><SiteNav /><div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></>;

  return (
    <>
      <SiteNav />
      <div className="container py-8">
        <div className="mb-8">
          <div className="text-xs font-semibold uppercase tracking-widest text-primary">Internal Admin</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">PM Console</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create projects, verify trade professionals, review scoping calls.</p>
          <div className="mt-3 flex flex-wrap gap-2"><Button asChild size="sm" variant="outline"><Link href="/admin/templates">Scope templates</Link></Button><Button asChild size="sm" variant="outline"><Link href="/admin/insurance">Insurance queue</Link></Button><Button asChild size="sm" variant="outline"><Link href="/admin/buildings">Buildings</Link></Button></div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Stat label="Projects" value={projects.length} icon={Building2} />
          <Stat label="Pending Verification" value={pending.length} icon={Hammer} alert={pending.length > 0} />
          <Stat label="Scoping Calls" value={calls.length} icon={PhoneCall} />
          <Stat label="Total GMP" value={`$${(projects.reduce((a, p) => a + (p.gmpCeiling || 0), 0) / 1000).toFixed(0)}K`} icon={Users} />
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Pending Verification</CardTitle><CardDescription>Expediters and subcontractors wait here until approved.</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {pending.length === 0 && <div className="text-sm text-muted-foreground">No applications waiting.</div>}
              {pending.map(u => (
                <div key={u.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{u.company || u.name || u.email}</div>
                      <div className="text-xs text-muted-foreground">{ROLE_LABELS[u.role] || u.role} · {u.email} · {u.phone}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {u.profile?.trades && <>Trades: {u.profile.trades} · </>}
                        {(u.profile?.license || u.profile?.licenses) && <>License: {u.profile.license || u.profile.licenses}</>}
                      </div>
                      <div className="mt-1 flex gap-3 text-xs">
                        {u.profile?.glCert && <a className="text-primary hover:underline" href={u.profile.glCert} target="_blank" rel="noopener noreferrer">GL cert</a>}
                        {u.profile?.wcCert && <a className="text-primary hover:underline" href={u.profile.wcCert} target="_blank" rel="noopener noreferrer">WC cert</a>}
                        {u.profile?.glExpiration && <span className="text-muted-foreground">GL exp {u.profile.glExpiration}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" variant="outline" onClick={() => setStatus(u.id, 'suspended')}>Reject</Button>
                      <Button size="sm" onClick={() => setStatus(u.id, 'verified')}>Approve</Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Create Project</CardTitle><CardDescription>Add scope lines and invite parties from the project page.</CardDescription></CardHeader>
            <CardContent>
              <form onSubmit={createProject} className="space-y-3">
                <div><Label className="mb-1.5 block text-sm">Name</Label><Input required value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Unit 3H Renovation" /></div>
                <div><Label className="mb-1.5 block text-sm">Address</Label><Input required value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div><Label className="mb-1.5 block text-sm">Type</Label>
                    <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{['Commercial', 'Residential', 'Compliance'].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="mb-1.5 block text-sm">Borough</Label>
                    <Select value={form.borough || ''} onValueChange={v => setForm({ ...form, borough: v })}>
                      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>{BOROUGHS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="mb-1.5 block text-sm">GMP Ceiling ($)</Label><Input required type="number" value={form.gmpCeiling} onChange={e => setForm({ ...form, gmpCeiling: e.target.value })} /></div>
                  <div><Label className="mb-1.5 block text-sm">Contingency ($)</Label><Input type="number" value={form.contingency} onChange={e => setForm({ ...form, contingency: e.target.value })} /></div>
                </div>
                <div><Label className="mb-1.5 block text-sm">Client email</Label><Input type="email" value={form.clientEmail || ''} onChange={e => setForm({ ...form, clientEmail: e.target.value })} /></div>
                <Button type="submit" disabled={creating} className="w-full">{creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Create Project</Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-8">
          <CardHeader><CardTitle className="text-base">All Projects</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground"><tr className="border-b border-border"><th className="pb-2 text-left">Code</th><th className="pb-2 text-left">Name</th><th className="pb-2 text-left">Phase</th><th className="pb-2 text-left">Client</th><th className="pb-2 text-right">GMP</th><th className="pb-2 text-right">Progress</th><th /></tr></thead>
              <tbody>
                {projects.map(p => (
                  <tr key={p.id} className="border-b border-border/40 last:border-0">
                    <td className="py-3 font-mono text-xs text-muted-foreground">{p.code || (p.publicDemo ? 'DEMO' : '—')}</td>
                    <td className="py-3 font-medium">{p.name}</td>
                    <td className="py-3 text-muted-foreground">{p.phase}</td>
                    <td className="py-3 text-muted-foreground">{p.clientEmail || '—'}</td>
                    <td className="py-3 text-right font-mono">${((p.gmpCeiling || 0) / 1000).toFixed(0)}K</td>
                    <td className="py-3 text-right">{p.percentComplete || 0}%</td>
                    <td className="py-3 text-right whitespace-nowrap"><Button asChild size="sm" variant="ghost"><Link href={`/admin/projects/${p.id}/estimate`}>Estimate</Link></Button><Button asChild size="sm" variant="ghost"><Link href={`/projects/${p.id}`}>Open <ArrowRight className="ml-1 h-3 w-3" /></Link></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Scoping Call Requests</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {calls.length === 0 && <div className="text-sm text-muted-foreground">No requests yet.</div>}
              {calls.slice(0, 20).map(c => (
                <div key={c.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="font-medium">{c.fullName} <span className="text-xs text-muted-foreground">· {new Date(c.createdAt).toLocaleDateString()}</span></div>
                  <div className="text-xs text-muted-foreground">{[c.email, c.phone, c.address, c.budget].filter(Boolean).join(' · ')}</div>
                  {c.notes && <div className="mt-1 text-xs text-muted-foreground">{c.notes}</div>}
                </div>
              ))}
            </CardContent>
          </Card>
          <ChangePassword />
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, icon: Icon, alert }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between"><span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span><Icon className="h-4 w-4 text-primary" /></div>
        <div className={`mt-2 text-3xl font-bold ${alert ? 'text-[#D4654A]' : ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function ChangePassword() {
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/auth/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) { toast.success('Password changed. Other sessions were signed out.'); setCurrent(''); setNew(''); }
    else toast.error(d.error || 'Could not change password');
  }
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Change Password</CardTitle><CardDescription>Signs out every other session.</CardDescription></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div><Label className="mb-1.5 block text-sm">Current password</Label><Input type="password" autoComplete="current-password" required value={currentPassword} onChange={e => setCurrent(e.target.value)} /></div>
          <div><Label className="mb-1.5 block text-sm">New password (10+ characters)</Label><Input type="password" autoComplete="new-password" required minLength={10} value={newPassword} onChange={e => setNew(e.target.value)} /></div>
          <Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Update password</Button>
        </form>
      </CardContent>
    </Card>
  );
}
