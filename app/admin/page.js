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
import { Loader2, Plus, ArrowRight } from 'lucide-react';
import { ROLE_LABELS } from '@/lib/api-helpers';
import { formatMoney } from '@/lib/format';
import Pill from '@/components/brand/pill';
import { Figure, SectionLabel } from '@/components/brand/stat';

const BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];

// Everything a staff user can reach. One list so a new area is added once.
const AREAS = [
  { href: '/admin/templates', label: 'Scope templates', note: 'Parametric templates and tasks' },
  { href: '/admin/insurance', label: 'Insurance queue', note: 'Verify certificates against building requirements' },
  { href: '/admin/buildings', label: 'Buildings', note: 'Requirements, unit counts, violation registers' }
];

// The console renders figures; it never computes them. Every number below
// arrives from /api/admin/console as a string the server already rounded.
export default function AdminPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
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
    const [kRes, pRes, uRes, cRes] = await Promise.all([
      fetch('/api/admin/console'),
      fetch('/api/projects'),
      fetch('/api/admin/users?status=pending'),
      fetch('/api/admin/scoping-calls')
    ]);
    if (kRes.ok) setData(await kRes.json());
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

  const t = data?.totals;
  const byId = new Map((data?.projects || []).map(p => [p.id, p]));

  return (
    <>
      <SiteNav />
      <div className="container py-8">
        <div className="mb-8">
          <SectionLabel className="text-forest">Internal</SectionLabel>
          <h1 className="mt-2 text-3xl tracking-tight">PM Console</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything across every project. {data
              ? (data.problemCount || data.warnCount)
                ? <>{data.problemCount} needing action, {data.warnCount} to watch.</>
                : <>Nothing needs action right now.</>
              : null}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {AREAS.map(a => <Button key={a.href} asChild size="sm" variant="outline"><Link href={a.href}>{a.label}</Link></Button>)}
          </div>
        </div>

        {data && <Attention items={data.attention} />}

        {t && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Projects" value={t.activeProjects} />
            <Tile label="GMP under management" value={formatMoney(t.gmpUnderManagement, { cents: false })} />
            <Tile label="Contingency remaining" value={formatMoney(t.contingencyRemaining, { cents: false })} />
            <Tile label="Buildings" value={t.buildings} />
            <Tile label="Open violations" value={t.openViolations}
              foot={t.awaitingClosure ? `${t.awaitingClosure} awaiting HPD closure` : null} />
            <Tile label="Certificates expiring" value={t.coisExpiring}
              tone={t.coisExpired ? 'problem' : t.coisExpiring ? 'warn' : null}
              foot={t.coisExpired ? `${t.coisExpired} not compliant` : null} />
            <Tile label="Milestones awaiting" value={t.milestonesAwaiting}
              tone={t.milestonesFailed || t.milestonesDisputed ? 'problem' : null}
              foot={t.milestonesFailed || t.milestonesDisputed ? `${t.milestonesFailed} failed · ${t.milestonesDisputed} disputed` : null} />
            <Tile label="Accounts to approve" value={t.pendingUsers} tone={t.pendingUsers ? 'warn' : null}
              foot={t.scopingCalls ? `${t.scopingCalls} scoping calls on file` : null} />
          </div>
        )}

        <Card className="mt-8">
          <CardHeader><CardTitle className="text-base">Projects</CardTitle><CardDescription>Ceiling and contingency as the server computes them.</CardDescription></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2"><SectionLabel>Code</SectionLabel></th>
                  <th className="pb-2"><SectionLabel>Project</SectionLabel></th>
                  <th className="pb-2"><SectionLabel>Phase</SectionLabel></th>
                  <th className="pb-2 text-right"><SectionLabel>Ceiling</SectionLabel></th>
                  <th className="pb-2 text-right"><SectionLabel>Contingency</SectionLabel></th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {projects.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No projects yet.</td></tr>}
                {projects.map(p => {
                  const f = byId.get(p.id);
                  return (
                    <tr key={p.id} className="border-b border-border/40 last:border-0">
                      <td className="py-3 data-mono text-xs text-muted-foreground">{p.code || (p.publicDemo ? 'DEMO' : '—')}</td>
                      <td className="py-3">
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.clientEmail || 'No client invited'}</div>
                      </td>
                      <td className="py-3">{p.phase ? <Pill tone="neutral">{p.phase}</Pill> : '—'}</td>
                      <td className="py-3 text-right data-mono">{f ? formatMoney(f.adjustedCeiling, { cents: false }) : '—'}</td>
                      <td className="py-3 text-right">
                        {!f ? '—' : !f.contingencyConfigured ? (
                          // No reserve on file is unknown, not exhausted. Painting
                          // 0.00% in --alert here would be the same false alarm the
                          // attention list deliberately suppresses.
                          <Pill tone="neutral">Not set</Pill>
                        ) : (
                          <span className="inline-flex items-center gap-2">
                            <span className="data-mono">{formatMoney(f.contingencyRemaining, { cents: false })}</span>
                            <Pill tone={f.band === 'alert' ? 'problem' : f.band === 'sand' ? 'warn' : 'ok'}>{f.pctRemaining}%</Pill>
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <Button asChild size="sm" variant="ghost"><Link href={`/admin/projects/${p.id}/estimate`}>Estimate</Link></Button>
                        <Button asChild size="sm" variant="ghost"><Link href={`/admin/projects/${p.id}/milestones`}>Milestones</Link></Button>
                        <Button asChild size="sm" variant="ghost"><Link href={`/projects/${p.id}`}>Open <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Pending verification</CardTitle><CardDescription>Expediters and subcontractors wait here until approved.</CardDescription></CardHeader>
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
            <CardHeader><CardTitle className="text-base">Create project</CardTitle><CardDescription>Add scope lines and invite parties from the project page.</CardDescription></CardHeader>
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
                <Button type="submit" disabled={creating} className="w-full">{creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Create project</Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Scoping call requests</CardTitle><CardDescription>Leads from the site. There is no handled flag yet, so these are listed rather than chased.</CardDescription></CardHeader>
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

// The attention list. Severity is decided server-side in lib/admin/console.js —
// this only renders it, so the screen cannot invent an --alert of its own.
function Attention({ items }) {
  if (!items?.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <SectionLabel>Needs you</SectionLabel>
        <div className="mt-2 text-sm text-muted-foreground">Nothing is overdue, expiring or failed. Certificates, payments and violation density are all within limits.</div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-5 py-4"><SectionLabel>Needs you</SectionLabel></div>
      <ul>
        {items.map(a => (
          <li key={a.id} className="flex items-start gap-4 border-b border-border/40 px-5 py-3.5 last:border-0">
            <Pill tone={a.severity === 'problem' ? 'problem' : 'warn'} className="mt-0.5 shrink-0">
              {a.severity === 'problem' ? 'Action' : 'Watch'}
            </Pill>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{a.title}</div>
              <div className="text-xs text-muted-foreground">{a.detail}</div>
            </div>
            <Button asChild size="sm" variant="ghost" className="shrink-0"><Link href={a.href}>Open <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Tile({ label, value, foot, tone }) {
  const ink = tone === 'problem' ? 'text-alert-ink' : tone === 'warn' ? 'text-sand-ink' : '';
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <SectionLabel>{label}</SectionLabel>
      <Figure size="lg" className={`mt-1.5 ${ink}`}>{value}</Figure>
      {foot && <div className="mt-1 text-xs text-muted-foreground">{foot}</div>}
    </div>
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
      <CardHeader><CardTitle className="text-base">Change password</CardTitle><CardDescription>Signs out every other session.</CardDescription></CardHeader>
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
