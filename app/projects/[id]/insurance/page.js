'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import SiteNav from '@/components/site-nav';
import CoiChip from '@/components/coi-chip';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { formatMoney } from '@/lib/format';

// Certificates of insurance for one project. What each role sees is decided by the API.
export default function InsurancePage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);

  async function load() {
    const r = await fetch(`/api/projects/${id}/cois`);
    if (r.status === 401) { router.replace(`/login?next=/projects/${id}/insurance`); return; }
    if (!r.ok) { router.replace('/dashboard'); return; }
    setData(await r.json());
  }
  useEffect(() => { load(); }, [id]);

  if (!data) return <><SiteNav /><div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></>;
  const { role, requirements, cois, chips, canSubmit } = data;

  return (
    <>
      <SiteNav />
      <div className="container max-w-5xl py-8">
        <Link href={`/projects/${id}`} className="text-sm text-muted-foreground hover:text-foreground">← Project</Link>
        <div className="mt-4 font-mono text-[10px] uppercase tracking-[2px] text-[var(--d-brick-lo)]">Insurance</div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Certificates of insurance</h1>

        {role === 'bn_staff' && <BuildingSetup projectId={id} requirements={requirements} onSaved={load} />}

        {requirements ? <Requirements r={requirements} /> : (
          <Card className="mt-6"><CardContent className="p-5 text-sm text-muted-foreground">No building requirements on file for this project{role === 'bn_staff' ? ' — attach a building above.' : '.'}</CardContent></Card>
        )}

        {canSubmit && <SubmitCoi projectId={id} onDone={load} />}

        {cois && (
          <Card className="mt-6">
            <CardHeader><CardTitle className="text-base">{role === 'bn_staff' ? 'All certificates' : 'Your certificates'}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {cois.length === 0 && <div className="text-sm text-muted-foreground">None yet.</div>}
              {cois.map(c => <CoiRow key={c.id} c={c} projectId={id} />)}
            </CardContent>
          </Card>
        )}

        {chips && (
          <Card className="mt-6">
            <CardHeader><CardTitle className="text-base">Trades on this project</CardTitle><CardDescription>Insurance status only. Boro &amp; Nest holds the certificates.</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {chips.length === 0 && <div className="text-sm text-muted-foreground">No trades assigned yet.</div>}
              {chips.map((c, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                  <div><div className="font-medium">{c.company}</div><div className="text-xs capitalize text-muted-foreground">{c.trade}</div></div>
                  <div className="text-right"><CoiChip chip={c.chip} /><div className="mt-1 text-[11px] text-muted-foreground">{c.chip.label}</div></div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

function Requirements({ r }) {
  return (
    <Card className="mt-6">
      <CardHeader><CardTitle className="text-base">{r.buildingName} — certificate requirements</CardTitle>
        {r.leadDays !== undefined && <CardDescription>Submit at least <strong>{r.leadDays} {r.leadIsBusinessDays === false ? 'calendar' : 'business'} days</strong> before work. A certificate sent the morning of work means the crew does not enter the building.</CardDescription>}
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[2px] text-muted-foreground">Certificate holder</div>
          <div className="mt-1 text-sm">{r.certificateHolder?.name}<br />{r.certificateHolder?.careOf}<br />{r.certificateHolder?.address}</div>
        </div>
        {r.additionalInsured && (
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[2px] text-muted-foreground">Additional insured — every line, exactly</div>
            <ol className="mt-1 list-decimal pl-5 text-sm">{r.additionalInsured.map((a, i) => <li key={i}>{a}</li>)}</ol>
          </div>
        )}
        {r.requiredGl !== undefined && (
          <div className="text-sm md:col-span-2">
            <div className="font-mono text-[10px] uppercase tracking-[2px] text-muted-foreground">Minimum coverage</div>
            General liability {formatMoney(r.requiredGl, { cents: false })}{r.requiresWc ? " · Workers' compensation" : ''}{r.requiredAuto && r.requiredAuto !== '0.00' ? ` · Auto ${formatMoney(r.requiredAuto, { cents: false })}` : ''}{r.requiredEl && r.requiredEl !== '0.00' ? ` · Employer's liability ${formatMoney(r.requiredEl, { cents: false })}` : ''}
            {r.sendTo?.length > 0 && <div className="mt-1 text-xs text-muted-foreground">Also send to: {r.sendTo.join(', ')}</div>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CoiRow({ c, projectId }) {
  async function open() {
    const r = await fetch(`/api/projects/${projectId}/cois/${c.id}/file`);
    const d = await r.json();
    if (r.ok) window.open(d.url, '_blank', 'noopener'); else toast.error(d.error || 'Not available');
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
      <div>
        <div className="font-medium">{c.holder ? (c.holder.company || c.holder.name) : 'Certificate'} · expires {c.expiresOn}</div>
        <div className="text-xs text-muted-foreground">Submitted {new Date(c.submittedAt).toLocaleDateString()} · GL {formatMoney(c.glLimit, { cents: false })}{c.wcPresent ? ' · WC' : ''}</div>
        {c.compliance && !c.compliance.ok && <div className="mt-1 text-xs text-alert-ink">{c.chip.label}{c.compliance.missingAi?.length ? ` — missing: ${c.compliance.missingAi.join('; ')}` : ''}</div>}
      </div>
      <div className="flex items-center gap-2"><CoiChip chip={c.chip} />{c.hasFile && <Button size="sm" variant="ghost" onClick={open}>View</Button>}</div>
    </div>
  );
}

function SubmitCoi({ projectId, onDone }) {
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch(`/api/projects/${projectId}/cois`, { method: 'POST', body: new FormData(e.currentTarget) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { toast.error(d.error || 'Could not submit'); return; }
    toast.success('Certificate submitted. Boro & Nest will verify it.');
    e.target.reset();
    onDone();
  }
  return (
    <Card className="mt-6">
      <CardHeader><CardTitle className="text-base">Submit a certificate</CardTitle><CardDescription>Enter what is printed on the ACORD 25. We check it against the original before it counts.</CardDescription></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-3">
          <label className="text-xs text-muted-foreground md:col-span-3">Certificate (PDF, PNG or JPG)<Input className="mt-1" type="file" name="file" accept=".pdf,.png,.jpg,.jpeg" required /></label>
          <label className="text-xs text-muted-foreground">General liability each occurrence ($)<Input className="mt-1" name="glLimit" inputMode="decimal" required /></label>
          <label className="text-xs text-muted-foreground">Auto liability ($)<Input className="mt-1" name="autoLimit" inputMode="decimal" /></label>
          <label className="text-xs text-muted-foreground">Employer's liability ($)<Input className="mt-1" name="elLimit" inputMode="decimal" /></label>
          <label className="text-xs text-muted-foreground">Effective date<Input className="mt-1" type="date" name="effectiveOn" /></label>
          <label className="text-xs text-muted-foreground">Expiration date<Input className="mt-1" type="date" name="expiresOn" required /></label>
          <label className="flex items-center gap-2 pt-5 text-sm"><input type="checkbox" name="wcPresent" value="true" /> Workers' compensation included</label>
          <label className="text-xs text-muted-foreground md:col-span-3">Certificate holder as printed<Input className="mt-1" name="certHolderText" /></label>
          <label className="text-xs text-muted-foreground md:col-span-3">Additional insured — one per line, as printed<Textarea className="mt-1" name="additionalInsured" rows={4} /></label>
          <div className="md:col-span-3"><Button type="submit" disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Submit certificate</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}

function BuildingSetup({ projectId, requirements, onSaved }) {
  const [buildings, setBuildings] = useState([]);
  const [form, setForm] = useState({ buildingId: '', unit: '', resident_name: '', resident_phone: '' });
  useEffect(() => { fetch('/api/buildings').then(r => r.ok ? r.json() : { buildings: [] }).then(d => setBuildings(d.buildings)); }, []);
  async function save(e) {
    e.preventDefault();
    const r = await fetch(`/api/projects/${projectId}/building`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ buildingId: form.buildingId || null, unit: { unit: form.unit, resident_name: form.resident_name, resident_phone: form.resident_phone } }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast.error(d.error || 'Could not save'); return; }
    toast.success('Building requirements attached');
    onSaved();
  }
  return (
    <Card className="mt-6">
      <CardHeader><CardTitle className="text-base">Building &amp; unit (staff)</CardTitle><CardDescription>Per-unit additional insured entries are resolved when you save. <Link className="text-[var(--d-brick-lo)] hover:underline" href="/admin/buildings">Manage buildings</Link></CardDescription></CardHeader>
      <CardContent>
        <form onSubmit={save} className="grid gap-3 md:grid-cols-5">
          <select value={form.buildingId} onChange={e => setForm({ ...form, buildingId: e.target.value })} className="rounded-md border border-border bg-background px-3 py-2 text-sm md:col-span-2">
            <option value="">{requirements ? `Keep: ${requirements.buildingName}` : 'Choose a building…'}</option>
            {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <Input placeholder="Unit (4C)" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} />
          <Input placeholder="Resident name" value={form.resident_name} onChange={e => setForm({ ...form, resident_name: e.target.value })} />
          <Input placeholder="Resident phone" value={form.resident_phone} onChange={e => setForm({ ...form, resident_phone: e.target.value })} />
          <div className="md:col-span-5"><Button type="submit" size="sm" disabled={!form.buildingId}>Attach</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}
