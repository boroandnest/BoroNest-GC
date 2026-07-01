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
    if (!res.ok) { toast.error('Project not found'); router.push('/dashboard'); return; }
    const d = await res.json();
    setData(d);
    setLoading(false);
  }

  useEffect(() => { load(); }, [params.id]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!data) return null;

  const { project: p, milestones, documents, messages, photos, changeOrders, parties = [], isStaff, isOwner } = data;

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
                {p.complianceType && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">{p.complianceType}</span>}
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">{p.name}</h1>
              <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {p.address}</div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">GMP Ceiling</div>
              <div className="text-3xl font-bold text-primary">${p.gmpCeiling.toLocaleString()}</div>
              <div className="mt-1 text-xs text-muted-foreground">Spent: ${p.actualSpend.toLocaleString()}</div>
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

          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Info icon={Users} label="Assigned PM" value={p.pmName} />
            <Info icon={Calendar} label="Soft Open" value={p.softOpen || 'TBD'} />
            <Info icon={DollarSign} label="Remaining" value={`$${((p.gmpCeiling - p.actualSpend)/1000).toFixed(0)}K`} />
            <Info icon={Wrench} label="Change Orders" value={changeOrders.length} />
          </div>
        </motion.div>

        <Tabs value={tab} onValueChange={setTab} className="mt-8">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="milestones">Milestones</TabsTrigger>
            <TabsTrigger value="budget">Budget</TabsTrigger>
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
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">{m.fromName[0]}</div>
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
                      {m.status === 'complete' ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : m.status === 'in_progress' ? <Clock className="h-5 w-5 text-primary animate-pulse" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                      <div>
                        <div className="text-sm font-medium">{m.name}</div>
                        <div className="text-xs text-muted-foreground">{m.phase} · Due {new Date(m.dueDate).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">${m.amount.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">{m.paymentStatus.replace('_', ' ')}</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="budget" className="mt-6">
            <BudgetView project={p} />
          </TabsContent>

          <TabsContent value="documents" className="mt-6">
            <DocumentsView projectId={p.id} documents={documents} onRefresh={load} />
          </TabsContent>

          <TabsContent value="photos" className="mt-6">
            <PhotosView projectId={p.id} photos={photos} onRefresh={load} />
          </TabsContent>

          <TabsContent value="messages" className="mt-6">
            <MessagesView projectId={p.id} messages={messages} onRefresh={load} />
          </TabsContent>

          <TabsContent value="change-orders" className="mt-6">
            <ChangeOrdersView projectId={p.id} changeOrders={changeOrders} onRefresh={load} />
          </TabsContent>

          <TabsContent value="team" className="mt-6">
            <TeamView projectId={p.id} parties={parties} clientEmail={p.clientEmail} pmName={p.pmName} pmEmail={p.pmEmail} canInvite={isStaff || isOwner} onRefresh={load} />
          </TabsContent>
        </Tabs>
      </div>
    </>
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

function BudgetView({ project: p }) {
  const remaining = p.gmpCeiling - p.actualSpend;
  const pct = Math.round(p.actualSpend / p.gmpCeiling * 100);
  const lines = [
    { cat: 'Demo & structural', budget: p.gmpCeiling * 0.12, actual: p.actualSpend * 0.15 },
    { cat: 'Mechanical / HVAC', budget: p.gmpCeiling * 0.18, actual: p.actualSpend * 0.20 },
    { cat: 'Electrical', budget: p.gmpCeiling * 0.14, actual: p.actualSpend * 0.13 },
    { cat: 'Plumbing', budget: p.gmpCeiling * 0.09, actual: p.actualSpend * 0.08 },
    { cat: 'Millwork & finishes', budget: p.gmpCeiling * 0.28, actual: p.actualSpend * 0.20 },
    { cat: 'FF&E', budget: p.gmpCeiling * 0.10, actual: p.actualSpend * 0.14 },
    { cat: 'Contingency', budget: p.gmpCeiling * 0.09, actual: p.actualSpend * 0.10 }
  ];
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-5"><div className="text-xs uppercase tracking-widest text-muted-foreground">GMP Ceiling</div><div className="mt-2 text-2xl font-bold text-primary">${p.gmpCeiling.toLocaleString()}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs uppercase tracking-widest text-muted-foreground">Actual Spend</div><div className="mt-2 text-2xl font-bold">${p.actualSpend.toLocaleString()}</div><div className="mt-1 text-xs text-muted-foreground">{pct}% of ceiling</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs uppercase tracking-widest text-muted-foreground">Remaining Under Ceiling</div><div className="mt-2 text-2xl font-bold text-emerald-400">${remaining.toLocaleString()}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Line-Item Breakdown</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border"><th className="pb-2 text-left">Category</th><th className="pb-2 text-right">Budgeted</th><th className="pb-2 text-right">Actual</th><th className="pb-2 text-right">Variance</th></tr>
            </thead>
            <tbody>
              {lines.map(l => {
                const v = l.budget - l.actual;
                return (
                  <tr key={l.cat} className="border-b border-border/40 last:border-0">
                    <td className="py-3 font-medium">{l.cat}</td>
                    <td className="py-3 text-right">${Math.round(l.budget).toLocaleString()}</td>
                    <td className="py-3 text-right">${Math.round(l.actual).toLocaleString()}</td>
                    <td className={`py-3 text-right ${v >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{v >= 0 ? '+' : ''}${Math.round(v).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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

function MessagesView({ projectId, messages, onRefresh }) {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  async function send() {
    if (!body.trim()) return;
    setSending(true);
    const res = await fetch(`/api/projects/${projectId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body })
    });
    if (res.ok) { setBody(''); onRefresh(); toast.success('Sent'); }
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
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">{m.fromName[0]}</div>
              <div className="flex-1">
                <div className="text-sm"><span className="font-medium">{m.fromName}</span> <span className="text-xs uppercase text-muted-foreground">· {m.fromRole}</span> <span className="text-xs text-muted-foreground">· {new Date(m.createdAt).toLocaleString()}</span></div>
                <div className="mt-1 rounded-lg bg-background px-3 py-2 text-sm">{m.body}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 border-t border-border pt-4">
          <div className="flex gap-2">
            <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Type a message…" rows={2} className="flex-1" />
            <Button onClick={send} disabled={sending || !body.trim()}>{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ChangeOrdersView({ projectId, changeOrders, onRefresh }) {
  const [description, setDescription] = useState('');
  const [costImpact, setCostImpact] = useState('');

  async function submit() {
    if (!description || !costImpact) return;
    await fetch(`/api/projects/${projectId}/change-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, costImpact: Number(costImpact) })
    });
    setDescription(''); setCostImpact('');
    toast.success('Change order proposed');
    onRefresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Propose Change Order</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea placeholder="Describe the change…" value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          <div className="flex gap-2">
            <Input type="number" placeholder="Cost impact ($)" value={costImpact} onChange={e => setCostImpact(e.target.value)} className="max-w-xs" />
            <Button onClick={submit} disabled={!description || !costImpact}>Propose</Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Change Order Log</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {changeOrders.map(co => (
            <div key={co.id} className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <div className="text-sm font-medium">{co.description}</div>
                <div className="text-xs text-muted-foreground">Requested by {co.requestedBy} · {new Date(co.createdAt).toLocaleDateString()}</div>
              </div>
              <div className="text-right">
                <div className={`text-sm font-semibold ${co.costImpact >= 0 ? 'text-primary' : 'text-emerald-400'}`}>{co.costImpact >= 0 ? '+' : ''}${co.costImpact.toLocaleString()}</div>
                <div className={`text-xs rounded-full px-2 py-0.5 ${co.status === 'Approved' ? 'bg-emerald-500/15 text-emerald-400' : co.status === 'Rejected' ? 'bg-red-500/15 text-red-400' : 'bg-yellow-500/15 text-yellow-400'} inline-block`}>{co.status}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function TeamView({ projectId, parties, clientEmail, pmName, pmEmail, canInvite, onRefresh }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('subcontractor');
  const [message, setMessage] = useState('');
  const [inviting, setInviting] = useState(false);

  async function invite(e) {
    e.preventDefault();
    if (!email || !role) return;
    setInviting(true);
    const res = await fetch(`/api/projects/${projectId}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role, message })
    });
    const data = await res.json();
    if (res.ok) {
      toast.success(`Invitation sent to ${email}`);
      setEmail(''); setMessage('');
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
    { key: 'client', label: 'Client' },
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
                  <div className="text-xs text-muted-foreground">{p.role} · Invited by {p.invitedByName} · {new Date(p.invitedAt).toLocaleDateString()}</div>
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
    accepted: 'bg-emerald-500/15 text-emerald-400',
    pending: 'bg-yellow-500/15 text-yellow-400',
    declined: 'bg-red-500/15 text-red-400'
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
