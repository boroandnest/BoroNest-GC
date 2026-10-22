'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import SiteNav from '@/components/site-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, MapPin, DollarSign, Users, Calendar, FileText, Camera, MessageSquare, CheckCircle2, Circle, Clock, Send, Plus, Wrench, UserPlus, Trash2, Mail, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatMoney, formatQty } from '@/lib/format';
import CoStatus from '@/components/co-status';
import DensityCard from '@/components/density-card';

const PHASES = ['Discovery', 'Design', 'Permitting', 'Procurement', 'Construction', 'Punch List', 'Close-Out'];

export default function ProjectHub() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = searchParams.get('tab') || 'overview';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(initialTab);

  async function load() {
    const res = await fetch(`/api/projects/${params.id}`);
    if (res.status === 401) { router.replace(`/login?next=/projects/${params.id}`); return; }
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error || 'Project not found'); router.push('/dashboard'); return; }
    const d = await res.json();
    setData(d);
    setLoading(false);
  }

  useEffect(() => { load(); }, [params.id]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!data) return null;

  const { project: p, milestones, documents, messages, photos, changeOrders, parties = [], isStaff, isOwner, canSeePricing, viewerRole, financials } = data;

  async function setPhase(phase) {
    const res = await fetch(`/api/projects/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phase }) });
    if (res.ok) { toast.success(`Phase set to ${phase}`); load(); } else toast.error('Could not update phase');
  }
  async function disputeMilestone(mid) {
    const reason = prompt('What is wrong with this milestone? Payment is paused while we look at it.');
    if (reason === null) return;
    const res = await fetch(`/api/projects/${p.id}/milestones/${mid}/dispute`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { toast.success('Dispute opened — payment paused'); load(); } else toast.error(d.error || 'Could not open dispute');
  }
  async function verifyMilestone(mid) {
    const res = await fetch(`/api/projects/${p.id}/milestones/${mid}/complete`, { method: 'POST' });
    if (res.ok) { toast.success('Milestone verified'); load(); } else toast.error('Could not verify milestone');
  }

  async function createShare() {
    const res = await fetch(`/api/projects/${p.id}/share`, { method: 'POST' });
    if (res.ok) { const d = await res.json(); toast.success('Board portal link created'); load(); return d.shareToken; }
    toast.error('Could not create share link');
  }
  async function revokeShare() {
    if (!confirm('Revoke the public board portal link?')) return;
    const res = await fetch(`/api/projects/${p.id}/share`, { method: 'DELETE' });
    if (res.ok) { toast.success('Link revoked'); load(); }
  }
  function copyShareLink() {
    const url = `${window.location.origin}/portal/${p.shareToken}`;
    navigator.clipboard.writeText(url);
    toast.success('Board portal URL copied to clipboard');
  }

  return (
    <>
      <SiteNav />
      <div className="container py-8">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard</Link>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <PhaseBadge phase={p.phase} />
                <span className="text-xs text-muted-foreground">{p.type} · {p.subType}</span>
                {p.code && <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{p.code}</span>}
                {p.complianceType && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">{p.complianceType}</span>}
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">{p.name}</h1>
              <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {p.address}</div>
            </div>
            <div className="text-right">
              {canSeePricing && (
                <>
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">GMP Ceiling</div>
                  <div className="text-3xl font-bold text-primary">{financials ? formatMoney(financials.adjustedCeiling, { cents: false }) : `$${(p.gmpCeiling || 0).toLocaleString()}`}</div>
                  {financials && financials.ceilingAdjustments !== '0.00' && <div className="text-xs text-muted-foreground">Original {formatMoney(financials.gmpCeiling, { cents: false })} + signed changes</div>}
                  <div className="mt-1 text-xs text-muted-foreground">Spent: ${(p.actualSpend || 0).toLocaleString()}{p.contingency ? ` · Contingency: $${p.contingency.toLocaleString()}` : ''}</div>
                </>
              )}
              {isStaff && (
                <div className="mt-3 flex justify-end gap-2">
                  <Button asChild size="sm" variant="outline"><Link href={`/admin/projects/${p.id}/estimate`}>Estimate</Link></Button>
                  <Button asChild size="sm" variant="outline"><Link href={`/admin/projects/${p.id}/changes/new`}>New CO</Link></Button>
                  <Button asChild size="sm" variant="outline"><Link href={`/admin/projects/${p.id}/milestones`}>Milestones</Link></Button>
                </div>
              )}
              {isStaff && (
                <select value={p.phase} onChange={e => setPhase(e.target.value)} className="mt-3 rounded-md border border-border bg-background px-2 py-1 text-xs" aria-label="Project phase">
                  {PHASES.map(ph => <option key={ph}>{ph}</option>)}
                </select>
              )}
              {(isOwner || isStaff) && (
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  {p.shareToken ? (
                    <>
                      <Button size="sm" variant="outline" onClick={copyShareLink}><ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Copy Board Portal Link</Button>
                      <Button size="sm" variant="ghost" onClick={revokeShare}>Revoke</Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={createShare}><ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Create Board Portal Link</Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Phase stepper */}
          <div className="mt-6">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Phase progression</span><span>{p.percentComplete}% complete</span>
            </div>
            <div className="mt-3 flex gap-1">
              {PHASES.map((ph, i) => {
                const currentIdx = PHASES.indexOf(p.phase);
                const active = i <= currentIdx;
                return (
                  <div key={ph} className="flex-1">
                    <div className={`h-1.5 rounded-full ${active ? 'bg-primary' : 'bg-muted'}`} />
                    <div className={`mt-1.5 text-[10px] font-medium uppercase tracking-wider ${i === currentIdx ? 'text-primary' : active ? 'text-foreground' : 'text-muted-foreground'}`}>{ph}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline"><Link href={`/projects/${p.id}/changes`}>Change orders</Link></Button>
            <Button asChild size="sm" variant="outline"><Link href={`/projects/${p.id}/insurance`}>Insurance</Link></Button>
            {canSeePricing && <Button asChild size="sm" variant="outline"><Link href={`/projects/${p.id}/billing`}>Billing</Link></Button>}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Info icon={Users} label="Assigned PM" value={p.pmName} />
            <Info icon={Calendar} label="Soft Open" value={p.softOpen || 'TBD'} />
            {canSeePricing
              ? <Info icon={DollarSign} label="Remaining" value={`$${(((p.gmpCeiling || 0) - (p.actualSpend || 0)) / 1000).toFixed(0)}K`} />
              : <Info icon={FileText} label="Your role" value={viewerRole} />}
            <Info icon={Wrench} label="Change Orders" value={changeOrders.length} />
          </div>
        </motion.div>

        {financials && <ContingencyBar f={financials} />}
        {(canSeePricing && p.buildingId) && <ProjectDensity projectId={p.id} />}

        <Tabs value={tab} onValueChange={setTab} className="mt-8">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="milestones">Milestones</TabsTrigger>
            <TabsTrigger value="scope">Scope</TabsTrigger>
            {canSeePricing && <TabsTrigger value="budget">Budget</TabsTrigger>}
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="photos">Photos</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="change-orders">Change Orders</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base">Activity Feed</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {messages.slice(-4).reverse().map(m => (
                    <div key={m.id} className="flex gap-3">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">{(m.fromName || '?')[0]}</div>
                      <div>
                        <div className="text-sm"><span className="font-medium">{m.fromName}</span> <span className="text-muted-foreground">· {new Date(m.createdAt).toLocaleDateString()}</span></div>
                        <div className="text-sm text-muted-foreground">{m.body}</div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Recent Photos</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-3 gap-2">
                  {photos.slice(0, 6).map(ph => (
                    <img key={ph.id} src={ph.url} alt="" className="aspect-square rounded-lg object-cover" />
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="milestones" className="mt-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Milestone Tracker</CardTitle><CardDescription>48-hour subcontractor payments release on milestone sign-off.</CardDescription></CardHeader>
              <CardContent className="space-y-2">
                {milestones.map(m => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg border border-border bg-background p-4">
                    <div className="flex items-center gap-3">
                      {m.status === 'complete' ? <CheckCircle2 className="h-5 w-5 text-forest" /> : m.status === 'in_progress' ? <Clock className="h-5 w-5 text-primary animate-pulse" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                      <div>
                        <div className="text-sm font-medium">{m.title || m.name}</div>
                        <div className="text-xs text-muted-foreground">{[m.phase || m.trigger, m.dueDate ? `Due ${new Date(m.dueDate).toLocaleDateString()}` : null, m.inDisputeWindow ? `Payment releases ${new Date(m.releaseEta).toLocaleString()}` : null].filter(Boolean).join(' · ')}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      {m.amount !== undefined && (
                        <div>
                          <div className="text-sm font-semibold">{formatMoney(m.amount)}</div>
                          <div className="text-xs text-muted-foreground">{(m.paymentStatus || '').replace('_', ' ')}</div>
                        </div>
                      )}
                      {isStaff && m.status !== 'complete' && <Button size="sm" variant="outline" onClick={() => verifyMilestone(m.id)}>Verify</Button>}
                      {m.canDispute && (viewerRole === 'client' || viewerRole === 'management') && <Button size="sm" variant="outline" onClick={() => disputeMilestone(m.id)}>Dispute</Button>}
                      {m.releaseStatus === 'disputed' && <span className="text-xs text-alert-ink">Disputed</span>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scope" className="mt-6">
            <ScopeView projectId={p.id} isStaff={isStaff} parties={parties} />
          </TabsContent>

          {canSeePricing && (
            <TabsContent value="budget" className="mt-6">
              <BudgetView project={p} projectId={p.id} />
            </TabsContent>
          )}

          <TabsContent value="documents" className="mt-6">
            <DocumentsView projectId={p.id} documents={documents} onRefresh={load} />
          </TabsContent>

          <TabsContent value="photos" className="mt-6">
            <PhotosView projectId={p.id} photos={photos} onRefresh={load} />
          </TabsContent>

          <TabsContent value="messages" className="mt-6">
            <MessagesView projectId={p.id} messages={messages} onRefresh={load} viewerRole={viewerRole} />
          </TabsContent>

          <TabsContent value="change-orders" className="mt-6">
            <ChangeOrdersView projectId={p.id} changeOrders={changeOrders} />
          </TabsContent>

          <TabsContent value="team" className="mt-6">
            <TeamView projectId={p.id} parties={parties} clientEmail={p.clientEmail} pmName={p.pmName} pmEmail={p.pmEmail} canInvite={isStaff || isOwner} isStaff={isStaff} onRefresh={load} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function ProjectDensity({ projectId }) {
  const [d, setD] = useState(null);
  useEffect(() => { fetch(`/api/projects/${projectId}/compliance`).then(r => r.ok ? r.json() : null).then(setD); }, [projectId]);
  if (!d?.density) return null;
  return <div className="mt-6"><DensityCard name={d.building?.name} density={d.density} /></div>;
}

// Renders server-computed figures only (lib/co/financials.js). The width and colour band come from
// the API; this component does no arithmetic.
const BAND = { forest: 'hsl(var(--forest))', sand: 'hsl(var(--sand))', alert: 'hsl(var(--alert))' };
function ContingencyBar({ f }) {
  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[2px] text-muted-foreground">Contingency remaining</div>
          <div className="mt-1 font-mono text-2xl">{formatMoney(f.contingencyRemaining)} <span className="text-sm text-muted-foreground">of {formatMoney(f.contingency)}</span></div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>Used by signed changes: <span className="font-mono">{formatMoney(f.contingencyUsed)}</span></div>
          {f.ceilingAdjustments !== '0.00' && <div>Ceiling now <span className="font-mono">{formatMoney(f.adjustedCeiling)}</span> (+{formatMoney(f.ceilingAdjustments)} by signed changes)</div>}
          {f.pendingChangeOrders !== '0.00' && <div>Awaiting your signature: <span className="font-mono">{formatMoney(f.pendingChangeOrders)}</span></div>}
        </div>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full border border-border bg-background" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={f.pctRemaining} aria-label="Contingency remaining">
        <div className="h-full rounded-full transition-all" style={{ width: `${f.pctRemaining}%`, background: BAND[f.band] }} />
      </div>
      <div className="mt-1 text-right font-mono text-[10px] uppercase tracking-[2px]" style={{ color: f.band === 'alert' ? BAND.alert : undefined }}>{f.pctRemaining}% remaining</div>
    </div>
  );
}

function Info({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background/60 p-3">
      <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}

function PhaseBadge({ phase }) {
  return <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">{phase}</span>;
}

function BudgetView({ project: p, projectId }) {
  const [scope, setScope] = useState(null);
  useEffect(() => {
    fetch(`/api/projects/${projectId}/scope`).then(r => r.ok ? r.json() : {}).then(d => setScope(d));
  }, [projectId]);
  // All totals are computed on the server (lib/money); this component only renders them.
  const lines = scope ? scope.lines || [] : null;
  const byTrade = scope?.totals?.byTrade || [];
  const scopeTotal = scope?.totals?.scopeTotal;
  const gmp = p.gmpCeiling || 0;
  const spent = p.actualSpend || 0;
  const remaining = gmp - spent;
  const pct = gmp ? Math.round(spent / gmp * 100) : 0;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-5"><div className="text-xs uppercase tracking-widest text-muted-foreground">GMP Ceiling</div><div className="mt-2 text-2xl font-bold text-primary">${gmp.toLocaleString()}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs uppercase tracking-widest text-muted-foreground">Actual Spend</div><div className="mt-2 text-2xl font-bold">${spent.toLocaleString()}</div><div className="mt-1 text-xs text-muted-foreground">{pct}% of ceiling</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs uppercase tracking-widest text-muted-foreground">Remaining Under Ceiling</div><div className="mt-2 text-2xl font-bold text-forest">${remaining.toLocaleString()}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs uppercase tracking-widest text-muted-foreground">Contingency</div><div className="mt-2 text-2xl font-bold">${(p.contingency || 0).toLocaleString()}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Scope Totals by Trade</CardTitle><CardDescription>From the scope of work. Add lines on the Scope tab.</CardDescription></CardHeader>
        <CardContent>
          {lines === null ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : byTrade.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No scope lines priced yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border"><th className="pb-2 text-left">Trade</th><th className="pb-2 text-right">Lines</th><th className="pb-2 text-right">Total</th></tr>
              </thead>
              <tbody>
                {byTrade.map(t => (
                  <tr key={t.trade} className="border-b border-border/40 last:border-0">
                    <td className="py-3 font-medium capitalize">{t.trade}</td>
                    <td className="py-3 text-right">{t.count}</td>
                    <td className="py-3 text-right font-mono">{formatMoney(t.total)}</td>
                  </tr>
                ))}
                <tr><td className="pt-3 font-semibold">Scope total</td><td /><td className="pt-3 text-right font-mono font-semibold">{formatMoney(scopeTotal)}</td></tr>
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ScopeView({ projectId, isStaff, parties = [] }) {
  const [subs, setSubs] = useState([]);
  useEffect(() => {
    if (!isStaff) return;
    fetch('/api/subcontractors').then(r => r.ok ? r.json() : { subcontractors: [] }).then(d => {
      const onProject = new Set(parties.filter(x => x.role === 'subcontractor' && x.status === 'accepted').map(x => x.userEmail));
      setSubs(d.subcontractors.filter(u => onProject.has(u.email)));
    });
  }, [isStaff, parties]);
  async function assign(lineId, subUserId) {
    const r = await fetch(`/api/projects/${projectId}/scope/${lineId}/assign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subUserId: subUserId || null }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast.error(d.error || 'Could not assign', { duration: 9000 }); load(); return; }
    toast.success(subUserId ? 'Assigned' : 'Unassigned');
    load();
  }
  const [state, setState] = useState(null);
  const [form, setForm] = useState({ trade: '', title: '', unit: 'ea', quantity: '', unitCost: '' });
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch(`/api/projects/${projectId}/scope`);
    setState(res.ok ? await res.json() : { lines: [], canSeePricing: false });
  }
  useEffect(() => { load(); }, [projectId]);

  async function addLine(e) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}/scope`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setSaving(false);
    if (res.ok) { toast.success('Scope line added'); setForm({ trade: form.trade, title: '', unit: form.unit, quantity: '', unitCost: '' }); load(); }
    else { const d = await res.json().catch(() => ({})); toast.error(d.error || 'Could not add line'); }
  }
  async function removeLine(id) {
    if (!confirm('Delete this scope line?')) return;
    const res = await fetch(`/api/projects/${projectId}/scope/${id}`, { method: 'DELETE' });
    if (res.ok) load();
  }

  if (!state) return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
  const { lines } = state;
  // Columns follow what the server sent: if no line carries a price, the viewer gets no $ columns.
  const showMoney = lines.some(l => l.unitCost !== undefined || l.lineTotal !== undefined);

  return (
    <div className="space-y-6">
      {isStaff && (
        <Card>
          <CardHeader><CardTitle className="text-base">Add scope line</CardTitle><CardDescription>Line total is quantity × unit cost.</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={addLine} className="grid gap-3 md:grid-cols-6">
              <Input required placeholder="Trade (e.g. electrical)" value={form.trade} onChange={e => setForm({ ...form, trade: e.target.value })} className="md:col-span-1" />
              <Input required placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="md:col-span-2" />
              <Input placeholder="Unit" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} />
              <Input type="number" step="any" placeholder="Qty" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
              <Input type="number" step="any" placeholder="Unit cost $" value={form.unitCost} onChange={e => setForm({ ...form, unitCost: e.target.value })} />
              <Button type="submit" disabled={saving} className="md:col-span-6 md:w-fit">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Add line</Button>
            </form>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle className="text-base">Scope of Work</CardTitle><CardDescription>{state.viewerRole === 'subcontractor' ? 'Showing the lines for your trade.' : `${lines.length} line${lines.length === 1 ? '' : 's'}`}</CardDescription></CardHeader>
        <CardContent>
          {lines.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No scope lines yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="pb-2 text-left">#</th><th className="pb-2 text-left">Trade</th><th className="pb-2 text-left">Item</th>
                    <th className="pb-2 text-right">Qty</th><th className="pb-2 text-left pl-2">Unit</th>
                    {showMoney && <><th className="pb-2 text-right">Unit cost</th><th className="pb-2 text-right">Line total</th></>}
                    <th className="pb-2 text-left pl-3">Status</th>{isStaff && <th className="pb-2 text-left pl-3">Assigned</th>}{isStaff && <th />}
                  </tr>
                </thead>
                <tbody>
                  {lines.map(l => (
                    <tr key={l.id} className="border-b border-border/40 last:border-0">
                      <td className="py-3 font-mono text-xs text-muted-foreground">{l.seq}</td>
                      <td className="py-3 capitalize">{l.trade}</td>
                      <td className="py-3"><div className="font-medium">{l.title}</div>{(l.specifiedMfr || l.specifiedProduct) && <div className="text-xs text-muted-foreground">{[l.specifiedMfr, l.specifiedProduct].filter(Boolean).join(' — ')}</div>}</td>
                      <td className="py-3 text-right">{formatQty(l.quantity)}</td>
                      <td className="py-3 pl-2 text-muted-foreground">{l.unit}</td>
                      {showMoney && <>
                        <td className="py-3 text-right font-mono">{formatMoney(l.unitCost)}</td>
                        <td className="py-3 text-right font-mono">{formatMoney(l.lineTotal)}{l.tariffExposure && l.tariffExposure !== '0.00' ? <div className="text-[10px] text-muted-foreground">incl. tariff {formatMoney(l.tariffExposure)}</div> : null}</td>
                      </>}
                      <td className="py-3 pl-3 text-xs uppercase tracking-wider text-muted-foreground">{(l.status || '').replace('_', ' ')}{(l.blocked || l.openBlocks?.length) ? <div className="normal-case tracking-normal text-sand-ink">Blocked by unsigned CO</div> : null}{l.coiLapsed ? <div className="normal-case tracking-normal text-alert-ink">COI lapsed</div> : null}</td>
                      {isStaff && <td className="py-3 pl-3"><select value={l.assignedSub || ''} onChange={e => assign(l.id, e.target.value)} className="max-w-[160px] rounded-md border border-border bg-background px-2 py-1 text-xs" aria-label="Assigned subcontractor"><option value="">—</option>{subs.map(u => <option key={u.id} value={u.id}>{u.company || u.name || u.email}</option>)}{l.assignedSub && !subs.some(u => u.id === l.assignedSub) && <option value={l.assignedSub}>{l.assignedSubName || 'Assigned'}</option>}</select></td>}
                      {isStaff && <td className="py-3 text-right"><button onClick={() => removeLine(l.id)} className="rounded-md p-1.5 text-muted-foreground hover:text-destructive" aria-label="Delete line"><Trash2 className="h-3.5 w-3.5" /></button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DocumentsView({ projectId, documents, onRefresh }) {
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState('Contracts');
  const fileRef = useRef(null);

  const cats = ['Contracts', 'Permits', 'Drawings', 'Photos', 'Change Orders', 'Invoices'];

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { toast.error('File must be under 25 MB'); return; }
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    form.append('projectId', projectId);
    form.append('category', category);
    form.append('kind', 'document');
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
    if (res.ok) { toast.success('Document uploaded'); onRefresh(); }
    else { const d = await res.json().catch(() => ({})); toast.error(d.error || 'Upload failed'); }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Upload document</CardTitle><CardDescription>PDF, PNG, JPG, DWG · Max 25 MB</CardDescription></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <select value={category} onChange={e => setCategory(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-sm">
              {cats.map(c => <option key={c}>{c}</option>)}
            </select>
            <label className={`inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
              <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.dwg,.doc,.docx,.xls,.xlsx" onChange={handleFile} className="hidden" />
              {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</> : <><Plus className="h-4 w-4" /> Choose file</>}
            </label>
          </div>
        </CardContent>
      </Card>

      {cats.map(cat => {
        const items = documents.filter(d => d.category === cat);
        if (items.length === 0) return null;
        return (
          <Card key={cat}>
            <CardHeader><CardTitle className="text-sm uppercase tracking-widest text-muted-foreground">{cat}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {items.map(d => (
                <div key={d.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-center gap-3"><FileText className="h-4 w-4 text-primary" /><div><div className="font-medium">{d.name}</div><div className="text-xs text-muted-foreground">{d.uploadedBy} · {d.size} · {new Date(d.uploadedAt).toLocaleDateString()}</div></div></div>
                  {d.url ? (
                    <a href={d.url} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="ghost">Download</Button></a>
                  ) : (
                    <Button size="sm" variant="ghost" disabled>Placeholder</Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

const AUDIENCES = {
  all: { label: 'Everyone on the project', roles: [] },
  owner: { label: 'Client + Boro & Nest only', roles: ['client', 'management', 'bn_staff'] },
  staff: { label: 'Boro & Nest only', roles: ['bn_staff'] }
};

function MessagesView({ projectId, messages, onRefresh, viewerRole }) {
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all');
  const [sending, setSending] = useState(false);

  async function send() {
    if (!body.trim()) return;
    setSending(true);
    const res = await fetch(`/api/projects/${projectId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, audience: AUDIENCES[audience].roles })
    });
    if (res.ok) { setBody(''); setAudience('all'); onRefresh(); toast.success('Sent'); }
    else toast.error('Failed to send');
    setSending(false);
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Project Thread</CardTitle><CardDescription>All parties assigned to this project can post here.</CardDescription></CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
          {messages.map(m => (
            <div key={m.id} className="flex gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">{(m.fromName || '?')[0]}</div>
              <div className="flex-1">
                <div className="text-sm"><span className="font-medium">{m.fromName}</span> <span className="text-xs uppercase text-muted-foreground">· {m.fromRole}</span> <span className="text-xs text-muted-foreground">· {new Date(m.createdAt).toLocaleString()}</span>{m.audience?.length > 0 && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Restricted</span>}</div>
                <div className="mt-1 rounded-lg bg-background px-3 py-2 text-sm">{m.body}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 border-t border-border pt-4">
          <select value={audience} onChange={e => setAudience(e.target.value)} className="mb-2 rounded-md border border-border bg-background px-2 py-1 text-xs" aria-label="Who can read this message">
            {Object.entries(AUDIENCES).map(([k, a]) => <option key={k} value={k}>{a.label}</option>)}
          </select>
          <div className="flex gap-2">
            <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Type a message…" rows={2} className="flex-1" />
            <Button onClick={send} disabled={sending || !body.trim()}>{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ChangeOrdersView({ projectId, changeOrders }) {
  // changeOrders arrive already projected for this viewer's role (lib/co/project.js).
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div><CardTitle className="text-base">Change orders</CardTitle><CardDescription>Nothing outside the agreed scope starts until the change is signed.</CardDescription></div>
        <Button asChild size="sm" variant="outline"><Link href={`/projects/${projectId}/changes`}>Open change orders</Link></Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {changeOrders.length === 0 && <div className="text-sm text-muted-foreground">No change orders for you on this project.</div>}
        {changeOrders.map(co => (
          <Link key={co.id} href={`/projects/${projectId}/changes/${co.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm hover:border-primary/60">
            <div className="min-w-0"><span className="font-mono text-[10px] text-muted-foreground">{co.code}</span> <span className="font-medium">{co.title}</span>{co.reasonText && <div className="text-xs text-muted-foreground">{co.reasonText}</div>}</div>
            <div className="flex shrink-0 items-center gap-3">{co.costDelta !== undefined && <span className="font-mono">{formatMoney(co.costDelta)}</span>}<CoStatus status={co.status} /></div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function TeamView({ projectId, parties, clientEmail, pmName, pmEmail, canInvite, isStaff, onRefresh }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('subcontractor');
  const [scopeTrades, setScopeTrades] = useState('');
  const [message, setMessage] = useState('');
  const [inviting, setInviting] = useState(false);

  async function invite(e) {
    e.preventDefault();
    if (!email || !role) return;
    setInviting(true);
    const res = await fetch(`/api/projects/${projectId}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role, message, scopeTrades: role === 'subcontractor' ? scopeTrades : '' })
    });
    const data = await res.json();
    if (res.ok) {
      toast.success(`Invitation sent to ${email}`);
      setEmail(''); setMessage(''); setScopeTrades('');
      onRefresh();
    } else {
      toast.error(data.error || 'Failed');
    }
    setInviting(false);
  }

  async function removeParty(partyId) {
    if (!confirm('Remove this party from the project room?')) return;
    const res = await fetch(`/api/projects/${projectId}/parties/${partyId}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Removed'); onRefresh(); }
  }

  const roles = [
    ...(isStaff ? [{ key: 'client', label: 'Client' }] : []),
    { key: 'management', label: 'Management Company' },
    { key: 'building-rep', label: 'Building Rep' },
    { key: 'expediter', label: 'Expediter' },
    { key: 'subcontractor', label: 'Subcontractor' },
    { key: 'designer', label: 'Designer / Architect' }
  ];

  const pendingCount = parties.filter(p => p.status === 'pending').length;
  const acceptedCount = parties.filter(p => p.status === 'accepted').length;

  return (
    <div className="space-y-6">
      {/* B&N staff banner */}
      <div className="flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm">
        <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
        <div><strong>Boro &amp; Nest staff</strong> ({pmName}) has automatic access to this project room. No invitation required.</div>
      </div>

      {canInvite && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><UserPlus className="h-4 w-4 text-primary" /> Invite a party to the deal room</CardTitle>
            <CardDescription>Bring your architect, expediter, management company, or a specific subcontractor into this project. They'll get access to messages, docs, and photos.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={invite} className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs uppercase tracking-widest text-muted-foreground">Email</label>
                  <Input type="email" required placeholder="architect@studio.co" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs uppercase tracking-widest text-muted-foreground">Their role in this project</label>
                  <select value={role} onChange={e => setRole(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                    {roles.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                  </select>
                </div>
              </div>
              {role === 'subcontractor' && (
                <div>
                  <label className="mb-1.5 block text-xs uppercase tracking-widest text-muted-foreground">Trades they can see (comma-separated)</label>
                  <Input placeholder="electrical, lighting" value={scopeTrades} onChange={e => setScopeTrades(e.target.value)} />
                  <p className="mt-1 text-xs text-muted-foreground">Subcontractors only see scope lines and pricing for these trades.</p>
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-widest text-muted-foreground">Optional message</label>
                <Textarea rows={2} placeholder="We'd like you to review the plans and coordinate the electrical rough-in schedule." value={message} onChange={e => setMessage(e.target.value)} />
              </div>
              <Button type="submit" disabled={inviting || !email}>
                {inviting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending</> : <><Mail className="mr-2 h-4 w-4" /> Send Invitation</>}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div><CardTitle className="text-base">Project Room Members</CardTitle><CardDescription>{acceptedCount} active · {pendingCount} pending</CardDescription></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* PM row (always shown) */}
          <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{pmName?.[0]}</div>
              <div>
                <div className="text-sm font-medium">{pmName}</div>
                <div className="text-xs text-muted-foreground">{pmEmail} · Project Manager · Boro &amp; Nest</div>
              </div>
            </div>
            <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">B&amp;N Staff</span>
          </div>

          {/* Client row */}
          {clientEmail && (
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-accent/30 text-sm font-bold">{clientEmail[0]?.toUpperCase()}</div>
                <div>
                  <div className="text-sm font-medium">{clientEmail}</div>
                  <div className="text-xs text-muted-foreground">Client · Project owner</div>
                </div>
              </div>
              <span className="rounded-full bg-accent/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">Owner</span>
            </div>
          )}

          {/* Invited parties */}
          {parties.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No invited parties yet. {canInvite && 'Use the form above to bring in your architect, expediter, or subs.'}
            </div>
          )}
          {parties.map(p => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-muted text-sm font-bold">{p.userEmail[0]?.toUpperCase()}</div>
                <div>
                  <div className="text-sm font-medium">{p.userEmail}</div>
                  <div className="text-xs text-muted-foreground">{p.role}{p.scopeTrades?.length ? ` (${p.scopeTrades.join(', ')})` : ''} · Invited by {p.invitedByName} · {new Date(p.invitedAt).toLocaleDateString()}</div>
                  {p.message && <div className="mt-1 text-xs italic text-muted-foreground">"{p.message}"</div>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill status={p.status} />
                {canInvite && (
                  <button onClick={() => removeParty(p.id)} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    accepted: 'bg-forest/10 text-forest',
    pending: 'bg-sand/25 text-sand-ink',
    declined: 'bg-alert/12 text-alert-ink'
  };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${map[status] || 'bg-muted'}`}>{status}</span>;
}

function PhotosView({ projectId, photos, onRefresh }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { toast.error('Photo must be under 25 MB'); return; }
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    form.append('projectId', projectId);
    form.append('kind', 'photo');
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
    if (res.ok) { toast.success('Photo uploaded'); onRefresh(); }
    else toast.error('Upload failed');
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div><CardTitle className="text-base">Site Photo Log</CardTitle><CardDescription>Weekly progress photos from PMs and subs.</CardDescription></div>
          <label className={`inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
            {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</> : <><Camera className="h-4 w-4" /> Upload photo</>}
          </label>
        </CardHeader>
        <CardContent>
          {photos.length === 0 && <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">No photos yet. Upload a site photo to start the log.</div>}
          <div className="grid gap-3 md:grid-cols-3">
            {photos.map(ph => (
              <a key={ph.id} href={ph.url} target="_blank" rel="noopener noreferrer" className="group relative block overflow-hidden rounded-lg border border-border">
                <img src={ph.url} alt="" className="aspect-video w-full object-cover transition-transform group-hover:scale-105" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 via-background/70 to-transparent p-3">
                  <div className="text-xs font-medium truncate">{ph.caption}</div>
                  <div className="text-[10px] text-muted-foreground">{ph.uploadedBy} · {new Date(ph.uploadedAt).toLocaleDateString()}</div>
                </div>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
