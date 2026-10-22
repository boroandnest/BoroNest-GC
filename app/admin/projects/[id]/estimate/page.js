'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import SiteNav from '@/components/site-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, AlertTriangle } from 'lucide-react';
import { formatMoney, formatQty } from '@/lib/format';

// GMP worksheet. Every figure on this page comes from the API (lib/money on the server).
// This component does no arithmetic: it only renders strings.
export default function EstimatePage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [templateId, setTemplateId] = useState('');
  const [inputs, setInputs] = useState({});
  const [startDate, setStartDate] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch(`/api/projects/${id}/estimate`);
    if (r.status === 401) { router.replace(`/login?next=/admin/projects/${id}/estimate`); return; }
    if (!r.ok) { toast.error('Not available'); router.replace('/admin'); return; }
    const d = await r.json();
    setData(d);
    const est = d.project.estimate;
    const tid = est?.templateId || d.templates[0]?.id || '';
    setTemplateId(tid);
    setInputs(est?.templateId === tid ? est.inputs : {});
    setStartDate(est?.startDate || '');
  }
  useEffect(() => { load(); }, [id]);

  async function instantiate(e) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch(`/api/projects/${id}/estimate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId, inputs, startDate: startDate || undefined })
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { toast.error(d.error || 'Could not build estimate'); return; }
    toast.success(`Scope updated: ${d.inserted} added, ${d.updated} updated${d.orphaned ? `, ${d.orphaned} flagged` : ''}`);
    load();
  }

  if (!data) return <><SiteNav /><div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></>;
  const { project: p, rows, rollup, staleCount, templates } = data;
  const tpl = templates.find(t => t.id === templateId);

  return (
    <>
      <SiteNav />
      <div className="container py-8">
        <Link href={`/projects/${p.id}`} className="text-sm text-muted-foreground hover:text-foreground">← {p.name}</Link>
        <div className="mt-4">
          <div className="font-mono text-[10px] uppercase tracking-[2px] text-primary">{p.code || 'Project'} · GMP worksheet</div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Estimate</h1>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <Figure label="Scope total" value={formatMoney(rollup.scopeTotal)} sub={`${formatMoney(rollup.baseTotal)} + tariff`} />
          <Figure label="Tariff exposure" value={formatMoney(rollup.tariffTotal)} />
          <Figure label="Contingency" value={formatMoney(rollup.contingency)} />
          <Figure label="Proposed ceiling" value={formatMoney(rollup.proposedCeiling)} strong sub={`Current GMP ${formatMoney(p.gmpCeiling)}`} />
        </div>

        {staleCount > 0 && (
          <div className="mt-4 flex items-center gap-2 rounded-md border border-alert/50 bg-alert/12 p-3 text-sm text-alert-ink">
            <AlertTriangle className="h-4 w-4" /> {staleCount} line{staleCount === 1 ? '' : 's'} priced on unit costs older than 120 days. Verify before setting the ceiling.
          </div>
        )}

        <Card className="mt-6">
          <CardHeader><CardTitle className="text-base">Build from template</CardTitle><CardDescription>Re-running updates existing lines in place; status, assignments and change-order blocks are kept.</CardDescription></CardHeader>
          <CardContent>
            {templates.length === 0 ? (
              <div className="text-sm text-muted-foreground">No templates yet. <Link className="text-primary hover:underline" href="/admin/templates">Create one</Link>.</div>
            ) : (
              <form onSubmit={instantiate} className="space-y-3">
                <div className="flex flex-wrap gap-3">
                  <select value={templateId} onChange={e => { setTemplateId(e.target.value); setInputs({}); }} className="rounded-md border border-border bg-background px-3 py-2 text-sm">
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-44" aria-label="Start date" />
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  {(tpl?.inputs || []).map(i => (
                    <label key={i.name} className="text-xs text-muted-foreground">
                      {i.label}{i.unit ? ` (${i.unit})` : ''}
                      <Input className="mt-1" inputMode="decimal" placeholder={i.defaultVal} value={inputs[i.name] ?? ''} onChange={e => setInputs({ ...inputs, [i.name]: e.target.value })} />
                    </label>
                  ))}
                </div>
                <Button type="submit" disabled={busy || !templateId}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {p.estimate ? 'Re-build scope' : 'Build scope'}</Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="font-mono text-[10px] uppercase tracking-[1.5px] text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="p-3 text-left">Trade</th><th className="p-3 text-left">Title</th><th className="p-3 text-right">Qty</th><th className="p-3 text-left">Unit</th>
                  <th className="p-3 text-right">Unit cost</th><th className="p-3 text-right">Tariff exposure</th><th className="p-3 text-right">Line total</th>
                  <th className="p-3 text-left">Specified product</th><th className="p-3 text-left">Domestic alternative</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">No scope lines yet.</td></tr>}
                {rows.map(r => (
                  <tr key={r.id} className={`border-b border-border/40 last:border-0 ${r.staleCost ? 'bg-alert/12' : ''}`}>
                    <td className="p-3 capitalize">{r.trade}</td>
                    <td className="p-3">
                      <div className="font-medium">{r.title}</div>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {r.staleCost && <span className="rounded border border-alert/50 px-1.5 font-mono text-[9px] uppercase tracking-[1.5px] text-alert-ink">Verify pricing · {r.costAgeDays}d old</span>}
                        {r.orphaned && <span className="rounded border border-border px-1.5 font-mono text-[9px] uppercase tracking-[1.5px] text-muted-foreground">Not in template</span>}
                        {r.plannedStart && <span className="font-mono text-[9px] text-muted-foreground">{r.plannedStart} → {r.plannedEnd}</span>}
                      </div>
                    </td>
                    <td className="p-3 text-right font-mono">{formatQty(r.quantity)}</td>
                    <td className="p-3 text-muted-foreground">{r.unit}</td>
                    <td className="p-3 text-right font-mono">{formatMoney(r.unitCost)}</td>
                    <td className="p-3 text-right font-mono">{r.hasTariff ? <>{formatMoney(r.tariffExposure)}<div className="text-[10px] text-muted-foreground">{r.tariffPct}%{r.sourcingOrigin ? ` · ${r.sourcingOrigin}` : ''}</div></> : '—'}</td>
                    <td className="p-3 text-right font-mono font-semibold">{formatMoney(r.lineTotal)}</td>
                    <td className="p-3 text-xs">{[r.specifiedMfr, r.specifiedProduct].filter(Boolean).join(' — ') || '—'}</td>
                    <td className="p-3 text-xs">{r.hasTariff && r.altDomesticMfr ? <span className="text-primary">{r.altDomesticMfr}</span> : (r.altDomesticMfr || '—')}</td>
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

function Figure({ label, value, sub, strong }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="font-mono text-[10px] uppercase tracking-[2px] text-muted-foreground">{label}</div>
        <div className={`mt-2 font-mono text-2xl ${strong ? 'font-bold text-primary' : 'font-semibold'}`}>{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}
