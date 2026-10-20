'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import SiteNav from '@/components/site-nav';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';
import { Loader2, ArrowRight, Building2, Calendar, DollarSign, FileText, Hammer, ShieldCheck, AlertTriangle, TrendingUp, Users, MapPin, Wrench, Clock3, ClipboardCheck, MessageSquare, Mail } from 'lucide-react';
import { ROLE_LABELS } from '@/lib/api-helpers';

const PHASE_COLORS = {
  'Discovery': 'bg-blue-500/15 text-blue-400',
  'Design': 'bg-purple-500/15 text-purple-400',
  'Permitting': 'bg-yellow-500/15 text-yellow-400',
  'Procurement': 'bg-orange-500/15 text-orange-400',
  'Construction': 'bg-primary/15 text-primary',
  'Punch List': 'bg-green-500/15 text-green-400',
  'Close-Out': 'bg-emerald-500/15 text-emerald-400'
};

export default function RoleDashboard() {
  const params = useParams();
  const router = useRouter();
  const role = params.role;
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const meRes = await fetch('/api/auth/me');
    if (!meRes.ok) { router.replace(`/login?next=/dashboard/${role}`); return; }
    const { user: u } = await meRes.json();
    if (u.isStaff) { router.replace('/admin'); return; }
    if (u.status === 'pending') { router.replace('/pending'); return; }
    if (u.role !== role) { router.replace(`/dashboard/${u.role}`); return; }
    setUser(u);
    const [pRes, iRes] = await Promise.all([fetch('/api/projects'), fetch('/api/invitations')]);
    const { projects: pl = [] } = pRes.ok ? await pRes.json() : {};
    const { invitations: il = [] } = iRes.ok ? await iRes.json() : {};
    setProjects(pl);
    setInvitations(il.filter(i => i.status === 'pending'));
    setLoading(false);
  }

  useEffect(() => { refresh(); }, [role]);

  async function respondInvite(id, action) {
    const res = await fetch(`/api/invitations/${id}/${action}`, { method: 'POST' });
    if (res.ok) refresh();
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalGmp = projects.reduce((a, p) => a + (p.gmpCeiling || 0), 0);
  const totalSpend = projects.reduce((a, p) => a + (p.actualSpend || 0), 0);
  const avgProgress = projects.length ? Math.round(projects.reduce((a, p) => a + (p.percentComplete || 0), 0) / projects.length) : 0;

  return (
    <>
      <SiteNav />
      <div className="container py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-primary">{ROLE_LABELS[role]} Dashboard</div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Welcome, {user.name || user.email.split('@')[0]}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{user.company || 'Boro & Nest workspace'}</p>
          </div>
          <RoleActions role={role} user={user} />
        </motion.div>

        {invitations.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 space-y-2">
            {invitations.map(inv => (
              <div key={inv.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 p-4">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground"><Mail className="h-4 w-4" /></div>
                <div className="flex-1 min-w-[200px]">
                  <div className="text-sm"><strong>{inv.invitedByName}</strong> invited you to <strong>{inv.projectName}</strong> as <span className="text-primary">{inv.role}</span></div>
                  {inv.message && <div className="text-xs text-muted-foreground italic mt-0.5">"{inv.message}"</div>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => respondInvite(inv.id, 'decline')}>Decline</Button>
                  <Button size="sm" onClick={() => respondInvite(inv.id, 'accept')}>Accept</Button>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Role-specific view */}
        {role === 'client' && <ClientView projects={projects} user={user} />}
        {role === 'management' && <ManagementView projects={projects} user={user} totalGmp={totalGmp} totalSpend={totalSpend} avgProgress={avgProgress} />}
        {role === 'building-rep' && <BuildingRepView projects={projects} user={user} />}
        {role === 'expediter' && <ExpediterView projects={projects} user={user} />}
        {role === 'subcontractor' && <SubcontractorView projects={projects} user={user} />}
      </div>
    </>
  );
}

function RoleActions({ role, user }) {
  if (role === 'client') return (
    <div className="flex gap-2">
      <Button asChild variant="outline"><Link href="/book-call"><Calendar className="mr-2 h-4 w-4" /> Book Call</Link></Button>
      <Button asChild><Link href="/join/client">Edit Profile</Link></Button>
    </div>
  );
  return <Button asChild variant="outline"><Link href={`/join/${role}`}>Edit Profile</Link></Button>;
}

function StatCard({ icon: Icon, label, value, sub, tone = 'default' }) {
  const tones = { default: 'text-foreground', primary: 'text-primary', danger: 'text-red-400', success: 'text-emerald-400' };
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
          <Icon className={`h-4 w-4 ${tones[tone]}`} />
        </div>
        <div className={`mt-2 text-2xl font-bold tracking-tight ${tones[tone]}`}>{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function PhaseBadge({ phase }) {
  const cls = PHASE_COLORS[phase] || 'bg-muted';
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>{phase}</span>;
}

function ProjectCard({ p, showParty = 'pm' }) {
  return (
    <Link href={`/projects/${p.id}`} className="group block rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/60">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold">{p.name}</div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> {p.address}</div>
        </div>
        <PhaseBadge phase={p.phase} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
        {p.gmpCeiling !== undefined ? (
          <>
            <div><div className="text-muted-foreground">GMP</div><div className="font-semibold">${((p.gmpCeiling || 0) / 1000).toFixed(0)}K</div></div>
            <div><div className="text-muted-foreground">Spent</div><div className="font-semibold">${((p.actualSpend || 0) / 1000).toFixed(0)}K</div></div>
          </>
        ) : (
          <div className="col-span-2"><div className="text-muted-foreground">Code</div><div className="font-semibold">{p.code || '—'}</div></div>
        )}
        <div><div className="text-muted-foreground">{showParty === 'pm' ? 'PM' : 'Type'}</div><div className="truncate font-semibold">{showParty === 'pm' ? p.pmName : p.type}</div></div>
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-xs text-muted-foreground"><span>Progress</span><span>{p.percentComplete}%</span></div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${p.percentComplete}%` }} />
        </div>
      </div>
      <div className="mt-4 inline-flex items-center text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition">Open project <ArrowRight className="ml-1 h-3 w-3" /></div>
    </Link>
  );
}

// ============ CLIENT VIEW ============
function ClientView({ projects, user }) {
  const primary = projects[0]; // demo: show first project as active
  const otherProjects = projects.slice(1);

  return (
    <div className="space-y-8">
      {primary && (
        <Card className="overflow-hidden">
          <div className="border-b border-border bg-gradient-to-r from-primary/10 to-transparent p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-widest text-primary">Active Project</span>
                  <PhaseBadge phase={primary.phase} />
                </div>
                <h2 className="mt-2 text-2xl font-bold tracking-tight">{primary.name}</h2>
                <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {primary.address}</div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">GMP Ceiling</div>
                <div className="text-3xl font-bold text-primary">${(primary.gmpCeiling || 0).toLocaleString()}</div>
                <div className="mt-1 text-xs text-muted-foreground">Actual: ${(primary.actualSpend || 0).toLocaleString()} ({primary.gmpCeiling ? Math.round((primary.actualSpend || 0) / primary.gmpCeiling * 100) : 0}%)</div>
              </div>
            </div>
            <div className="mt-5">
              <div className="flex justify-between text-xs text-muted-foreground"><span>Overall progress</span><span>{primary.percentComplete}%</span></div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${primary.percentComplete}%` }} />
              </div>
            </div>
          </div>
          <CardContent className="grid gap-4 p-6 md:grid-cols-3">
            <MiniCard icon={Calendar} label="Soft Open" value={primary.softOpen || 'TBD'} />
            <MiniCard icon={Users} label="Assigned PM" value={primary.pmName} />
            <MiniCard icon={Building2} label="Type" value={`${primary.type} — ${primary.subType}`} />
            <div className="md:col-span-3 flex flex-wrap gap-2">
              <Button asChild><Link href={`/projects/${primary.id}`}>Open Project Hub <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
              <Button asChild variant="outline"><Link href={`/projects/${primary.id}?tab=messages`}><MessageSquare className="mr-2 h-4 w-4" /> Message PM</Link></Button>
              <Button asChild variant="outline"><Link href={`/projects/${primary.id}?tab=documents`}><FileText className="mr-2 h-4 w-4" /> Document Vault</Link></Button>
              <Button asChild variant="outline"><Link href={`/projects/${primary.id}?tab=photos`}>Site Photos</Link></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {otherProjects.length > 0 && (
        <div>
          <h3 className="mb-4 text-lg font-semibold">Other Projects</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {otherProjects.map(p => <ProjectCard key={p.id} p={p} />)}
          </div>
        </div>
      )}

      {projects.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary"><Building2 className="h-6 w-6" /></div>
            <div>
              <h3 className="text-lg font-semibold">No active project yet</h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">Book a scoping call and we'll return a Guaranteed Maximum Price within 5 business days.</p>
            </div>
            <Button asChild><Link href="/book-call">Book a Scoping Call</Link></Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MiniCard({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
      <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}

// ============ MANAGEMENT VIEW ============
function ManagementView({ projects, user, totalGmp, totalSpend, avgProgress }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={Building2} label="Active Projects" value={projects.length} sub="Across portfolio" tone="primary" />
        <StatCard icon={DollarSign} label="Total GMP" value={`$${(totalGmp/1000).toFixed(0)}K`} sub={`Actual: $${(totalSpend/1000).toFixed(0)}K`} />
        <StatCard icon={TrendingUp} label="Avg Progress" value={`${avgProgress}%`} sub="Weighted average" tone="success" />
        <StatCard icon={DollarSign} label="GMP Savings" value={`$${((totalGmp - totalSpend*1.35)/1000).toFixed(0)}K`} sub="Projected share" tone="success" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Portfolio Projects</CardTitle><CardDescription>Filter by borough or building coming soon.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {projects.map(p => <ProjectCard key={p.id} p={p} />)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Subcontractor Performance</CardTitle><CardDescription>Snapshot from active jobs.</CardDescription></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border"><th className="pb-2 text-left">Sub</th><th className="pb-2 text-left">Trade</th><th className="pb-2 text-left">Tier</th><th className="pb-2 text-right">Rating</th></tr>
            </thead>
            <tbody>
              {[
                ['Aster Electrical', 'Electrical', 'Platinum', 4.9],
                ['Nord Plumbing', 'Plumbing', 'Platinum', 4.8],
                ['MRK Carpentry', 'Carpentry', 'Gold', 4.5],
                ['Bristol HVAC', 'HVAC', 'Platinum', 4.9]
              ].map(([n, t, tier, r]) => (
                <tr key={n} className="border-b border-border/40 last:border-0">
                  <td className="py-3 font-medium">{n}</td>
                  <td className="py-3 text-muted-foreground">{t}</td>
                  <td className="py-3"><TierBadge tier={tier} /></td>
                  <td className="py-3 text-right">{r} ⭐</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function TierBadge({ tier }) {
  const map = { Platinum: 'bg-primary/15 text-primary', Gold: 'bg-yellow-500/15 text-yellow-400', 'Pending Review': 'bg-muted text-muted-foreground' };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${map[tier] || 'bg-muted'}`}>{tier}</span>;
}

// ============ BUILDING REP VIEW ============
function BuildingRepView({ projects, user }) {
  const inspections = [
    { id: 1, project: projects[0]?.name || 'Project A', type: 'Plumbing rough-in', date: 'Tue Sep 09, 10:00 AM', status: 'Scheduled' },
    { id: 2, project: projects[1]?.name || 'Project B', type: 'DOB Sign-off', date: 'Thu Sep 11, 2:00 PM', status: 'Pending' },
    { id: 3, project: projects[0]?.name || 'Project A', type: 'Electrical final', date: 'Mon Sep 15, 9:00 AM', status: 'Scheduled' }
  ];
  const accessRequests = [
    { id: 1, sub: 'Aster Electrical', when: 'Tomorrow 7–10am', status: 'Pending' },
    { id: 2, sub: 'Nord Plumbing', when: 'Fri 9am–noon', status: 'Approved' }
  ];
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={Building2} label="Active in Building" value={projects.length} />
        <StatCard icon={Calendar} label="Upcoming Inspections" value={inspections.length} tone="primary" />
        <StatCard icon={AlertTriangle} label="Open Violations" value="2" tone="danger" />
        <StatCard icon={ClipboardCheck} label="Access Requests" value={accessRequests.filter(a => a.status === 'Pending').length} sub="Awaiting your approval" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Inspection Calendar</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {inspections.map(ins => (
              <div key={ins.id} className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
                <div>
                  <div className="text-sm font-medium">{ins.type}</div>
                  <div className="text-xs text-muted-foreground">{ins.project} · {ins.date}</div>
                </div>
                <span className="text-xs rounded-full bg-primary/15 px-2 py-1 text-primary">{ins.status}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Access Request Queue</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {accessRequests.map(a => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
                <div>
                  <div className="text-sm font-medium">{a.sub}</div>
                  <div className="text-xs text-muted-foreground">{a.when}</div>
                </div>
                {a.status === 'Pending' ? (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">Deny</Button>
                    <Button size="sm">Approve</Button>
                  </div>
                ) : <span className="text-xs rounded-full bg-emerald-500/15 px-2 py-1 text-emerald-400">{a.status}</span>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Projects in Your Building</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map(p => <ProjectCard key={p.id} p={p} />)}
        </CardContent>
      </Card>
    </div>
  );
}

// ============ EXPEDITER VIEW ============
function ExpediterView({ projects, user }) {
  const filings = projects.map((p, i) => ({
    ...p,
    filingType: ['ALT2', 'ALT1', 'ALT2'][i % 3] || 'ALT2',
    filingStatus: ['Submitted', 'In Review', 'Approved', 'Issued'][i % 4],
    submittedDate: new Date(Date.now() - (i + 1) * 7 * 86400000).toLocaleDateString()
  }));
  const inspectionDates = [
    { project: projects[0]?.name || 'N/A', date: 'Sep 9', type: 'Plumbing rough-in' },
    { project: projects[1]?.name || 'N/A', date: 'Sep 15', type: 'Electrical final' }
  ];
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={ClipboardCheck} label="Active Filings" value={filings.length} tone="primary" />
        <StatCard icon={Clock3} label="Avg Turnaround" value="6.2 wk" sub="Last 12 months" />
        <StatCard icon={Calendar} label="Upcoming Inspections" value={inspectionDates.length} />
        <StatCard icon={DollarSign} label="Outstanding Invoices" value="$4,200" tone="danger" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Filing Status Tracker</CardTitle><CardDescription>All DOB filings across your assigned projects.</CardDescription></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="pb-2 text-left">Project</th>
                <th className="pb-2 text-left">Type</th>
                <th className="pb-2 text-left">Submitted</th>
                <th className="pb-2 text-left">Status</th>
                <th className="pb-2 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {filings.map(f => (
                <tr key={f.id} className="border-b border-border/40 last:border-0">
                  <td className="py-3 font-medium">{f.name}</td>
                  <td className="py-3 text-muted-foreground">{f.filingType}</td>
                  <td className="py-3 text-muted-foreground">{f.submittedDate}</td>
                  <td className="py-3"><FilingBadge status={f.filingStatus} /></td>
                  <td className="py-3 text-right"><Button asChild size="sm" variant="ghost"><Link href={`/projects/${f.id}`}>Open <ArrowRight className="ml-1 h-3 w-3" /></Link></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Upcoming DOB Inspections</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {inspectionDates.map((i, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
                <div>
                  <div className="text-sm font-medium">{i.type}</div>
                  <div className="text-xs text-muted-foreground">{i.project}</div>
                </div>
                <div className="text-sm font-semibold text-primary">{i.date}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Document Upload Queue</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {['Engineer drawings — Sable Med-Spa', 'Owner authorization — Lume Café', 'ALT2 form PW1 — Noho Loft'].map(d => (
              <div key={d} className="flex items-center justify-between rounded-lg border border-dashed border-border p-3 text-sm">
                <span className="text-muted-foreground">{d}</span>
                <Button size="sm" variant="outline">Upload</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FilingBadge({ status }) {
  const map = { 'Submitted': 'bg-blue-500/15 text-blue-400', 'In Review': 'bg-yellow-500/15 text-yellow-400', 'Approved': 'bg-emerald-500/15 text-emerald-400', 'Issued': 'bg-primary/15 text-primary' };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${map[status] || 'bg-muted'}`}>{status}</span>;
}

// ============ SUBCONTRACTOR VIEW ============
function SubcontractorView({ projects, user }) {
  const insurance = user.profile?.glExpiration ? new Date(user.profile.glExpiration) : null;
  const daysUntilExpire = insurance ? Math.round((insurance - new Date()) / 86400000) : null;
  const insuranceWarn = daysUntilExpire !== null && daysUntilExpire < 30;

  const jobs = projects.slice(0, 2).map((p, i) => ({
    ...p,
    milestones: [
      { name: 'Rough-in complete', status: 'complete', payment: 8500, paid: true },
      { name: 'Wall closure sign-off', status: i === 0 ? 'awaiting_confirmation' : 'in_progress', payment: 6200, paid: false },
      { name: 'Final inspection', status: 'upcoming', payment: 4300, paid: false }
    ]
  }));
  const bidInvitations = [
    { id: 1, project: 'Sable Med-Spa — Flatiron', trade: 'Electrical', deadline: 'Sep 12', bidAmount: '$18–22K est' },
    { id: 2, project: 'Noho Loft — Gut Reno', trade: 'HVAC', deadline: 'Sep 14', bidAmount: '$26–32K est' }
  ];

  return (
    <div className="space-y-6">
      {insuranceWarn && (
        <div className="flex items-center gap-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-400" />
          <div className="text-sm"><strong>Insurance expiring in {daysUntilExpire} days.</strong> Renew to keep Platinum tier and bid access.</div>
          <Button size="sm" variant="outline" className="ml-auto">Upload renewal</Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={Hammer} label="Active Jobs" value={jobs.length} tone="primary" />
        <StatCard icon={DollarSign} label="Pending Payments" value="$10,500" sub="48hr release" tone="success" />
        <StatCard icon={Users} label="Tier Status" value={user.profile?.tier || 'Platinum'} tone="primary" />
        <StatCard icon={ShieldCheck} label="Bid Invitations" value={bidInvitations.length} sub="Awaiting response" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">48-Hour Milestone Payments</CardTitle><CardDescription>Payment releases within 48 hours of PM sign-off + your confirmation.</CardDescription></CardHeader>
        <CardContent className="space-y-6">
          {jobs.map(j => (
            <div key={j.id} className="rounded-xl border border-border bg-background p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{j.name}</div>
                  <div className="text-xs text-muted-foreground">{j.address}</div>
                </div>
                <PhaseBadge phase={j.phase} />
              </div>
              <div className="mt-4 space-y-2">
                {j.milestones.map((m, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-card p-3 text-sm">
                    <div className="flex items-center gap-3">
                      <PaymentDot status={m.status} />
                      <div>
                        <div className="font-medium">{m.name}</div>
                        <div className="text-xs text-muted-foreground">{paymentLabel(m.status)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-semibold">${m.payment.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">{m.paid ? 'Paid' : m.status === 'awaiting_confirmation' ? 'Awaiting confirm' : 'Pending'}</div>
                      </div>
                      {m.status === 'awaiting_confirmation' && <Button size="sm">Confirm</Button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Bid Invitations</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {bidInvitations.map(b => (
            <div key={b.id} className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <div className="font-medium">{b.project}</div>
                <div className="text-xs text-muted-foreground">{b.trade} · {b.bidAmount} · Respond by {b.deadline}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline">Decline</Button>
                <Button size="sm">Accept & bid</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function PaymentDot({ status }) {
  const map = { complete: 'bg-emerald-400', awaiting_confirmation: 'bg-yellow-400', in_progress: 'bg-primary', upcoming: 'bg-muted', not_started: 'bg-muted' };
  return <div className={`h-2.5 w-2.5 rounded-full ${map[status] || 'bg-muted'} ${status === 'in_progress' ? 'animate-pulse' : ''}`} />;
}
function paymentLabel(s) {
  return { complete: 'Payment released', awaiting_confirmation: 'PM signed off — confirm to release', in_progress: 'Work in progress', upcoming: 'Not started' }[s] || s;
}
