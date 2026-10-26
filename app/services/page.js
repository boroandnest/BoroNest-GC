import Link from 'next/link';
import DNav from '@/components/redesign/d-nav';
import DFooter from '@/components/redesign/d-footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, Home, ShieldCheck, DollarSign, CheckCircle2 } from 'lucide-react';

export default function ServicesPage() {
  return (
    <>
      <DNav />
      <div className="container py-16 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-xs font-semibold uppercase tracking-widest text-primary">Services</div>
          <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">Three service lines. One method.</h1>
          <p className="mt-4 text-muted-foreground">Guaranteed Maximum Price on everything. 48-hour sub payments. Live document portal.</p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          <ServiceCard icon={Building2} title="Commercial Build-Outs" price="$150K – $500K" items={['Cafés, med-spas, clinics', 'Boutique fitness, retail', 'Restaurants & F&B', 'ADA compliance, DOB filings', 'Turnkey PM under one contract']} cta="Book Scoping Call" ctaHref="/book-call" />
          <ServiceCard icon={Home} title="Residential Gut Renos" price="$300K – $2M" items={['Full apartment gut renovations', 'Co-op board interface', 'Design coordination', 'Custom millwork & finishes', 'Move-in ready delivery']} cta="Book Scoping Call" ctaHref="/book-call" featured />
          <ServiceCard icon={ShieldCheck} title="LL11 / LL97 Compliance" price="$150 – $280/sqft" items={['QEWI inspection partner', 'Repair GC under one contract', 'PACE financing referral', 'DOB closeout tracking', 'Board-facing portal']} cta="Talk to Nest" ctaHref="#ask-nest" />
        </div>

        <div className="mt-20 rounded-2xl border border-border bg-card p-8 md:p-12">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">The GMP guarantee, in plain English.</h2>
              <p className="mt-3 text-muted-foreground">You approve a scope + drawings. We agree on a ceiling. If we finish under, we split the savings with you. If we run over, we absorb the overage. Zero surprise change orders.</p>
              <div className="mt-6 flex gap-3"><Button asChild><Link href="/about">Learn more →</Link></Button></div>
            </div>
            <div className="space-y-2">
              {['GMP ceiling defined before construction', 'Weekly PM updates + site photos', 'Live document + change order tracking', 'Board-facing portal for LL11/LL97', 'Subs paid within 48 hours of sign-off'].map(t => (
                <div key={t} className="flex items-start gap-3 text-sm"><CheckCircle2 className="h-5 w-5 shrink-0 text-primary" /> <span>{t}</span></div>
              ))}
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
    <Card className={featured ? 'border-primary' : ''}>
      <CardContent className="p-6">
        {featured && <div className="mb-3 inline-block rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">Most requested</div>}
        <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
        <h3 className="mt-4 text-xl font-bold">{title}</h3>
        <div className="mt-1 text-sm text-muted-foreground">{price}</div>
        <ul className="mt-4 space-y-2">
          {items.map(i => <li key={i} className="flex items-start gap-2 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> <span>{i}</span></li>)}
        </ul>
        <Button asChild className="mt-6 w-full" variant={featured ? 'default' : 'outline'}><Link href={ctaHref}>{cta}</Link></Button>
      </CardContent>
    </Card>
  );
}
