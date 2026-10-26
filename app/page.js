'use client';

// Redesign Direction D · BORO_NEST_REDESIGN_BUILD_SPEC.md §3 (D-Home board).
// Section order is the spec's: hero -> ticker -> letter window -> sticky
// phases -> work strip -> ledger proof -> FAQ lanes -> CTA -> footer. The
// role picker and "why us" comparison from the old homepage aren't in that
// list; both are kept (placed after ledger proof) since they're a real
// conversion path, not filler — flagged for review in the PR body.
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Building2, Hammer, ShieldCheck, ClipboardCheck, BarChart3 } from 'lucide-react';
import DNav from '@/components/redesign/d-nav';
import DFooter from '@/components/redesign/d-footer';
import DMarquee from '@/components/redesign/d-marquee';
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent
} from '@/components/ui/accordion';

// Reference imagery only — unverified for licence per spec's content-
// integrity rule. Replace with owned/licensed photography before launch.
const HERO_IMG = 'https://images.pexels.com/photos/18290521/pexels-photo-18290521.jpeg?auto=compress&w=1600';
const INTERIOR_IMG = 'https://images.unsplash.com/photo-1597498178146-3e9378203bc9?w=1200';
const CAFE_IMG = 'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=1200';
const OFFICE_IMG = 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200';

const TICKER = ['Boutique Retail', 'Coffee / Café', 'Fast Casual', 'Bar / Lounge', 'Full-Service Restaurant', 'Medical / Specialized', 'Fitness', 'Office'];

const PHASES = [
  { n: '01', label: 'Discovery', text: 'Site walk, scope, and the first GMP range — before you sign a lease.' },
  { n: '02', label: 'Design', text: 'Drawings and finishes locked against the budget, not the other way around.' },
  { n: '03', label: 'Permitting', text: 'Filing and expediting tracked in the same workspace your board can see.' },
  { n: '04', label: 'Construction', text: 'The GMP ceiling holds. Milestone draws, 48-hour sub payments.', brick: true },
  { n: '05', label: 'Procurement', text: 'Equipment and long-lead items tracked against the schedule.' },
  { n: '06', label: 'Punch List', text: 'Closeout items logged and verified before final draw.' },
  { n: '07', label: 'Close-Out', text: 'DOB sign-off, certificate of occupancy, final reconciliation.' }
];

const WORK = [
  { img: HERO_IMG, title: 'Sample Project — Build-Out', meta: 'Reference imagery' },
  { img: INTERIOR_IMG, title: 'Sample Project — Interior Fit-Out', meta: 'Reference imagery' },
  { img: CAFE_IMG, title: 'Sample Project — Café Build-Out', meta: 'Reference imagery' },
  { img: OFFICE_IMG, title: 'Sample Project — Office Build-Out', meta: 'Reference imagery' }
];

const ROLES = [
  { key: 'client', title: 'Clients', desc: 'Commercial tenants + residential owners. Know your ceiling before a nail is driven.', icon: Building2 },
  { key: 'management', title: 'Management Cos.', desc: 'Portfolio-wide visibility on every active build-out and TI disbursement.', icon: BarChart3 },
  { key: 'building-rep', title: 'Building Reps', desc: 'Inspection scheduling, violation tracking, access approvals — all in one queue.', icon: ShieldCheck },
  { key: 'expediter', title: 'Expediters', desc: 'Filing status tracker, DOB inspection calendar, invoice submission portal.', icon: ClipboardCheck },
  { key: 'subcontractor', title: 'Subcontractors', desc: '48-hour milestone payments, bid invitations, tiered performance status.', icon: Hammer }
];

