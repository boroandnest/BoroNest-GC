'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Building2, Hammer, ShieldCheck, ClipboardCheck, BarChart3, ArrowRight, Sparkles, Clock } from 'lucide-react';
import DNav from '@/components/redesign/d-nav';
import DFooter from '@/components/redesign/d-footer';
import { ROLE_SCHEMAS } from '@/lib/role-schemas';

const ROLES = [
  { key: 'client', title: 'Client', icon: Building2, tag: 'Owner / Tenant', desc: 'You have a NYC space (commercial or residential) that needs a build-out. Get a GMP ceiling and a dedicated PM.' },
  { key: 'management', title: 'Management Company', icon: BarChart3, tag: 'Portfolio Ops', desc: 'You manage buildings and want portfolio-wide visibility on TI disbursements and every active project.' },
  { key: 'building-rep', title: 'Building Rep / Board', icon: ShieldCheck, tag: 'Super / Landlord / Board', desc: 'Supers, property managers, landlord reps, and co-op / condo board members. Manage inspections and access.' },
  { key: 'expediter', title: 'Expediter', icon: ClipboardCheck, tag: 'Permits Specialist', desc: 'You file DOB permits and want a shared queue with all our active project docs.' },
  { key: 'subcontractor', title: 'Subcontractor', icon: Hammer, tag: 'Trade Professional', desc: 'You are a licensed trade. Get bid invitations and 48-hour milestone payments after sign-off.' }
];

export default function JoinPage() {
  return (
    <>
      <DNav />
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="absolute -top-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />

        <div className="container relative py-16 md:py-24">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <div className="text-xs font-semibold uppercase tracking-widest text-primary">Join Boro & Nest</div>
            <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">Which type are you?</h1>
            <p className="mt-4 text-muted-foreground">Clients, management companies, and building reps get an account instantly. Trade professionals go through a quick verification.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {ROLES.map((r, i) => {
              const schema = ROLE_SCHEMAS[r.key];
              const isInstant = schema?.mode === 'instant';
              return (
                <motion.div key={r.key} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Link href={`/join/${r.key}`} className="group relative flex h-full flex-col rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/60 hover:-translate-y-1 hover:shadow-xl">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary/10 text-primary">
                        <r.icon className="h-5 w-5" />
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{r.tag}</span>
                    </div>
                    <div className="text-lg font-semibold">{r.title}</div>
                    <p className="mt-2 flex-1 text-sm text-muted-foreground">{r.desc}</p>
                    <div className="mt-4">
                      {isInstant ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                          <Sparkles className="h-3 w-3" /> Instant Access
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-foreground">
                          <Clock className="h-3 w-3" /> Verification Required
                        </span>
                      )}
                    </div>
                    <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                      {isInstant ? 'Create Profile' : 'Start Application'} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>

          <div className="mt-12 text-center text-sm text-muted-foreground">
            Already have an account? <Link href="/login" className="text-primary hover:underline">Log in →</Link>
          </div>
        </div>
      </div>
      <DFooter />
    </>
  );
}
