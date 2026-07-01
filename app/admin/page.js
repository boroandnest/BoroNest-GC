'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SiteNav from '@/components/site-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Plus, Users, Building2, Hammer } from 'lucide-react';

export default function AdminPage() {
  const [projects, setProjects] = useState([]);
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ type: 'Commercial', gmpCeiling: '' });

  async function load() {
    const [pRes, sRes] = await Promise.all([fetch('/api/projects'), fetch('/api/subcontractors')]);
    if (pRes.ok) setProjects((await pRes.json()).projects);
    if (sRes.ok) setSubs((await sRes.json()).subcontractors);
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
    if (res.ok) { toast.success('Project created'); setForm({ type: 'Commercial', gmpCeiling: '' }); load(); }
    else toast.error('Failed');
    setCreating(false);
  }

  if (loading) return <><SiteNav /><div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></>;

  return (
    <>
      <SiteNav />
      <div className="container py-8">
        <div className="mb-8">
          <div className="text-xs font-semibold uppercase tracking-widest text-primary">Internal Admin</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">PM Console</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create projects, assign parties, approve subcontractors.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardContent className="p-5"><div className="flex items-center justify-between"><span className="text-xs uppercase tracking-widest text-muted-foreground">Projects</span><Building2 className="h-4 w-4 text-primary" /></div><div className="mt-2 text-3xl font-bold">{projects.length}</div></CardContent></Card>
          <Card><CardContent className="p-5"><div className="flex items-center justify-between"><span className="text-xs uppercase tracking-widest text-muted-foreground">Registered Subs</span><Hammer className="h-4 w-4 text-primary" /></div><div className="mt-2 text-3xl font-bold">{subs.length}</div></CardContent></Card>
          <Card><CardContent className="p-5"><div className="flex items-center justify-between"><span className="text-xs uppercase tracking-widest text-muted-foreground">Total GMP</span><Users className="h-4 w-4 text-primary" /></div><div className="mt-2 text-3xl font-bold text-primary">${(projects.reduce((a,p)=>a+(p.gmpCeiling||0),0)/1000).toFixed(0)}K</div></CardContent></Card>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Create Project</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={createProject} className="space-y-3">
                <div><Label className="mb-1.5 block text-sm">Name</Label><Input required value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} placeholder="Sable Med-Spa — Flatiron" /></div>
                <div><Label className="mb-1.5 block text-sm">Address</Label><Input required value={form.address || ''} onChange={e => setForm({...form, address: e.target.value})} /></div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div><Label className="mb-1.5 block text-sm">Type</Label>
                    <Select value={form.type} onValueChange={v => setForm({...form, type: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{['Commercial', 'Residential', 'Compliance'].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="mb-1.5 block text-sm">GMP Ceiling ($)</Label><Input required type="number" value={form.gmpCeiling} onChange={e => setForm({...form, gmpCeiling: e.target.value})} /></div>
                </div>
                <div><Label className="mb-1.5 block text-sm">Client email</Label><Input type="email" value={form.clientEmail || ''} onChange={e => setForm({...form, clientEmail: e.target.value})} /></div>
                <Button type="submit" disabled={creating} className="w-full">{creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Create Project</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Subcontractor Applications</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {subs.length === 0 && <div className="text-sm text-muted-foreground">No sub applications yet.</div>}
              {subs.map(s => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <div className="text-sm font-medium">{s.company || s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.profile?.trades || 'Trades TBD'}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">View</Button>
                    <Button size="sm">Approve</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="mt-8">
          <CardHeader><CardTitle className="text-base">All Projects</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground"><tr className="border-b border-border"><th className="pb-2 text-left">Name</th><th className="pb-2 text-left">Phase</th><th className="pb-2 text-left">Type</th><th className="pb-2 text-right">GMP</th><th className="pb-2 text-right">Progress</th></tr></thead>
              <tbody>
                {projects.map(p => (
                  <tr key={p.id} className="border-b border-border/40 last:border-0">
                    <td className="py-3 font-medium">{p.name}</td>
                    <td className="py-3 text-muted-foreground">{p.phase}</td>
                    <td className="py-3 text-muted-foreground">{p.type}</td>
                    <td className="py-3 text-right">${(p.gmpCeiling/1000).toFixed(0)}K</td>
                    <td className="py-3 text-right">{p.percentComplete}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