const FAQ_LEFT = [
  { q: 'What does "Guaranteed Maximum Price" mean?', a: 'The number in your contract is a ceiling, not an estimate. Cost overruns within our control are ours, never yours.' },
  { q: 'How fast do subs get paid?', a: 'Within 48 hours of a signed-off milestone. It is how we keep the best trades on our network.' },
  { q: 'Do you handle LL11/LL97 compliance too?', a: 'Yes — QEWI inspection, repair GC, and DOB closeout under one contract, with a board-facing portal.' }
];
const FAQ_RIGHT = [
  { q: 'How do I get a price range?', a: 'Use the calculator on our pricing page — a range in under two minutes, no contact info required to see it.' },
  { q: 'What is not included in a published range?', a: 'Kitchen equipment, FF&E, architect/engineer fees, permit fees, and landlord charges. Called out again on your quote.' },
  { q: 'Can I see your current build packages?', a: 'Yes — Build, Build + Approvals, and Turnkey, plus a custom/bespoke option, on the pricing page.' }
];

export default function Home() {
  return (
    <div className="d-anim">
      <DNav transparent />
      <Hero />
      <Ticker />
      <LetterWindow />
      <StickyPhases />
      <WorkStrip />
      <LedgerProof />
      <Roles />
      <FaqLanes />
      <CtaStrip />
      <DFooter />
      <style jsx global>{`
        @media (prefers-reduced-motion: reduce) {
          .d-anim * { animation: none !important; transition: none !important; }
          .d-anim .d-reveal { opacity: 1 !important; transform: none !important; }
        }
      `}</style>
    </div>
  );
}

