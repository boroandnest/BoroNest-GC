'use client';

// Playbook §3.1/§3.2/§4, QUOTE_ENGINE_BUILD.md §4. Progressive disclosure:
// the range renders before any contact field is shown — "give the number
// before asking for the email" is the whole point of this page.
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import SiteNav from '@/components/site-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { formatMoney } from '@/lib/format';
import Pill from '@/components/brand/pill';
import { Figure, SectionLabel } from '@/components/brand/stat';

const CONDITIONS = [
  { value: 'second_same', label: 'Second-generation space, same use as before' },
  { value: 'second_diff', label: 'Second-generation space, different use' },
  { value: 'white_box', label: 'White box / vanilla shell' },
  { value: 'raw', label: 'Raw / unimproved space' },
  { value: 'unknown', label: "Haven't been inside yet" }
];

const EXCLUSIONS = [
  'Kitchen equipment', 'FF&E (furniture, fixtures, equipment)', 'Architect/engineer fees',
  'Permit fees', 'Landlord charges', 'After-hours premiums (shown separately, below, when selected)'
];

const CTA_COPY = {
  model_a_review: { title: 'Next: a Buildability Review', body: 'A site walk before you sign the lease — what the space needs, a firmer budget range, a schedule range, and a go/negotiate/walk recommendation. Credited in full against your build contract if you sign within 90 days.' },
  model_b_review: { title: 'Next: a Buildability Review', body: "This concept is typically built open-book: your trade and material costs at actual cost, our fee disclosed up front, and unused contingency split 50/50 at closeout. A Buildability Review sets the real budget before the GMP is fixed." },
  disqualified: { title: "We're probably not the right fit for this one", body: "Boro & Nest takes on commercial projects from about $75,000 up. A project this size is usually better served by a trade contractor directly rather than a general contractor's overhead. We're glad to point you to one if it helps." },
  multi_site: { title: 'Multi-site review', body: 'Comparing sites for one concept? A Multi-Site Review covers up to 3 candidate locations, credited against the winning site. If this is a multi-unit rollout, ask about the Prototype Cost Book too.' },
  quote_check: { title: 'Holding a bid already? Get a free second opinion', body: "Upload the quote you have and we'll return a one-page review within 2 business days: $/sf against NYC benchmarks, line items that look high or low, and what's missing." }
};

export default function QuotePage() {
  return (
    <Suspense fallback={null}>
      <Quote />
    </Suspense>
  );
}

