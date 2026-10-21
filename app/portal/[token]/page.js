'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, ShieldCheck, MapPin, Calendar, DollarSign, FileText, CheckCircle2, Circle, Clock, Building2, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatMoney } from '@/lib/format';

const PHASES = ['Discovery', 'Design', 'Permitting', 'Procurement', 'Construction', 'Punch List', 'Close-Out'];

export default function BoardPortal() {
  const params = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/portal/${params.token}`)
      .then(async r => {
        if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Invalid link'); }
        return r.json();
      })
      .then(setData)
      .catch(e => setError(e.message));
  }, [params.token]);

  if (error) return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8 text-center">
      <div>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-destructive/15"><AlertTriangle className="h-7 w-7 text-destructive" /></div>
        <h1 className="mt-6 text-2xl font-bold">Portal unavailable</h1>
        <p className="mt-2 text-muted-foreground">{error}</p>
      </div>
    </div>
  );
  if (!data) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const { project: p, milestones, documents, photos, changeOrders } = data;
  const currentIdx = PHASES.indexOf(p.phase);

  return (
    <div className="min-h-screen bg-background">
      {/* Public portal header */}
      <div className="border-b border-border bg-card">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="text-lg font-bold tracking-tight">Boro <span className="text-primary">&</span> Nest</div>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Collective</span>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium">Board Portal · Read-only</span>
          </div>
        </div>
      </div>

      <div className="container py-8">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">{p.phase}</span>
                {p.complianceType && <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">{p.complianceType}</span>}
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">{p.name}</h1>
              <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {p.address}</div>
              {p.filingStatus && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  <span><strong>DOB Filing Status:</strong> {p.filingStatus}</span>
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">GMP Ceiling</div>
              <div className="text-3xl font-bold text-primary">${(p.gmpCeiling || 0).toLocaleString()}</div>
              <div className="mt-1 text-xs text-muted-foreground">Actual spend: ${(p.actualSpend || 0).toLocaleString()}</div>
              <div className="mt-1 text-xs text-muted-foreground">PM: {p.pmName}</div>
            </div>
          </div>

          {/* Phase stepper */}
          <div className="mt-6">
            <div className="flex justify-between text-xs text-muted-foreground"><span>Phase progression</span><span>{p.percentComplete}% complete</span></div>
            <div className="mt-3 flex gap-1">
              {PHASES.map((ph, i) => (
                <div key={ph} className="flex-1">
                  <div className={`h-1.5 rounded-full ${i <= currentIdx ? 'bg-primary' : 'bg-muted'}`} />
                  <div className={`mt-1.5 text-[10px] font-medium uppercase tracking-wider ${i === currentIdx ? 'text-primary' : i <= currentIdx ? 'text-foreground' : 'text-muted-foreground'}`}>{ph}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <PortalStat icon={Building2} label="Project Type" value={`${p.type} · ${p.subType}`} />
            <PortalStat icon={Calendar} label="Target Complete" value={p.softOpen || 'TBD'} />
            <PortalStat icon={DollarSign} label="Remaining" value={`$${(((p.gmpCeiling || 0) - (p.actualSpend || 0)) / 1000).toFixed(0)}K`} />
            <PortalStat icon={FileText} label="Change Orders" value={changeOrders.length} />
          </div>
        </motion.div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {/* Milestones */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-base font-semibold">Milestone Progress</h2>
            <div className="space-y-2">
              {milestones.map(m => (
                <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
                  {m.status === 'complete' ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : m.status === 'in_progress' ? <Clock className="h-4 w-4 text-primary animate-pulse" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                  <div className="flex-1">
                    <div className="text-sm font-medium">{m.name}</div>
                    <div className="text-xs text-muted-foreground">{m.phase} · Due {new Date(m.dueDate).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Filings & Documents */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-base font-semibold">Filings & Contracts</h2>
            <div className="space-y-2">
              {documents.length === 0 && <div className="text-sm text-muted-foreground">No filings uploaded yet.</div>}
              {documents.map(d => (
                <div key={d.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-primary" />
                    <div>
                      <div className="font-medium">{d.name}</div>
                      <div className="text-[11px] text-muted-foreground">{d.category} · {new Date(d.uploadedAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                  {d.url && <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">View →</a>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Photos */}
        {photos.length > 0 && (
          <div className="mt-6 rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-base font-semibold">Recent Site Photos</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {photos.slice(0, 6).map(ph => (
                <div key={ph.id} className="overflow-hidden rounded-lg border border-border">
                  <img src={ph.url} alt="" className="aspect-video w-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Change orders */}
        {changeOrders.length > 0 && (
          <div className="mt-6 rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-base font-semibold">Change Order Log</h2>
            <div className="space-y-2">
              {changeOrders.map(co => (
                <div key={co.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                  <div>
                    <div className="font-medium">{co.code} · {co.title}</div>
                    <div className="text-xs text-muted-foreground">{co.reasonText}</div>
                    <div className="text-xs text-muted-foreground">{new Date(co.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-primary">{formatMoney(co.costDelta)}</div>
                    <div className="text-[10px] uppercase text-emerald-400">Signed</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-12 rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">This is a live, read-only view of a Boro &amp; Nest Collective project. For questions, contact the PM: <strong className="text-foreground">{p.pmName}</strong></p>
          <p className="mt-2 text-xs text-muted-foreground">© Boro & Nest Collective · <a href="https://boroandnestnyc.com" className="text-primary hover:underline">boroandnestnyc.com</a></p>
        </div>
      </div>
    </div>
  );
}

function PortalStat({ icon: Icon, label, value }) {
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
