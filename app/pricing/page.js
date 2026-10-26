'use client';

// Build Packages. Three fixed service tiers (Build / Build+Approvals /
// Turnkey) plus a custom/bespoke option. The tier cards here show scope and
// fee basis only — never a dollar total. The one source for a dollar number
// is the rate-card engine behind /quote: every CTA below routes there so a
// prospect's actual range always comes from the same calculation, never a
// second number computed on this page.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, X, Loader2, ArrowRight } from 'lucide-react';
import DNav from '@/components/redesign/d-nav';
import DFooter from '@/components/redesign/d-footer';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { formatMoney } from '@/lib/format';

// Redesign Direction D · BORO_NEST_REDESIGN_BUILD_SPEC.md §4 (D-Screens §01).
// "Do not write a savings-split or 'zero overrun' claim anywhere" on this
// page — the GMP FAQ below used to promise a specific savings-split
// arrangement; reworded to describe the ceiling mechanic only, no
// resolution of what happens to savings (that's a contract term, not
// marketing copy to commit to here).
const TERMS = [
  { q: 'What does "Guaranteed Maximum Price" actually mean?', a: 'The number in your contract is a ceiling, not an estimate. An overage caused by something within our control is ours to absorb, not yours. What happens with savings under the ceiling is set out in your contract.' },
  { q: 'How is contingency handled?', a: 'A contingency line of 10-15% is carried on top of the subtotal (construction plus any required add-ons) in every published range — a reserve against risk, not a markup.' },
  { q: 'How does billing work?', a: 'Milestone-based: 10% at mobilization, 30% at rough-in, 30% at substantial completion of trades, 25% at finishes/inspection, and the final 5% at closeout once punch list items are cleared.' },
  { q: 'Is there a schedule commitment?', a: 'Yes — projects carry a schedule commitment of 0.1% of GMP per day late, capped at 5% of GMP, for delays within our control. Permitting delays, concealed conditions, and client-driven changes are excluded.' },
  { q: 'What’s never included in a build package?', a: 'Kitchen equipment and FF&E, architect/engineer fees, permit fees themselves, and landlord-imposed charges. These are called out again on your specific quote once you run the calculator.' }
];