function Quote() {
  const searchParams = useSearchParams();
  // ?tier=approvals pre-selects a fixed tier; ?custom=1 flags a bespoke
  // scope request (tracked, not calculated differently — see
  // lib/quote/calculate.js: an unrecognized key just adds no tier add-ons).
  const presetTier = searchParams.get('custom') === '1' ? 'custom' : (searchParams.get('tier') || '');

  const [meta, setMeta] = useState(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ conceptKey: '', sqft: '', borough: 'manhattan', condition: 'second_same', cooking: false, afterHours: false, existingHood: false, existingGrease: false, existingExhaust: false, floors: '', holdingCompetingBid: false, multiUnit: false, serviceTierKey: presetTier });
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [captured, setCaptured] = useState(null);
  const [contact, setContact] = useState({ contactName: '', contactEmail: '', contactPhone: '', company: '', leaseStatus: '', targetOpen: '' });

  useEffect(() => {
    fetch('/api/quote/meta').then(r => r.json()).then(d => {
      setMeta(d);
      if (d.available && d.concepts[0]) setForm(f => ({ ...f, conceptKey: d.concepts[0].conceptKey }));
    });
  }, []);

  const concept = meta?.concepts?.find(c => c.conceptKey === form.conceptKey);

  async function getRange(e) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch('/api/quote/calculate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, sqft: Number(form.sqft), floors: form.floors || undefined })
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) { setQuote(d); setStep(2); }
    else toast.error(d.error || 'Could not calculate a range');
  }

  async function saveQuote(e) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch('/api/quote/capture', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, sqft: Number(form.sqft), floors: form.floors || undefined, rateCardVersion: quote.rateCardVersion, ...contact })
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) { setCaptured(d); setStep(4); }
    else toast.error(d.error || 'Could not save');
  }

  if (!meta) return <><SiteNav /><div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></>;

  if (!meta.available) {
    return (
      <>
        <SiteNav />
        <div className="container max-w-xl py-16 text-center">
          <h1 className="text-2xl tracking-tight">The calculator is temporarily unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">Please reach out directly and we'll get you a number.</p>
          <Button asChild className="mt-6"><a href="/book-call">Book a scoping call</a></Button>
        </div>
      </>
    );
  }

  const result = quote?.result;
  const cta = captured?.cta;

  return (
    <>
      <SiteNav />
      {/* pb-28: the Ask Nest widget (components/nest-chat.js) is fixed
          bottom-5 right-5 — on a page this short, without extra bottom
          padding it sits directly on top of the primary CTA button. */}
      <div className="container max-w-2xl py-8 pb-28 sm:py-12">
        <SectionLabel>Published price guide</SectionLabel>
        <h1 className="mt-1 text-2xl tracking-tight sm:text-3xl">What will your build-out cost?</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          An order-of-magnitude range, free, before you give us anything. See it first — decide if it's worth a call after.
        </p>

        {/* Step 1 — no contact field anywhere on this screen. */}
        {step === 1 && (
          <Card className="mt-6">
            <CardContent className="space-y-4 pt-6">
              <form onSubmit={getRange} className="space-y-4">
                <div>
                  <Label className="mb-1.5 block text-sm">Concept</Label>
                  <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" value={form.conceptKey} onChange={e => setForm(f => ({ ...f, conceptKey: e.target.value }))}>
                    {meta.concepts.map(c => <option key={c.conceptKey} value={c.conceptKey}>{c.label}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="mb-1.5 block text-sm">Square footage</Label><Input required type="number" min="1" value={form.sqft} onChange={e => setForm(f => ({ ...f, sqft: e.target.value }))} /></div>
                  <div>
                    <Label className="mb-1.5 block text-sm">Borough</Label>
                    <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" value={form.borough} onChange={e => setForm(f => ({ ...f, borough: e.target.value }))}>
                      <option value="manhattan">Manhattan</option>
                      <option value="outer">Outer borough</option>
                    </select>
                  </div>
                </div>
                <div>
                  <Label className="mb-1.5 block text-sm">Current condition</Label>
                  <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}>
                    {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>

                {meta.serviceTiers?.length > 0 && (
                  <div>
                    <Label className="mb-1.5 block text-sm">Build package</Label>
                    <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" value={form.serviceTierKey} onChange={e => setForm(f => ({ ...f, serviceTierKey: e.target.value }))}>
                      <option value="">No package selected yet</option>
                      {meta.serviceTiers.map(t => <option key={t.key} value={t.key}>{t.name}</option>)}
                      <option value="custom">Custom / bespoke scope</option>
                    </select>
                    <p className="mt-1 text-xs text-muted-foreground">Changes the add-on costs below, never the per-sf rate. <a href="/pricing" className="underline">Compare packages</a>.</p>
                  </div>
                )}

                {concept?.isFnb && (
                  <div className="space-y-2 rounded-md border border-border p-3">
                    <SectionLabel>Food &amp; beverage</SectionLabel>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.cooking} onChange={e => setForm(f => ({ ...f, cooking: e.target.checked }))} /> Cooking on site</label>
                    {form.cooking && <>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.existingHood} onChange={e => setForm(f => ({ ...f, existingHood: e.target.checked }))} /> Existing hood I can reuse</label>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.existingGrease} onChange={e => setForm(f => ({ ...f, existingGrease: e.target.checked }))} /> Existing grease interceptor</label>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.existingExhaust} onChange={e => setForm(f => ({ ...f, existingExhaust: e.target.checked }))} /> Existing exhaust riser</label>
                      {!form.existingExhaust && <div><Label className="mb-1.5 block text-sm">Floors in the building</Label><Input type="number" min="1" value={form.floors} onChange={e => setForm(f => ({ ...f, floors: e.target.value }))} /></div>}
                    </>}
                  </div>
                )}
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.afterHours} onChange={e => setForm(f => ({ ...f, afterHours: e.target.checked }))} /> Work must happen after hours</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.holdingCompetingBid} onChange={e => setForm(f => ({ ...f, holdingCompetingBid: e.target.checked }))} /> I'm already holding a quote from another GC</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.multiUnit} onChange={e => setForm(f => ({ ...f, multiUnit: e.target.checked }))} /> This is one of several sites / units</label>

                <Button type="submit" disabled={busy} className="w-full">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} See the range</Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step 2 — the number, exclusions and schedule, with nothing captured yet. */}
        {step === 2 && result && (
          <div className="mt-6 space-y-4">
            <Card>
              <CardContent className="space-y-4 pt-6">
                {result.noPublishedBand ? (
                  <div>
                    <SectionLabel>{concept?.label}</SectionLabel>
                    <Figure size="lg" className="mt-1">Quoted case by case</Figure>
                    <p className="mt-2 text-sm text-muted-foreground">This concept carries enough unknowns that a per-sf range would mislead more than it helps — we price it after a walk-through, open-book.</p>
                  </div>
                ) : (
                  <div>
                    <SectionLabel>{concept?.label} — order of magnitude</SectionLabel>
                    <Figure size="lg" className="mt-1">{formatMoney(result.totalLo, { cents: false })} – {formatMoney(result.totalHi, { cents: false })}</Figure>
                    <p className="mt-1 text-xs text-muted-foreground">${result.psfLo}–${result.psfHi}/sf, including a separate contingency line — never folded into the per-sf number.</p>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={result.model === 'B' ? 'warn' : 'ok'}>Model {result.model}</Pill>
                  {result.modelReason && <span className="text-xs text-muted-foreground">{result.modelReason}</span>}
                </div>

                {result.marketLo && (
                  <div className="rounded-md border border-border p-3 text-xs text-muted-foreground">
                    Published NYC market range for this concept: ${result.marketLo}–${result.marketHi}/sf.
                  </div>
                )}

                {result.serviceTier && (
                  <div className="rounded-md border border-border p-3">
                    <SectionLabel>{result.serviceTier.name} — included above</SectionLabel>
                    <p className="mt-1 text-xs text-muted-foreground">{result.serviceTier.feeLabel}</p>
                    {result.serviceTier.addOns.length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {result.serviceTier.addOns.map(a => (
                          <li key={a.label} className="flex items-center justify-between">
                            <span>{a.label}</span>
                            <span>{a.atCost ? 'at cost + 10%' : `${formatMoney(a.lo, { cents: false })}–${formatMoney(a.hi, { cents: false })}`}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <div className="rounded-md border border-border p-3">
                  <SectionLabel>Not included in this range</SectionLabel>
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                    {EXCLUSIONS.map(x => <li key={x}>{x}</li>)}
                  </ul>
                </div>

                <p className="text-xs text-muted-foreground">
                  This is an estimate, not a bid — the price firms up after a site walk, and moves with scope changes, concealed conditions, or a different condition than assumed above.
                  Schedule (permit time, then construction time, stated separately) is set during your Buildability Review, after permits are issued.
                </p>

                <Button className="w-full" onClick={() => setStep(3)}>Save this quote / send me the breakdown</Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3 — the only screen that asks for contact info. */}
        {step === 3 && (
          <Card className="mt-6">
            <CardHeader><CardTitle className="text-base">Where should we send it?</CardTitle><CardDescription>We'll email the full breakdown and reach out within 2 business hours.</CardDescription></CardHeader>
            <CardContent>
              <form onSubmit={saveQuote} className="space-y-3">
                <div><Label className="mb-1.5 block text-sm">Name</Label><Input required value={contact.contactName} onChange={e => setContact(c => ({ ...c, contactName: e.target.value }))} /></div>
                <div><Label className="mb-1.5 block text-sm">Email</Label><Input type="email" value={contact.contactEmail} onChange={e => setContact(c => ({ ...c, contactEmail: e.target.value }))} /></div>
                <div><Label className="mb-1.5 block text-sm">Phone</Label><Input value={contact.contactPhone} onChange={e => setContact(c => ({ ...c, contactPhone: e.target.value }))} /></div>
                <div><Label className="mb-1.5 block text-sm">Company (optional)</Label><Input value={contact.company} onChange={e => setContact(c => ({ ...c, company: e.target.value }))} /></div>
                <div>
                  <Label className="mb-1.5 block text-sm">Lease status</Label>
                  <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" value={contact.leaseStatus} onChange={e => setContact(c => ({ ...c, leaseStatus: e.target.value }))}>
                    <option value="">Prefer not to say</option>
                    <option value="not_looking">Not actively looking yet</option>
                    <option value="touring">Touring spaces</option>
                    <option value="loi">LOI signed</option>
                    <option value="signed">Lease signed</option>
                  </select>
                </div>
                <div><Label className="mb-1.5 block text-sm">Target open date</Label><Input type="date" value={contact.targetOpen} onChange={e => setContact(c => ({ ...c, targetOpen: e.target.value }))} /></div>
                <Button type="submit" disabled={busy} className="w-full">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send me the breakdown</Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step 4 — CTA by state. */}
        {step === 4 && cta && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">{CTA_COPY[cta].title}</CardTitle>
              {captured.publicRef && <CardDescription>Reference: <span className="data-mono">{captured.publicRef}</span></CardDescription>}
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{CTA_COPY[cta].body}</p>
              {cta === 'model_a_review' && <Button asChild className="w-full"><a href="/book-call">Book a Buildability Review — {concept?.isFnb ? '$2,250' : '$1,250'}</a></Button>}
              {cta === 'model_b_review' && <Button asChild className="w-full"><a href="/book-call">Book a Buildability Review</a></Button>}
              {cta === 'disqualified' && <Button asChild variant="outline" className="w-full"><a href="/services">See what we do take on</a></Button>}
              {cta === 'multi_site' && <Button asChild className="w-full"><a href="/book-call">Book a Multi-Site Review — $4,500</a></Button>}
              {cta === 'quote_check' && <Button asChild className="w-full"><a href="/book-call">Upload your quote for a free Quote Check</a></Button>}
            </CardContent>
          </Card>
        )}

        <div className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">
          Published ranges are Manhattan-basis. Rate card v{meta.version}, effective {meta.effectiveFrom}.
        </div>
      </div>
    </>
  );
}
