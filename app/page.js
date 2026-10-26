'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ArrowRight, Building2, Hammer, ShieldCheck, Clock3, DollarSign, ClipboardCheck, Users, MessageSquare, BarChart3, Sparkles, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DNav from '@/components/redesign/d-nav';
import DFooter from '@/components/redesign/d-footer';

const HERO_IMG = 'https://images.pexels.com/photos/18290521/pexels-photo-18290521.jpeg?auto=compress&w=1600';
const INTERIOR_IMG = 'https://images.unsplash.com/photo-1597498178146-3e9378203bc9?w=1200';
const CAFE_IMG = 'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=1200';

const ROLES = [
  { key: 'client', title: 'Clients', desc: 'Commercial tenants + residential owners. Know your ceiling before a nail is driven.', icon: Building2 },
  { key: 'management', title: 'Management Cos.', desc: 'Portfolio-wide visibility on every active build-out and TI disbursement.', icon: BarChart3 },
  { key: 'building-rep', title: 'Building Reps', desc: 'Inspection scheduling, violation tracking, access approvals — all in one queue.', icon: ShieldCheck },
  { key: 'expediter', title: 'Expediters', desc: 'Filing status tracker, DOB inspection calendar, invoice submission portal.', icon: ClipboardCheck },
  { key: 'subcontractor', title: 'Subcontractors', desc: '48-hour milestone payments, bid invitations, tiered performance status.', icon: Hammer }
];

const PHASES = ['Discovery', 'Design', 'Permitting', 'Procurement', 'Construction', 'Punch List', 'Close-Out'];

