'use client';

// Redesign Direction D · BORO_NEST_REDESIGN_BUILD_SPEC.md §6 (D-Screens §03).
// Spec names 4 roles (Owner/co-op board, Property manager, Operator, Trade
// partner). Our actual backend role taxonomy is 5 (client, management,
// building-rep, expediter, subcontractor) and is load-bearing — it's the
// server-side allowlist signup validates against (SECURITY_HARDENING.md S2)
// and what every access-control check in lib/access.js keys off. Remapping
// the UI to 4 invented categories without a matching backend change would
// either misroute real signups or require a schema change well outside a
// visual redesign. Kept the 5 real roles, restyled to D tokens. Flagged in
// the PR — if you want the role taxonomy itself consolidated to 4, that's a
// product/backend decision, not something to guess at here.
import Link from 'next/link';
import { Building2, Hammer, ShieldCheck, ClipboardCheck, BarChart3, ArrowRight, Sparkles, Clock } from 'lucide-react';
import DNav from '@/components/redesign/d-nav';
import DFooter from '@/components/redesign/d-footer';
import { ROLE_SCHEMAS } from '@/lib/role-schemas';

const ROLES = [
  { key: 'client', title: 'Client', icon: Building2, desc: 'You have a NYC space (commercial or residential) that needs a build-out. Get a GMP ceiling and a dedicated PM.' },
  { key: 'management', title: 'Management Company', icon: BarChart3, desc: 'You manage buildings and want portfolio-wide visibility on TI disbursements and every active project.' },
  { key: 'building-rep', title: 'Building Rep / Board', icon: ShieldCheck, desc: 'Supers, property managers, landlord reps, and co-op / condo board members. Manage inspections and access.' },
  { key: 'expediter', title: 'Expediter', icon: ClipboardCheck, desc: 'You file DOB permits and want a shared queue with all our active project docs.' },
  { key: 'subcontractor', title: 'Subcontractor', icon: Hammer, desc: 'You are a licensed trade. Get bid invitations and 48-hour milestone payments after sign-off.' }
];

export default function JoinPage() {
  return (
    <>
      <DNav />
      <div className="bg-[var(--d-forest)] text-[var(--d-ivory)]">
        <div className="container py-16 md:py-24">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <div className="text-xs uppercase tracking-[0.2em] text-[var(--d-brick-lo)]" style={{ fontFamily: 'var(--font-plex-mono)' }}>Join Boro&Nest</div>
            <h1 className="mt-3 font-[900] tracking-tight" style={{ fontFamily: 'var(--font-archivo)', fontSize: 'clamp(32px, 5vw, 52px)' }}>Which type are you?</h1>
            <p className="mt-4 text-[var(--d-mist)]">Clients, management companies, and building reps get an account instantly. Trade professionals go through a quick verification.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {ROLES.map((r) => {
              const schema = ROLE_SCHEMAS[r.key];
              const isInstant = schema?.mode === 'instant';
              return (
                <Link key={r.key} href={`/join/${r.key}`} className="group relative flex h-full flex-col rounded-xl border border-[var(--d-hair)] bg-[var(--d-forest-2)] p-6 transition-all hover:border-[var(--d-brick)] hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--d-brick)]">
                  <div className="mb-4 grid h-11 w-11 place-items-center rounded-lg bg-[var(--d-brick)]/15 text-[var(--d-brick-lo)]">
                    <r.icon className="h-5 w-5" />
                  </div>
                  <div className="text-lg font-semibold" style={{ fontFamily: 'var(--font-archivo)' }}>{r.title}</div>
                  <p className="mt-2 flex-1 text-sm text-[var(--d-mist)]">{r.desc}</p>
                  <div className="mt-4">
                    {isInstant ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--d-ok)]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--d-ok)' }}>
                        <Sparkles className="h-3 w-3" /> Instant Access
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--d-review)]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--d-review)' }}>
                        <Clock className="h-3 w-3" /> Verification Required
                      </span>
                    )}
                  </div>
                  <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium" style={{ color: 'var(--d-brick-lo)' }}>
                    {isInstant ? 'Create Profile' : 'Start Application'} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="mt-12 text-center text-sm text-[var(--d-mist)]">
            Already have an account? <Link href="/login" className="underline" style={{ color: 'var(--d-brick-lo)' }}>Log in →</Link>
          </div>
        </div>
      </div>
      <DFooter />
    </>
  );
}
