'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SiteNav from '@/components/site-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const EXAMPLE = {
  name: 'Bathroom gut renovation',
  scopeType: 'gut_reno',
  params: [
    { name: 'floor_sqft', kind: 'input', label: 'Floor area', unit: 'sqft', defaultVal: '45' },
    { name: 'ceiling_height', kind: 'input', label: 'Ceiling height', unit: 'ft', defaultVal: '8' },
    { name: 'perimeter', kind: 'input', label: 'Room perimeter', unit: 'lf', defaultVal: '28' },
    { name: 'waste', kind: 'constant', label: 'Tile waste factor', constVal: '1.12' },
    { name: 'wall_tile_sqft', kind: 'calculated', label: 'Wall tile area', formula: 'perimeter * 7 * waste' }
  ],
  tasks: [
    { key: 'demo', trade: 'demolition', title: 'Demo to studs', unit: 'sqft', quantityFormula: 'floor_sqft', unitCost: '18.00', productionRate: '60', crewSize: 2 },
    { key: 'rough_plumbing', trade: 'plumbing', title: 'Rough plumbing', unit: 'ls', quantity: '1', unitCost: '4800.00', durationDays: 3, needsInspection: true, inspectionLeadDays: 2, dependsOn: ['demo'] },
    { key: 'wall_tile', trade: 'tile', title: 'Wall tile', unit: 'sqft', quantityFormula: 'wall_tile_sqft', unitCost: '32.00', tariffPct: '25.00', sourcingOrigin: 'IT', specifiedMfr: 'Marazzi', specifiedProduct: 'Classentino', altDomesticMfr: 'Daltile', productionRate: '40', crewSize: 1, dependsOn: ['rough_plumbing'] }
  ]
};

// Staff-only template authoring. The server validates the whole parameter graph on save
// (cycles, undefined references, kind rules) and returns the exact problem.
export default function TemplatesPage() {
  const router = useRouter();
  const [list, setList] = useState(null);
  const [editing, setEditing] = useState(null); // { id?, text }
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState('');

  async function load() {
    const r = await fetch('/api/templates');
    if (r.status === 401) { router.replace('/login?next=/admin/templates'); return; }
    if (r.status === 403) { router.replace('/dashboard'); return; }
    setList((await r.json()).templates);
  }
  useEffect(() => { load(); }, []);

  async function open(id) {
    const r = await fetch(`/api/templates/${id}`);
    const { template } = await r.json();
    const { id: _i, createdAt, createdBy, updatedAt, updatedBy, ...body } = template;
    setEditing({ id, text: JSON.stringify(body, null, 2) });
    setProblem('');
  }

  async function save() {
    let body;
    try { body = JSON.parse(editing.text); } catch (e) { setProblem(`JSON: ${e.message}`); return; }
    setSaving(true);
    const r = await fetch(editing.id ? `/api/templates/${editing.id}` : '/api/templates', {
      method: editing.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const d = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) { setProblem(d.error || 'Could not save'); return; }
    toast.success('Template saved');
    setProblem('');
    setEditing(null);
    load();
  }

  if (!list) return <><SiteNav /><div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></>;

  return (
    <>
      <SiteNav />
      <div className="container py-8">
        <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">← PM Console</Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[2px] text-primary">Internal · pricing IP</div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Scope Templates</h1>
          </div>
          <Button onClick={() => { setEditing({ text: JSON.stringify(EXAMPLE, null, 2) }); setProblem(''); }}>New template</Button>
        </div>

        {editing && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">{editing.id ? 'Edit template' : 'New template'}</CardTitle>
              <CardDescription>Params: input (defaultVal), constant (constVal), calculated (formula). Tasks: quantityFormula or quantity, unitCost, tariffPct, dependsOn, productionRate, crewSize, needsInspection, inspectionLeadDays.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea rows={22} className="font-mono text-xs" value={editing.text} onChange={e => setEditing({ ...editing, text: e.target.value })} />
              {problem && <div className="rounded-md border border-alert/50 bg-alert/12 p-3 text-sm text-alert-ink">{problem}</div>}
              <div className="flex gap-2">
                <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save</Button>
                <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mt-6">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground"><tr className="border-b border-border"><th className="p-3 text-left">Name</th><th className="p-3 text-left">Scope type</th><th className="p-3 text-right">Params</th><th className="p-3 text-right">Tasks</th><th /></tr></thead>
              <tbody>
                {list.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No templates yet.</td></tr>}
                {list.map(t => (
                  <tr key={t.id} className="border-b border-border/40 last:border-0">
                    <td className="p-3 font-medium">{t.name}</td>
                    <td className="p-3 text-muted-foreground">{t.scopeType || '—'}</td>
                    <td className="p-3 text-right">{t.paramCount}</td>
                    <td className="p-3 text-right">{t.taskCount}</td>
                    <td className="p-3 text-right"><Button size="sm" variant="ghost" onClick={() => open(t.id)}>Edit</Button></td>
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
