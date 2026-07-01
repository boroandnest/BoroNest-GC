import Link from 'next/link';
import SiteNav from '@/components/site-nav';
import SiteFooter from '@/components/site-footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function AboutPage() {
  return (
    <>
      <SiteNav />
      <div className="container py-16 md:py-24">
        <div className="mx-auto max-w-3xl">
          <div className="text-xs font-semibold uppercase tracking-widest text-primary">About</div>
          <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">We build in New York City.</h1>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">Boro & Nest Collective was founded to solve a specific problem: NYC operators — café owners, med-spa founders, boutique fitness studios, homeowners, and co-op boards — kept getting burned by build-outs and compliance jobs that ran over budget, over schedule, and under-communicated.</p>
          <p className="mt-4 leading-relaxed text-muted-foreground">Our answer is the Guaranteed Maximum Price model paired with a closed-loop workflow: QEWI inspection partner, repair GC, DOB closeout tracking, and PACE financing referral — all under one contract with a board-facing transparency portal.</p>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            <Card><CardContent className="p-6"><div className="text-3xl font-bold text-primary">50+</div><div className="mt-1 text-sm text-muted-foreground">Projects delivered</div></CardContent></Card>
            <Card><CardContent className="p-6"><div className="text-3xl font-bold text-primary">$0</div><div className="mt-1 text-sm text-muted-foreground">Cost overruns to date</div></CardContent></Card>
            <Card><CardContent className="p-6"><div className="text-3xl font-bold text-primary">48hr</div><div className="mt-1 text-sm text-muted-foreground">Sub payment turnaround</div></CardContent></Card>
          </div>

          <div className="mt-16">
            <h2 className="text-2xl font-bold">What Guaranteed Maximum Price actually means</h2>
            <p className="mt-3 text-muted-foreground">We agree on a hard ceiling before construction begins. If we come in under the ceiling, savings are shared with you — not pocketed. If we go over, we absorb the overage. That's the model. That's why we exist.</p>
          </div>

          <div className="mt-16 rounded-2xl border border-border bg-card p-8 text-center">
            <h3 className="text-2xl font-bold">Ready to start?</h3>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg"><Link href="/book-call">Book a Scoping Call</Link></Button>
              <Button asChild size="lg" variant="outline"><Link href="/join">Join as Partner</Link></Button>
            </div>
          </div>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
