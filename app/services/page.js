'use client';

// Redesign Direction D. Not one of the spec's 8 named steps, but the page
// had the new DNav/DFooter from the §2 shell swap while its body stayed on
// the old light shadcn Card components — a visibly broken half-redesign.
// Restyled to D tokens for consistency; content/CTAs unchanged.
import Link from 'next/link';
import DNav from '@/components/redesign/d-nav';
import DFooter from '@/components/redesign/d-footer';
import { Building2, Home, ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';

export default function ServicesPage() {
  return (
    <>
      <DNav />
      <div className="bg-[var(--d-forest)] text-[var(--d-ivory)]">
        <div className="container py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-xs uppercase tracking-[0.2em] text-[var(--d-brick-lo)]" style={{ fontFamily: 'var(--font-plex-mono)' }}>Services</div>
            <h1 className="mt-3 font-[900] tracking-tight" style={{ fontFamily: 'var(--font-archivo)', fontSize: 'clamp(32px, 5vw, 52px)' }}>Three service lines. One method.</h1>
            <p className="mt-4 text-[var(--d-mist)]">Guaranteed Maximum Price on everything. 48-hour sub payments. Live document portal.</p>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-3">
            <ServiceCard icon={Building2} title="Commercial Build-Outs" price="$150K – $500K" items={['Cafés, med-spas, clinics', 'Boutique fitness, retail', 'Restaurants & F&B', 'ADA compliance, DOB filings', 'Turnkey PM under one contract']} cta="Book Scoping Call" ctaHref="/book-call" />
            <ServiceCard icon={Home} title="Residential Gut Renos" price="$300K – $2M" items={['Full apartment gut renovations', 'Co-op board interface', 'Design coordination', 'Custom millwork & finishes', 'Move-in ready delivery']} cta="Book Scoping Call" ctaHref="/book-call" featured />
            <ServiceCard icon={ShieldCheck} title="LL11 / LL97 Compliance" price="$150 – $280/sqft" items={['QEWI inspection partner', 'Repair GC under one contract', 'PACE financing referral', 'DOB closeout tracking', 'Board-facing portal']} cta="Talk to Nest" ctaHref="#ask-nest" />
          </div>

          <div className="mt-20 rounded-2xl border border-[var(--d-hair)] bg-[var(--d-forest-2)] p-8 md:p-12">
            <div className="grid gap-8 md:grid-cols-2 md:items-center">
              <div>
                <h2 className="font-[800] tracking-tight" style={{ fontFamily: 'var(--font-archivo)', fontSize: 'clamp(24px, 3vw, 36px)' }}>The GMP guarantee, in plain English.</h2>
                <p className="mt-3 text-[var(--d-mist)]">You approve a scope + drawings. We agree on a ceiling. If we finish under, we split the savings with you. If we run over, we absorb the overage. Zero surprise change orders.</p>
                <div className="mt-6">
                  <Link href="/about" className="inline-flex h-11 items-center rounded-full bg-[var(--d-brick)] px-5 text-sm font-semibold transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--d-ivory)]">
                    Learn more <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </div>
              </div>
              <div className="space-y-2">
                {['GMP ceiling defined before construction', 'Weekly PM updates + site photos', 'Live document + change order tracking', 'Board-facing portal for LL11/LL97', 'Subs paid within 48 hours of sign-off'].map(t => (
                  <div key={t} className="flex items-start gap-3 text-sm">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: 'var(--d-brick-lo)' }} />
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <DFooter />
    </>
  );
}

function ServiceCard({ icon: Icon, title, price, items, cta, ctaHref, featured }) {
  return (
    <div className={`flex flex-col rounded-xl border p-6 ${featured ? 'border-[var(--d-brick)] bg-[var(--d-brick)]/10' : 'border-[var(--d-hair)] bg-[var(--d-forest-2)]'}`}>
      {featured && (
        <div className="mb-3 w-fit rounded-full bg-[var(--d-brick)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--d-ivory)]">Most requested</div>
      )}
      <div className="grid h-11 w-11 place-items-center rounded-lg bg-[var(--d-brick)]/15 text-[var(--d-brick-lo)]"><Icon className="h-5 w-5" /></div>
      <h3 className="mt-4 text-xl font-bold" style={{ fontFamily: 'var(--font-archivo)' }}>{title}</h3>
      <div className="mt-1 text-sm text-[var(--d-sage)]">{price}</div>
      <ul className="mt-4 flex-1 space-y-2">
        {items.map(i => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--d-brick-lo)' }} />
            <span>{i}</span>
          </li>
        ))}
      </ul>
      <Link
        href={ctaHref}
        className={`mt-6 inline-flex h-11 w-full items-center justify-center rounded-full text-sm font-semibold transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--d-brick)] ${featured ? 'bg-[var(--d-brick)] text-[var(--d-ivory)]' : 'border border-[var(--d-hair)] text-[var(--d-ivory)]'}`}
      >
        {cta}
      </Link>
    </div>
  );
}
