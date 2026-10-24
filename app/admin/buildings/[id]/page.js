'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import SiteNav from '@/components/site-nav';
import DensityCard from '@/components/density-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const STEPS = [['workCompletedAt', 'Work done'], ['clientAcceptedAt', 'Client accepted'], ['certifiedFiledAt', 'Cert. filed'], ['agencyClosedAt', 'HPD closed']];
const EVIDENCE = ['reported', 'documented', 'professionally_assessed', 'disputed', 'unknown', 'superseded'];

// Violation register with the four-state closure model. Staff edit; client / management can view and accept.
export default function BuildingRegister() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('open');
  const [units, setUnits] = useState({ unitCount: '', unitCountVerified: false, unitCountSource: '' });
  const [one, setOne] = useState({ hpdId: '', class: 'B', unit: '', description: '', issuedOn: '', correctBy: '' });
  const [bulk, setBulk] = useState('');

  async function load() {
    const r = await fetch(`/api/buildings/${id}/violations`);
    if (r.status === 401) { router.replace(`/login?next=/admin/buildings/${id}`); return; }
    if (!r.ok) { router.replace('/dashboard'); return; }
    const d = await r.json();
    setData(d);
    setUnits({ unitCount: d.building.unitCount ?? '', unitCountVerified: d.building.unitCountVerified, unitCountSource: d.building.unitCountSource || '' });
  }
  useEffect(() => { load(); }, [id]);

  async function step(v, s, clear) {
    const r = await fetch(`/api/buildings/${id}/violations/${v.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ step: s, at: clear ? null : undefined }) });
    if (r.ok) load(); else toast.error((await r.json()).error || 'Failed');
  }
  async function evidence(v, e) {
    const r = await fetch(`/api/buildings/${id}/violations/${v.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ evidenceStatus: e }) });
    if (r.ok) load();
  }
  async function saveUnits(e) {
    e.preventDefault();
    const r = await fetch(`/api/buildings/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(units) });
    if (r.ok) { toast.success('Unit count saved'); load(); } else toast.error((await r.json()).error || 'Failed');
  }
  async function add(rows) {
    const r = await fetch(`/api/buildings/${id}/violations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rows) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast.error(d.error || 'Failed'); return false; }
    toast.success(`${d.inserted} added${d.skipped ? `, ${d.skipped} already on file` : ''}${d.errors?.length ? `, ${d.errors.length} rows rejected` : ''}`);
    load(); return true;
  }
  function importCsv() {
    // hpdId,class,unit,description,issuedOn,correctBy  (one per line; description may not contain commas)
    const rows = bulk.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const [hpdId, cls, unit, description, issuedOn, correctBy] = l.split(',').map(x => x?.trim()); return { hpdId, class: cls, unit, description, issuedOn: issuedOn || null, correctBy: correctBy || null }; });
    add(rows).then(ok => ok && setBulk(''));
  }

  if (!data) return <><SiteNav /><div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></>;
  const staff = data.viewerRole === 'bn_staff';
  const list = data.violations.filter(v => filter === 'all' ? true : filter === 'open' ? !v.agencyClosedAt : filter === 'awaiting' ? (!v.agencyClosedAt && v.workCompletedAt) : !!v.agencyClosedAt);

  return (
    <>
      <SiteNav />
      <div className="container max-w-6xl py-8">
        {staff && <Link href="/admin/buildings" className="text-sm text-muted-foreground hover:text-foreground">← Buildings</Link>}
        <div className="mt-4 font-mono text-[10px] uppercase tracking-[2px] text-primary">Violation register</div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{data.building.name}</h1>
        <div className="text-sm text-muted-foreground">{data.building.address}</div>

        <div className="mt-6"><DensityCard density={data.density} /></div>

        {staff && (
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Unit count</CardTitle><CardDescription>Density is only computed from a unit count on file. Mark it verified only when confirmed (DOB/HPD registration, rent roll).</CardDescription></CardHeader>
              <CardContent>
                <form onSubmit={saveUnits} className="grid gap-2 sm:grid-cols-3">
                  <Input inputMode="numeric" placeholder="Units" value={units.unitCount} onChange={e => setUnits({ ...units, unitCount: e.target.value })} />
                  <Input placeholder="Source" value={units.unitCountSource} onChange={e => setUnits({ ...units, unitCountSource: e.target.value })} />
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={units.unitCountVerified} onChange={e => setUnits({ ...units, unitCountVerified: e.target.checked })} /> Verified</label>
                  <Button type="submit" size="sm" className="sm:col-span-3 sm:w-fit">Save</Button>
                </form>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Add violations</CardTitle><CardDescription>One, or paste many: hpdId,class,unit,description,issuedOn,correctBy</CardDescription></CardHeader>
              <CardContent className="space-y-2">
                <form onSubmit={e => { e.preventDefault(); add(one).then(ok => ok && setOne({ ...one, hpdId: '', unit: '', description: '' })); }} className="grid gap-2 sm:grid-cols-6">
                  <Input placeholder="HPD #" value={one.hpdId} onChange={e => setOne({ ...one, hpdId: e.target.value })} />
                  <select value={one.class} onChange={e => setOne({ ...one, class: e.target.value })} className="rounded-md border border-border bg-background px-2 text-sm">{['A', 'B', 'C', 'I'].map(c => <option key={c}>{c}</option>)}</select>
                  <Input placeholder="Unit" value={one.unit} onChange={e => setOne({ ...one, unit: e.target.value })} />
                  <Input required placeholder="Description" value={one.description} onChange={e => setOne({ ...one, description: e.target.value })} className="sm:col-span-3" />
                  <Input type="date" value={one.issuedOn} onChange={e => setOne({ ...one, issuedOn: e.target.value })} className="sm:col-span-2" aria-label="Issued" />
                  <Input type="date" value={one.correctBy} onChange={e => setOne({ ...one, correctBy: e.target.value })} className="sm:col-span-2" aria-label="Correct by" />
                  <Button type="submit" size="sm" className="sm:col-span-2">Add</Button>
                </form>
                <Textarea rows={3} className="font-mono text-xs" placeholder="12345678,C,4C,Lead paint hazard,2026-05-01,2026-06-01" value={bulk} onChange={e => setBulk(e.target.value)} />
                <Button size="sm" variant="outline" onClick={importCsv} disabled={!bulk.trim()}>Import</Button>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="mt-6 flex gap-2">{[['open', 'Open'], ['awaiting', 'Fixed, awaiting HPD'], ['closed', 'Closed'], ['all', 'All']].map(([k, l]) => <Button key={k} size="sm" variant={filter === k ? 'default' : 'outline'} onClick={() => setFilter(k)}>{l}</Button>)}</div>
        <Card className="mt-3">
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="font-mono text-[10px] uppercase tracking-[1.5px] text-muted-foreground"><tr className="border-b border-border"><th className="p-3 text-left">HPD #</th><th className="p-3">Class</th><th className="p-3 text-left">Unit</th><th className="p-3 text-left">Description</th><th className="p-3 text-left">Correct by</th><th className="p-3 text-left">Closure</th><th className="p-3 text-left">Evidence</th></tr></thead>
              <tbody>
                {list.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">None.</td></tr>}
                {list.map(v => (
                  <tr key={v.id} className="border-b border-border/40 align-top last:border-0">
                    <td className="p-3 font-mono text-xs">{v.hpdId || '—'}</td>
                    <td className={`p-3 text-center font-mono ${v.class === 'C' ? 'text-alert-ink' : ''}`}>{v.class}</td>
                    <td className="p-3">{v.unit || '—'}</td>
                    <td className="p-3">{v.description}</td>
                    <td className="p-3 text-xs">{v.correctBy || '—'}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {STEPS.map(([k, l]) => {
                          const done = !!v[k];
                          const canClick = staff || k === 'clientAcceptedAt';
                          return <button key={k} disabled={!canClick} onClick={() => step(v, k, done)} title={done ? new Date(v[k]).toLocaleString() : 'Not yet'} className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[1px] ${done ? 'border-forest/30 text-forest' : 'border-border text-muted-foreground'} ${canClick ? 'hover:border-primary' : 'cursor-default'}`}>{done ? '✓ ' : ''}{l}</button>;
                        })}
                      </div>
                    </td>
                    <td className="p-3">{staff ? <select value={v.evidenceStatus} onChange={e => evidence(v, e.target.value)} className="rounded border border-border bg-background px-1 text-xs">{EVIDENCE.map(e => <option key={e} value={e}>{e.replace('_', ' ')}</option>)}</select> : <span className="text-xs">{v.evidenceStatus.replace('_', ' ')}</span>}</td>
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