function Hero() {
  const lines = ['NYC Build-Outs,', 'Delivered', 'On Budget.'];
  return (
    <section className="relative overflow-hidden bg-[var(--d-forest)] text-[var(--d-ivory)]">
      <div className="absolute inset-0">
        <Image
          src={HERO_IMG}
          alt="Warm-toned NYC build-out interior"
          fill
          priority
          sizes="100vw"
          style={{ objectFit: 'cover', objectPosition: '50% 42%' }}
          className="d-hero-img"
        />
        {/* Vertical gradient, then the forest color-blend — the blend is
            what makes a stock photo read as ours. Blend only reads right
            on warm-toned photography (spec's art-direction rule). */}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--d-forest)] via-[var(--d-forest)]/30 to-transparent" />
        <div className="absolute inset-0" style={{ backgroundColor: 'var(--d-forest)', mixBlendMode: 'color', opacity: 0.42 }} />
      </div>

      <div className="container relative grid gap-12 py-28 md:grid-cols-[1.3fr,1fr] md:py-36">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--d-hair)] px-3 py-1 text-xs" style={{ fontFamily: 'var(--font-plex-mono)' }}>
            Guaranteed Maximum Price — published build packages
          </div>
          <h1
            className="leading-[0.95] tracking-tight"
            style={{ fontFamily: 'var(--font-archivo)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-.045em', fontSize: 'clamp(52px, 10vw, 140px)' }}
          >
            {lines.map((line, i) => (
              <span key={line} className="relative block overflow-hidden">
                <span
                  className="d-reveal block"
                  style={{ animation: `d-line-in 1.4s cubic-bezier(.76,0,.24,1) forwards`, animationDelay: `${i * 0.16}s`, transform: 'translateY(100%)', opacity: 0 }}
                >
                  {i === 2 ? <><span style={{ fontFamily: 'var(--font-newsreader)', fontStyle: 'italic', color: 'var(--d-brick-lo)', textTransform: 'none' }}>On</span> Budget.</> : line}
                </span>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-[var(--d-brick)]"
                  style={{ transformOrigin: 'left', animation: 'd-bar-wipe 1.4s cubic-bezier(.76,0,.24,1) forwards', animationDelay: `${i * 0.16}s` }}
                />
              </span>
            ))}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--d-mist)]">
            Boro&Nest manages commercial and residential build-outs on a Guaranteed Maximum Price model. You know your ceiling before a nail is driven — QEWI inspection, repair GC, DOB closeout and PACE financing, all under one contract.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/book-call" className="inline-flex h-12 items-center rounded-full bg-[var(--d-brick)] px-6 text-base font-semibold text-[var(--d-ivory)] transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--d-ivory)]">
              Book a Scoping Call <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link href="#process" className="inline-flex h-12 items-center rounded-full border border-[var(--d-hair)] px-6 text-base font-semibold text-[var(--d-ivory)] transition-colors hover:bg-[var(--d-forest-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--d-ivory)]">
              See How It Works
            </Link>
          </div>
        </div>

        {/* Floating sample ledger card — explicitly labeled sample, no real address (spec's content-integrity rule). */}
        <div className="relative hidden md:block">
          <div className="d-reveal rounded-xl border border-[var(--d-hair)] bg-[var(--d-forest-2)]/90 p-4 backdrop-blur-md" style={{ animation: 'd-rise-in 0.8s cubic-bezier(.22,1,.36,1) forwards', animationDelay: '1.5s', opacity: 0, transform: 'translateY(16px)' }}>
            <div className="flex items-center justify-between text-xs text-[var(--d-sage)]" style={{ fontFamily: 'var(--font-plex-mono)' }}>
              <span>Sample Project — Build + Approvals</span>
              <span className="rounded-full bg-[var(--d-brick)]/20 px-2 py-0.5 text-[var(--d-brick-lo)]">Construction</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <div className="text-2xl font-bold">$312K <span className="text-sm font-normal text-[var(--d-sage)]">GMP</span></div>
              <div className="text-sm" style={{ color: 'var(--d-brick-lo)' }}>62%</div>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--d-forest-3)]">
              <div className="h-full rounded-full bg-[var(--d-brick)]" style={{ width: '62%' }} />
            </div>
            <p className="mt-2 text-[10px] uppercase tracking-widest text-[var(--d-sage)]" style={{ fontFamily: 'var(--font-plex-mono)' }}>Sample data — not a real project</p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes d-line-in { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes d-bar-wipe { 0% { transform: scaleX(0); } 45% { transform: scaleX(1); } 100% { transform: scaleX(1); opacity: 0; } }
        @keyframes d-rise-in { to { opacity: 1; transform: translateY(0); } }
        @keyframes d-hero-zoom { from { transform: scale(1.06); } to { transform: scale(1); } }
        :global(.d-hero-img) { animation: d-hero-zoom 20s ease-out forwards; }
      `}</style>
    </section>
  );
}

function Ticker() {
  return (
    <div className="border-y border-[var(--d-hair)] bg-[var(--d-forest-3)] py-3 text-[var(--d-ivory)]">
      <DMarquee speed={32}>
        {TICKER.map((t) => (
          <span key={t} className="px-6 text-sm uppercase tracking-[0.15em]" style={{ fontFamily: 'var(--font-plex-mono)' }}>
            {t}
          </span>
        ))}
      </DMarquee>
    </div>
  );
}

function LetterWindow() {
  return (
    <section className="relative flex items-center justify-center overflow-hidden bg-[var(--d-forest)] py-20">
      <h2
        aria-hidden="true"
        className="select-none text-center font-[900] leading-none"
        style={{
          fontFamily: 'var(--font-archivo)',
          fontSize: 'clamp(74px, 13.1vw, 189px)',
          color: 'transparent',
          backgroundImage: `url(${HERO_IMG})`,
          backgroundSize: '150% auto',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          animation: 'd-pan 24s ease-in-out infinite alternate'
        }}
      >
        Boro&amp;Nest
      </h2>
      <span className="sr-only">Boro &amp; Nest</span>
      <style jsx>{`
        @keyframes d-pan { from { background-position: 0% 50%; } to { background-position: 100% 50%; } }
      `}</style>
    </section>
  );
}

function StickyPhases() {
  return (
    <section id="process" className="border-t border-[var(--d-hair)] bg-[var(--d-forest)] py-24 text-[var(--d-ivory)]">
      <div className="container">
        <div className="mb-12 max-w-2xl">
          <div className="text-xs uppercase tracking-[0.2em]" style={{ fontFamily: 'var(--font-plex-mono)', color: 'var(--d-brick-lo)' }}>How It Works</div>
          <h3 className="mt-3 font-[800] tracking-tight" style={{ fontFamily: 'var(--font-archivo)', fontSize: 'clamp(28px, 4vw, 44px)' }}>
            Seven phases. One workspace. Every party.
          </h3>
          <p className="mt-4 text-[var(--d-mist)]">Every project moves through the same seven phases inside a single collaborative hub — with role-gated views for clients, management, expediters, building reps, and subs.</p>
        </div>

        <div className="space-y-4 min-[961px]:space-y-0">
          {PHASES.map((p, i) => (
            <div
              key={p.n}
              className={`static rounded-xl border p-6 min-[961px]:sticky ${p.brick ? 'border-[var(--d-brick)] bg-[var(--d-brick)] text-[var(--d-ivory)]' : 'border-[var(--d-hair)] bg-[var(--d-forest-2)]'}`}
              style={{ top: `${40 + i * 20}px` }}
            >
              <div className="flex items-baseline gap-4">
                <span className="text-sm" style={{ fontFamily: 'var(--font-plex-mono)' }}>{p.n}</span>
                <span className="text-xl font-bold">{p.label}</span>
              </div>
              <p className={`mt-2 text-sm ${p.brick ? 'text-[var(--d-ivory)]/90' : 'text-[var(--d-mist)]'}`}>{p.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WorkStrip() {
  return (
    <section id="work" className="border-t border-[var(--d-hair)] bg-[var(--d-forest-3)] py-20">
      <div className="container mb-8">
        <div className="text-xs uppercase tracking-[0.2em] text-[var(--d-brick-lo)]" style={{ fontFamily: 'var(--font-plex-mono)' }}>Work</div>
        <h3 className="mt-3 font-[800] text-[var(--d-ivory)] tracking-tight" style={{ fontFamily: 'var(--font-archivo)', fontSize: 'clamp(28px, 4vw, 44px)' }}>
          A sample of the build-outs we run.
        </h3>
      </div>
      <div className="flex gap-4 overflow-x-auto px-6 pb-4" style={{ scrollSnapType: 'x mandatory' }}>
        {WORK.map((w) => (
          <Link
            key={w.title}
            href="/services"
            className="group relative block w-[280px] shrink-0 overflow-hidden rounded-xl border border-[var(--d-hair)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--d-brick)]"
            style={{ scrollSnapAlign: 'start' }}
          >
            <div className="relative aspect-[4/5] overflow-hidden">
              <Image src={w.img} alt={w.title} fill sizes="280px" style={{ objectFit: 'cover' }} className="transition-transform duration-300 group-hover:scale-[1.04]" />
            </div>
            <div className="bg-[var(--d-forest-2)] p-3 text-[var(--d-ivory)]">
              <div className="text-sm font-semibold">{w.title}</div>
              <div className="text-xs text-[var(--d-sage)]">{w.meta}</div>
            </div>
          </Link>
        ))}
      </div>
      <p className="container mt-2 text-xs text-[var(--d-sage)]">
        Reference imagery. Replace with signed-off project photos before launch.
      </p>
    </section>
  );
}

function LedgerProof() {
  return (
    <section className="border-t border-[var(--d-hair)] bg-[var(--d-forest)] py-20 text-[var(--d-ivory)]">
      <div className="container">
        <div className="rounded-2xl border border-[var(--d-hair)] bg-[var(--d-forest-2)] p-8">
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--d-brick-lo)]" style={{ fontFamily: 'var(--font-plex-mono)' }}>The Ledger</div>
          <div className="mt-6 grid gap-8 sm:grid-cols-3">
            <Ledger value="50+" label="Projects Delivered" />
            <Ledger value="$0" label="Cost Overruns (GMP)" />
            <Ledger value="48hr" label="Sub Payment Turnaround" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Ledger({ value, label }) {
  return (
    <div>
      <div className="font-[900] tracking-tight" style={{ fontFamily: 'var(--font-archivo)', fontSize: 'clamp(32px, 4vw, 56px)' }}>{value}</div>
      <div className="mt-1 text-xs uppercase tracking-widest text-[var(--d-sage)]" style={{ fontFamily: 'var(--font-plex-mono)' }}>{label}</div>
    </div>
  );
}

function Roles() {
  return (
    <section className="border-t border-[var(--d-hair)] bg-[var(--d-forest-3)] py-20 text-[var(--d-ivory)]">
      <div className="container">
        <div className="mb-10 max-w-2xl">
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--d-brick-lo)]" style={{ fontFamily: 'var(--font-plex-mono)' }}>Roles</div>
          <h3 className="mt-3 font-[800] tracking-tight" style={{ fontFamily: 'var(--font-archivo)', fontSize: 'clamp(28px, 4vw, 44px)' }}>One platform, five personas.</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {ROLES.map(r => (
            <Link key={r.key} href={`/join/${r.key}`} className="group relative flex flex-col rounded-xl border border-[var(--d-hair)] bg-[var(--d-forest-2)] p-6 transition-all hover:border-[var(--d-brick)] hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--d-brick)]">
              <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-[var(--d-brick)]/15 text-[var(--d-brick-lo)]">
                <r.icon className="h-5 w-5" />
              </div>
              <div className="text-base font-semibold">{r.title}</div>
              <p className="mt-2 flex-1 text-sm text-[var(--d-mist)]">{r.desc}</p>
              <div className="mt-4 inline-flex items-center text-sm font-medium" style={{ color: 'var(--d-brick-lo)' }}>Apply <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" /></div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqLanes() {
  return (
    <section className="border-t border-[var(--d-hair)] bg-[var(--d-forest)] py-20 text-[var(--d-ivory)]">
      <div className="container">
        <div className="mb-10 max-w-2xl">
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--d-brick-lo)]" style={{ fontFamily: 'var(--font-plex-mono)' }}>FAQ</div>
          <h3 className="mt-3 font-[800] tracking-tight" style={{ fontFamily: 'var(--font-archivo)', fontSize: 'clamp(28px, 4vw, 44px)' }}>Two lanes. Same answers either way.</h3>
        </div>
        <div className="grid gap-8 md:grid-cols-2">
          <Accordion type="single" collapsible>
            {FAQ_LEFT.map((f, i) => (
              <AccordionItem key={i} value={`l-${i}`} className="border-[var(--d-hair)]">
                <AccordionTrigger className="text-[var(--d-ivory)] hover:no-underline">{f.q}</AccordionTrigger>
                <AccordionContent className="text-[var(--d-mist)]">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <Accordion type="single" collapsible>
            {FAQ_RIGHT.map((f, i) => (
              <AccordionItem key={i} value={`r-${i}`} className="border-[var(--d-hair)]">
                <AccordionTrigger className="text-[var(--d-ivory)] hover:no-underline">{f.q}</AccordionTrigger>
                <AccordionContent className="text-[var(--d-mist)]">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}

function CtaStrip() {
  return (
    <section className="border-t border-[var(--d-hair)] bg-[var(--d-forest-3)] py-20 text-[var(--d-ivory)]">
      <div className="container">
        <div className="relative overflow-hidden rounded-2xl border border-[var(--d-hair)] bg-[var(--d-forest-2)] p-10 md:p-14">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[var(--d-brick)]/20 blur-3xl" />
          <div className="relative grid gap-8 md:grid-cols-[1fr,auto] md:items-center">
            <div>
              <h3 className="font-[800] tracking-tight" style={{ fontFamily: 'var(--font-archivo)', fontSize: 'clamp(24px, 3vw, 36px)' }}>Ready to know your GMP ceiling?</h3>
              <p className="mt-2 text-[var(--d-mist)]">Book a 20-minute scoping call. We'll return a Guaranteed Maximum Price within 5 business days.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/book-call" className="inline-flex h-12 items-center rounded-full bg-[var(--d-brick)] px-6 text-base font-semibold text-[var(--d-ivory)] transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--d-ivory)]">Book Scoping Call</Link>
              <Link href="/join/client" className="inline-flex h-12 items-center rounded-full border border-[var(--d-hair)] px-6 text-base font-semibold text-[var(--d-ivory)] transition-colors hover:bg-[var(--d-forest)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--d-ivory)]">Fill Discovery Form</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