export default function Home() {
  return (
    <>
      <DNav transparent />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-40" />
        <div className="absolute inset-0 bg-radial-fade" />
        <div className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-primary/10 blur-[120px]" />

        <div className="container relative grid gap-12 py-20 md:grid-cols-2 md:py-28">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" />
              <span>Guaranteed Maximum Price — Zero cost overruns to date</span>
            </div>
            <h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
              NYC Build-Outs,<br />
              <span className="text-gradient-royal">Delivered On Budget.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Boro & Nest manages commercial and residential build-outs on a Guaranteed Maximum Price model. You know your ceiling before a nail is driven — QEWI inspection, repair GC, DOB closeout and PACE financing, all under one contract.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-12 px-6 text-base">
                <Link href="/book-call">Book a Scoping Call <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base">
                <Link href="#how-it-works">See How It Works</Link>
              </Button>
            </div>

            {/* Stat strip */}
            <div className="mt-12 grid grid-cols-3 gap-6 border-t border-border/60 pt-8">
              <Stat value="50+" label="Projects Delivered" />
              <Stat value="$0" label="Cost Overruns (GMP)" />
              <Stat value="48hr" label="Sub Payment Turnaround" />
            </div>
          </motion.div>

          {/* Hero visual */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.1 }} className="relative">
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-border shadow-2xl">
              <img src={HERO_IMG} alt="NYC build-out" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
              {/* Floating GMP card */}
              <div className="absolute bottom-6 left-6 right-6 rounded-xl border border-border bg-card/90 p-4 backdrop-blur-md">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Lume Café — Williamsburg</span>
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">Construction</span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <div className="text-2xl font-bold">$312K <span className="text-sm font-normal text-muted-foreground">GMP</span></div>
                  <div className="text-sm text-primary">62%</div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: '62%' }} />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="border-t border-border/60 py-24">
        <div className="container">
          <div className="mb-12 max-w-2xl">
            <div className="text-xs font-semibold uppercase tracking-widest text-primary">How It Works</div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Seven phases. One workspace. Every party.</h2>
            <p className="mt-4 text-muted-foreground">Every project moves through the same seven phases inside a single collaborative hub — with role-gated views for clients, management, expediters, building reps, and subs.</p>
          </div>

          <div className="grid gap-2 md:grid-cols-7">
            {PHASES.map((p, i) => (
              <div key={p} className="relative rounded-lg border border-border bg-card p-4">
                <div className="text-xs text-muted-foreground">Phase {i + 1}</div>
                <div className="mt-1 text-sm font-semibold">{p}</div>
                {i < PHASES.length - 1 && (
                  <div className="absolute right-0 top-1/2 hidden h-px w-4 -translate-y-1/2 translate-x-full bg-border md:block" />
                )}
              </div>
            ))}
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-3">
            <FeatureCard icon={DollarSign} title="GMP Ceiling" text="Every project is capped. Any savings under the ceiling get split with you — no overruns, ever." />
            <FeatureCard icon={Clock3} title="48-Hour Sub Payments" text="When a milestone is signed off, subs are paid within 48 hours. That's how we retain the best trades." />
            <FeatureCard icon={ShieldCheck} title="Board-Facing Portal" text="For LL11/LL97 work, boards see live filing status, inspection dates, and DOB closeout tracking." />
          </div>
        </div>
      </section>

      {/* ROLE CARDS */}
      <section className="border-t border-border/60 py-24 bg-gradient-to-b from-background to-card/30">
        <div className="container">
          <div className="mb-12 max-w-2xl">
            <div className="text-xs font-semibold uppercase tracking-widest text-primary">Roles</div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">One platform, five personas.</h2>
            <p className="mt-4 text-muted-foreground">Every party in an NYC build-out or compliance job has a tailored workspace. Pick yours to get started.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {ROLES.map(r => (
              <Link key={r.key} href={`/join/${r.key}`} className="group relative flex flex-col rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/60 hover:-translate-y-1">
                <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <r.icon className="h-5 w-5" />
                </div>
                <div className="text-base font-semibold">{r.title}</div>
                <p className="mt-2 flex-1 text-sm text-muted-foreground">{r.desc}</p>
                <div className="mt-4 inline-flex items-center text-sm font-medium text-primary">Apply <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" /></div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* COMPARISON / DIFFERENTIATOR */}
      <section className="border-t border-border/60 py-24">
        <div className="container grid gap-12 md:grid-cols-2 items-center">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-primary">Why Boro & Nest</div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">The only closed loop in NYC.</h2>
            <p className="mt-4 text-muted-foreground">SOCOTEC inspects, but can't repair. ZickLin repairs, but lacks the tech and the LL97 stack. We bundle QEWI inspection, repair GC, PACE financing referral, and DOB closeout under one contract — with a board-facing transparency portal.</p>
            <ul className="mt-6 space-y-3">
              {['Guaranteed Maximum Price on every scope', 'QEWI + repair + closeout under one contract', 'Live board portal for LL11/LL97 filings', 'Mid-market pricing, luxury-firm communication', 'Tiered subcontractor network (Platinum, Gold, Pending)'].map(t => (
                <li key={t} className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8"><Button asChild><Link href="/join">Get started →</Link></Button></div>
          </div>
          <div className="relative aspect-square overflow-hidden rounded-2xl border border-border">
            <img src={CAFE_IMG} alt="Café interior" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-tr from-background/80 to-transparent" />
          </div>
        </div>
      </section>

      {/* CTA STRIP */}
      <section className="border-t border-border/60 py-20">
        <div className="container">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-10 md:p-14">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
            <div className="relative grid gap-8 md:grid-cols-[1fr,auto] md:items-center">
              <div>
                <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">Ready to know your GMP ceiling?</h3>
                <p className="mt-2 text-muted-foreground">Book a 20-minute scoping call. We'll return a Guaranteed Maximum Price within 5 business days.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg"><Link href="/book-call">Book Scoping Call</Link></Button>
                <Button asChild size="lg" variant="outline"><Link href="/join/client">Fill Discovery Form</Link></Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <DFooter />
    </>
  );
}

function Stat({ value, label }) {
  return (
    <div>
      <div className="text-3xl font-bold tracking-tight text-primary">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, text }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-base font-semibold">{title}</div>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
