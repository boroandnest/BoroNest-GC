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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import Pill from '@/components/brand/pill';
import { SectionLabel } from '@/components/brand/stat';
import { formatMoney } from '@/lib/format';

const TERMS = [
  { q: 'What does "Guaranteed Maximum Price" actually mean?', a: 'The number in your contract is a ceiling, not an estimate. If the job costs less than the GMP, the savings are split with you. If it costs more because of something within our control, that overage is ours — not yours.' },
  { q: 'How is contingency handled?', a: 'A contingency line of 10-15% is carried on top of the subtotal (construction plus any required add-ons) in every published range. It’s a reserve against risk, not a markup — unused contingency is part of what gets split at closeout.' },
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
      <div className="container max-w-6xl py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <SectionLabel className="justify-center">Build Packages</SectionLabel>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Pick how much we carry for you.</h1>
          <p className="mt-4 text-muted-foreground">
            Every package is delivered under one Guaranteed Maximum Price. The difference is how much of the path to opening day — filing, design, procurement — sits inside that one contract with us.
          </p>
        </div>

        {!meta ? (
          <div className="mt-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : !meta.available ? (
          <div className="mt-16 text-center">
            <p className="text-muted-foreground">Package details are temporarily unavailable.</p>
            <Button asChild className="mt-6"><Link href="/book-call">Book a scoping call</Link></Button>
          </div>
        ) : (
          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {meta.serviceTiers.map(t => <TierCard key={t.key} tier={t} />)}
            <CustomCard />
          </div>
        )}

        {/* Universal Terms — same content for every package, read once here. */}
        <div className="mx-auto mt-20 max-w-2xl">
          <div className="text-center">
            <SectionLabel className="justify-center">Universal Terms</SectionLabel>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">The same rules, every package.</h2>
          </div>
          <Accordion type="single" collapsible className="mt-8">
            {TERMS.map((t, i) => (
              <AccordionItem key={i} value={`t-${i}`}>
                <AccordionTrigger>{t.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{t.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
      <DFooter />
    </>
  );
}

function TierCard({ tier }) {
  return (
    <Card className={`relative flex flex-col ${tier.featured ? 'border-primary shadow-lg shadow-primary/10' : ''}`}>
      {tier.featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary-foreground">
          Most Chosen
        </div>
      )}
      <CardHeader className="pb-2">
        {tier.tierLabel && <Pill tone="neutral" size="xs">{tier.tierLabel}</Pill>}
        <CardTitle className="mt-2 text-xl">{tier.name}</CardTitle>
        <CardDescription className="text-xs">{tier.feeLabel}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <p className="text-xs text-muted-foreground">{tier.forWho}</p>

        <ul className="mt-4 space-y-2">
          {tier.inclusions.map(i => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{i}</span>
            </li>
          ))}
          {tier.exclusions.map(e => (
            <li key={e} className="flex items-start gap-2 text-sm text-muted-foreground">
              <X className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{e}</span>
            </li>
          ))}
        </ul>

        {tier.addOns?.length > 0 && (
          <div className="mt-4 rounded-md border border-border p-3 text-xs text-muted-foreground">
            <div className="mb-1 font-medium text-foreground">Added when applicable</div>
            {tier.addOns.map(a => (
              <div key={a.label} className="flex items-center justify-between py-0.5">
                <span>{a.label}</span>
                <span>{a.atCost ? 'at cost + 10%' : `${formatMoney(a.amountLo, { cents: false })}–${formatMoney(a.amountHi, { cents: false })}`}</span>
              </div>
            ))}
          </div>
        )}

        <p className="mt-4 text-xs text-muted-foreground">{tier.commitment}</p>

        <Button asChild className="mt-6 w-full" variant={tier.featured ? 'default' : 'outline'}>
          <Link href={`/quote?tier=${tier.key}`}>Get your number <ArrowRight className="ml-2 h-4 w-4" /></Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function CustomCard() {
  return (
    <Card className="flex flex-col border-dashed">
      <CardHeader className="pb-2">
        <Pill tone="strong" size="xs">Bespoke</Pill>
        <CardTitle className="mt-2 text-xl">Custom Package</CardTitle>
        <CardDescription className="text-xs">Scoped with you, not off a menu</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <p className="text-sm text-muted-foreground">
          Multi-site rollouts, franchise prototypes, or a scope that doesn’t fit a fixed tier — tell us what you’re building and we’ll put a package around it.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>Franchise Rollout / Prototype Cost Book</span></li>
          <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>Multi-site comparison (up to 3 sites)</span></li>
          <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>Compliance-only scopes (LL11/FISP, LL97, HPD violations)</span></li>
        </ul>
        <div className="mt-auto pt-6">
          <Button asChild className="w-full">
            <Link href="/quote?custom=1">Start a custom scope <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