export default function PricingPage() {
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    fetch('/api/quote/meta').then(r => r.json()).then(setMeta).catch(() => setMeta({ available: false }));
  }, []);

  return (
    <>
      <DNav />
      <div className="bg-[var(--d-forest)] text-[var(--d-ivory)]">
        <div className="container max-w-6xl py-16 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <div className="text-xs uppercase tracking-[0.2em] text-[var(--d-brick-lo)]" style={{ fontFamily: 'var(--font-plex-mono)' }}>Build Packages</div>
            <h1 className="mt-3 font-[900] tracking-tight" style={{ fontFamily: 'var(--font-archivo)', fontSize: 'clamp(32px, 5vw, 52px)' }}>
              Pick how much we carry for you.
            </h1>
            <p className="mt-4 text-[var(--d-mist)]">
              Every package is delivered under one Guaranteed Maximum Price. The difference is how much of the path to opening day — filing, design, procurement — sits inside that one contract with us.
            </p>
          </div>

          {!meta ? (
            <div className="mt-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-[var(--d-brick-lo)]" /></div>
          ) : !meta.available ? (
            <div className="mt-16 text-center">
              <p className="text-[var(--d-mist)]">Package details are temporarily unavailable.</p>
              <Link href="/book-call" className="mt-6 inline-flex h-12 items-center rounded-full bg-[var(--d-brick)] px-6 text-sm font-semibold text-[var(--d-ivory)] hover:opacity-90">Book a scoping call</Link>
            </div>
          ) : (
            <>
              <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {meta.serviceTiers.map(t => <TierCard key={t.key} tier={t} />)}
                <CustomCard />
              </div>

              {/* Equation strip — spec §4: Cost of work + Our fee + Contingency = GMP. */}
              <div className="mt-12 flex flex-wrap items-center justify-center gap-2 rounded-xl border border-[var(--d-hair)] bg-[var(--d-forest-2)] px-6 py-5 text-sm uppercase tracking-widest text-[var(--d-sage)]" style={{ fontFamily: 'var(--font-plex-mono)' }}>
                <span>Cost of work</span><span className="text-[var(--d-brick-lo)]">+</span>
                <span>Our fee</span><span className="text-[var(--d-brick-lo)]">+</span>
                <span>Contingency</span><span className="text-[var(--d-brick-lo)]">=</span>
                <span className="text-[var(--d-ivory)]">Guaranteed Maximum Price</span>
              </div>
            </>
          )}

          {/* Universal Terms — same content for every package, read once here. */}
          <div className="mx-auto mt-20 max-w-2xl">
            <div className="text-center">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--d-brick-lo)]" style={{ fontFamily: 'var(--font-plex-mono)' }}>Universal Terms</div>
              <h2 className="mt-2 font-[800] tracking-tight" style={{ fontFamily: 'var(--font-archivo)', fontSize: 'clamp(24px, 3vw, 32px)' }}>The same rules, every package.</h2>
            </div>
            <Accordion type="single" collapsible className="mt-8">
              {TERMS.map((t, i) => (
                <AccordionItem key={i} value={`t-${i}`} className="border-[var(--d-hair)]">
                  <AccordionTrigger className="text-[var(--d-ivory)] hover:no-underline">{t.q}</AccordionTrigger>
                  <AccordionContent className="text-[var(--d-mist)]">{t.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </div>
      <DFooter />
    </>
  );
}

function TierCard({ tier }) {
  return (
    <div className={`relative flex flex-col rounded-xl border p-6 ${tier.featured ? 'border-[var(--d-brick)] bg-[var(--d-brick)]/10' : 'border-[var(--d-hair)] bg-[var(--d-forest-2)]'}`}>
      {tier.featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--d-brick)] px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--d-ivory)]">
          Most Chosen
        </div>
      )}
      {tier.tierLabel && (
        <span className="w-fit rounded-full border border-[var(--d-hair)] px-2 py-0.5 text-[10px] uppercase tracking-widest text-[var(--d-sage)]" style={{ fontFamily: 'var(--font-plex-mono)' }}>
          {tier.tierLabel}
        </span>
      )}
      <div className="mt-2 text-xl font-bold" style={{ fontFamily: 'var(--font-archivo)' }}>{tier.name}</div>
      <div className="text-xs text-[var(--d-sage)]">{tier.feeLabel}</div>

      <p className="mt-4 text-xs text-[var(--d-mist)]">{tier.forWho}</p>

      <ul className="mt-4 flex-1 space-y-2">
        {tier.inclusions.map(i => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--d-brick-lo)' }} />
            <span>{i}</span>
          </li>
        ))}
        {tier.exclusions.map(e => (
          <li key={e} className="flex items-start gap-2 text-sm text-[var(--d-sage)]">
            <X className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{e}</span>
          </li>
        ))}
      </ul>

      {tier.addOns?.length > 0 && (
        <div className="mt-4 rounded-md border border-[var(--d-hair)] p-3 text-xs text-[var(--d-sage)]">
          <div className="mb-1 font-medium text-[var(--d-ivory)]">Added when applicable</div>
          {tier.addOns.map(a => (
            <div key={a.label} className="flex items-center justify-between py-0.5">
              <span>{a.label}</span>
              <span>{a.atCost ? 'at cost + 10%' : `${formatMoney(a.amountLo, { cents: false })}–${formatMoney(a.amountHi, { cents: false })}`}</span>
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs text-[var(--d-sage)]">{tier.commitment}</p>

      <Link
        href={`/quote?tier=${tier.key}`}
        className={`mt-6 inline-flex h-12 w-full items-center justify-center rounded-full text-sm font-semibold transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--d-brick)] ${tier.featured ? 'bg-[var(--d-brick)] text-[var(--d-ivory)]' : 'border border-[var(--d-hair)] text-[var(--d-ivory)]'}`}
      >
        Get your number <ArrowRight className="ml-2 h-4 w-4" />
      </Link>
    </div>
  );
}

function CustomCard() {
  return (
    <div className="flex flex-col rounded-xl border border-dashed border-[var(--d-hair)] bg-[var(--d-forest-2)] p-6">
      <span className="w-fit rounded-full border border-[var(--d-hair)] px-2 py-0.5 text-[10px] uppercase tracking-widest text-[var(--d-sage)]" style={{ fontFamily: 'var(--font-plex-mono)' }}>Bespoke</span>
      <div className="mt-2 text-xl font-bold" style={{ fontFamily: 'var(--font-archivo)' }}>Custom Package</div>
      <div className="text-xs text-[var(--d-sage)]">Scoped with you, not off a menu</div>

      <p className="mt-4 text-sm text-[var(--d-mist)]">
        Multi-site rollouts, franchise prototypes, or a scope that doesn’t fit a fixed tier — tell us what you’re building and we’ll put a package around it.
      </p>
      <ul className="mt-4 flex-1 space-y-2 text-sm text-[var(--d-mist)]">
        <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--d-brick-lo)' }} /><span>Franchise Rollout / Prototype Cost Book</span></li>
        <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--d-brick-lo)' }} /><span>Multi-site comparison (up to 3 sites)</span></li>
        <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--d-brick-lo)' }} /><span>Compliance-only scopes (LL11/FISP, LL97, HPD violations)</span></li>
      </ul>
      <Link
        href="/quote?custom=1"
        className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-[var(--d-brick)] text-sm font-semibold text-[var(--d-ivory)] transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--d-ivory)]"
      >
        Start a custom scope <ArrowRight className="ml-2 h-4 w-4" />
      </Link>
    </div>
  );
}
