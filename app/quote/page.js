'use client';

// Redesign Direction D · BORO_NEST_REDESIGN_BUILD_SPEC.md §5 (D-Screens §02).
// Playbook §3.1/§3.2/§4, QUOTE_ENGINE_BUILD.md §4. Progressive disclosure:
// the range renders before any contact field is shown — "give the number
// before asking for the email" is the whole point of this page.
//
// Four input sections (1 Space, 2 Size + scope, 3 Timing, 4 You) in one
// continuous scroll rather than a hard multi-step wizard — a deliberate
// simplification from the spec's exact wording, flagged in the PR. The
// sticky brick estimate panel and real radio/checkbox chips are not
// simplified: those are built as the spec describes.
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import DNav from '@/components/redesign/d-nav';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { formatMoney } from '@/lib/format';

const CONDITIONS = [
  { value: 'second_same', label: 'Second-gen, same use' },
  { value: 'second_diff', label: 'Second-gen, different use' },
  { value: 'white_box', label: 'White box / vanilla shell' },
  { value: 'raw', label: 'Raw / unimproved' },
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
  const presetTier = searchParams.get('custom') === '1' ? 'custom' : (searchParams.get('tier') || '');

  const [meta, setMeta] = useState(null);
  const [done, setDone] = useState(false); // true once captured -> show the CTA screen
  const [form, setForm] = useState({ conceptKey: '', sqft: 1200, borough: 'manhattan', condition: 'second_same', cooking: false, afterHours: false, existingHood: false, existingGrease: false, existingExhaust: false, floors: '', holdingCompetingBid: false, multiUnit: false, serviceTierKey: presetTier });
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
    if (r.ok) setQuote(d);
    else toast.error(d.error || 'Could not calculate a range');
  }

  async function saveQuote(e) {
    e.preventDefault();
    if (!quote) { toast.error('See your range first'); return; }
    setBusy(true);
    const r = await fetch('/api/quote/capture', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, sqft: Number(form.sqft), floors: form.floors || undefined, rateCardVersion: quote.rateCardVersion, ...contact })
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) { setCaptured(d); setDone(true); }
    else toast.error(d.error || 'Could not save');
  }

  if (!meta) return <><DNav /><div className="flex min-h-[50vh] items-center justify-center bg-[var(--d-forest)]"><Loader2 className="h-6 w-6 animate-spin text-[var(--d-brick-lo)]" /></div></>;

  if (!meta.available) {
    return (
      <>
        <DNav />
        <div className="bg-[var(--d-forest)] text-[var(--d-ivory)]">
          <div className="container max-w-xl py-16 text-center">
            <h1 className="text-2xl tracking-tight">The calculator is temporarily unavailable</h1>
            <p className="mt-2 text-sm text-[var(--d-mist)]">Please reach out directly and we'll get you a number.</p>
            <a href="/book-call" className="mt-6 inline-flex h-12 items-center rounded-full bg-[var(--d-brick)] px-6 text-sm font-semibold">Book a scoping call</a>
          </div>
        </div>
      </>
    );
  }

  const result = quote?.result;
  const cta = captured?.cta;

  if (done && cta) {
    return (
      <>
        <DNav />
        <div className="bg-[var(--d-forest)] text-[var(--d-ivory)]">
          <div className="container max-w-xl py-16 pb-28">
            <div className="rounded-xl border border-[var(--d-hair)] bg-[var(--d-forest-2)] p-6">
              <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-archivo)' }}>{CTA_COPY[cta].title}</h1>
              {captured.publicRef && <p className="mt-1 text-xs text-[var(--d-sage)]" style={{ fontFamily: 'var(--font-plex-mono)' }}>Reference: {captured.publicRef}</p>}
              <p className="mt-4 text-sm text-[var(--d-mist)]">{CTA_COPY[cta].body}</p>
              {cta === 'model_a_review' && <a href="/book-call" className="mt-6 block w-full rounded-full bg-[var(--d-brick)] py-3 text-center text-sm font-semibold">Book a Buildability Review — {concept?.isFnb ? '$2,250' : '$1,250'}</a>}
              {cta === 'model_b_review' && <a href="/book-call" className="mt-6 block w-full rounded-full bg-[var(--d-brick)] py-3 text-center text-sm font-semibold">Book a Buildability Review</a>}
              {cta === 'disqualified' && <a href="/services" className="mt-6 block w-full rounded-full border border-[var(--d-hair)] py-3 text-center text-sm font-semibold">See what we do take on</a>}
              {cta === 'multi_site' && <a href="/book-call" className="mt-6 block w-full rounded-full bg-[var(--d-brick)] py-3 text-center text-sm font-semibold">Book a Multi-Site Review — $4,500</a>}
              {cta === 'quote_check' && <a href="/book-call" className="mt-6 block w-full rounded-full bg-[var(--d-brick)] py-3 text-center text-sm font-semibold">Upload your quote for a free Quote Check</a>}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <DNav />
      <div className="bg-[var(--d-forest)] pb-28 text-[var(--d-ivory)]">
        <div className="container max-w-6xl py-8 sm:py-12">
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--d-brick-lo)]" style={{ fontFamily: 'var(--font-plex-mono)' }}>Published price guide</div>
          <h1 className="mt-1 font-[900] tracking-tight" style={{ fontFamily: 'var(--font-archivo)', fontSize: 'clamp(28px, 4vw, 44px)' }}>What will your build-out cost?</h1>
          <p className="mt-2 text-sm text-[var(--d-mist)]">An order-of-magnitude range, free, before you give us anything. See it first — decide if it's worth a call after.</p>

          <div className="mt-10 grid gap-8 lg:grid-cols-[1fr,380px]">
            {/* Inputs — four labeled sections, one continuous scroll. */}
            <form onSubmit={getRange} className="space-y-10">
              <FormSection n="1" label="Space">
                <FieldLabel>Concept</FieldLabel>
                <ChipGroup>
                  {meta.concepts.map(c => (
                    <Chip key={c.conceptKey} name="conceptKey" value={c.conceptKey} checked={form.conceptKey === c.conceptKey} onChange={() => setForm(f => ({ ...f, conceptKey: c.conceptKey }))}>{c.label}</Chip>
                  ))}
                </ChipGroup>

                <FieldLabel className="mt-6">Borough</FieldLabel>
                <ChipGroup>
                  <Chip name="borough" value="manhattan" checked={form.borough === 'manhattan'} onChange={() => setForm(f => ({ ...f, borough: 'manhattan' }))}>Manhattan</Chip>
                  <Chip name="borough" value="outer" checked={form.borough === 'outer'} onChange={() => setForm(f => ({ ...f, borough: 'outer' }))}>Outer borough</Chip>
                </ChipGroup>

                <FieldLabel className="mt-6">Current condition</FieldLabel>
                <ChipGroup>
                  {CONDITIONS.map(c => (
                    <Chip key={c.value} name="condition" value={c.value} checked={form.condition === c.value} onChange={() => setForm(f => ({ ...f, condition: c.value }))}>{c.label}</Chip>
                  ))}
                </ChipGroup>

                {meta.serviceTiers?.length > 0 && (
                  <>
                    <FieldLabel className="mt-6">Build package</FieldLabel>
                    <ChipGroup>
                      <Chip name="tier" value="" checked={!form.serviceTierKey} onChange={() => setForm(f => ({ ...f, serviceTierKey: '' }))}>Not sure yet</Chip>
                      {meta.serviceTiers.map(t => (
                        <Chip key={t.key} name="tier" value={t.key} checked={form.serviceTierKey === t.key} onChange={() => setForm(f => ({ ...f, serviceTierKey: t.key }))}>{t.name}</Chip>
                      ))}
                      <Chip name="tier" value="custom" checked={form.serviceTierKey === 'custom'} onChange={() => setForm(f => ({ ...f, serviceTierKey: 'custom' }))}>Custom / bespoke</Chip>
                    </ChipGroup>
                    <p className="mt-2 text-xs text-[var(--d-sage)]">Changes the add-on costs only, never the per-sf rate. <a href="/pricing" className="underline">Compare packages</a>.</p>
                  </>
                )}
              </FormSection>

              <FormSection n="2" label="Size + scope">
                <FieldLabel>Square footage — {Number(form.sqft).toLocaleString()} sf</FieldLabel>
                <input
                  type="range" min="200" max="15000" step="100" value={form.sqft}
                  onChange={e => setForm(f => ({ ...f, sqft: e.target.value }))}
                  className="mt-2 w-full accent-[var(--d-brick)]"
                  aria-valuetext={`${Number(form.sqft).toLocaleString()} square feet`}
                />

                {concept?.isFnb && (
                  <div className="mt-6 space-y-3 rounded-md border border-[var(--d-hair)] p-4">
                    <FieldLabel>Food &amp; beverage</FieldLabel>
                    <Toggle checked={form.cooking} onChange={v => setForm(f => ({ ...f, cooking: v }))}>Cooking on site</Toggle>
                    {form.cooking && <>
                      <Toggle checked={form.existingHood} onChange={v => setForm(f => ({ ...f, existingHood: v }))}>Existing hood I can reuse</Toggle>
                      <Toggle checked={form.existingGrease} onChange={v => setForm(f => ({ ...f, existingGrease: v }))}>Existing grease interceptor</Toggle>
                      <Toggle checked={form.existingExhaust} onChange={v => setForm(f => ({ ...f, existingExhaust: v }))}>Existing exhaust riser</Toggle>
                      {!form.existingExhaust && (
                        <div className="pt-1">
                          <FieldLabel>Floors in the building</FieldLabel>
                          <input type="number" min="1" value={form.floors} onChange={e => setForm(f => ({ ...f, floors: e.target.value }))}
                            className="mt-1 w-full rounded-md border border-[var(--d-hair)] bg-[var(--d-forest-2)] px-3 py-2 text-sm text-[var(--d-ivory)]" />
                        </div>
                      )}
                    </>}
                  </div>
                )}

                <div className="mt-4 space-y-3">
                  <Toggle checked={form.afterHours} onChange={v => setForm(f => ({ ...f, afterHours: v }))}>Work must happen after hours</Toggle>
                  <Toggle checked={form.holdingCompetingBid} onChange={v => setForm(f => ({ ...f, holdingCompetingBid: v }))}>I'm already holding a quote from another GC</Toggle>
                  <Toggle checked={form.multiUnit} onChange={v => setForm(f => ({ ...f, multiUnit: v }))}>This is one of several sites / units</Toggle>
                </div>

                <button type="submit" disabled={busy} className="mt-6 flex h-12 w-full items-center justify-center rounded-full bg-[var(--d-brick)] text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60">
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} See the range
                </button>
              </FormSection>

              <FormSection n="3" label="Timing">
                <FieldLabel>Lease status</FieldLabel>
                <ChipGroup>
                  <Chip name="lease" value="" checked={!contact.leaseStatus} onChange={() => setContact(c => ({ ...c, leaseStatus: '' }))}>Prefer not to say</Chip>
                  <Chip name="lease" value="not_looking" checked={contact.leaseStatus === 'not_looking'} onChange={() => setContact(c => ({ ...c, leaseStatus: 'not_looking' }))}>Not actively looking</Chip>
                  <Chip name="lease" value="touring" checked={contact.leaseStatus === 'touring'} onChange={() => setContact(c => ({ ...c, leaseStatus: 'touring' }))}>Touring spaces</Chip>
                  <Chip name="lease" value="loi" checked={contact.leaseStatus === 'loi'} onChange={() => setContact(c => ({ ...c, leaseStatus: 'loi' }))}>LOI signed</Chip>
                  <Chip name="lease" value="signed" checked={contact.leaseStatus === 'signed'} onChange={() => setContact(c => ({ ...c, leaseStatus: 'signed' }))}>Lease signed</Chip>
                </ChipGroup>
                <FieldLabel className="mt-6">Target open date</FieldLabel>
                <input type="date" value={contact.targetOpen} onChange={e => setContact(c => ({ ...c, targetOpen: e.target.value }))}
                  className="mt-1 w-full max-w-xs rounded-md border border-[var(--d-hair)] bg-[var(--d-forest-2)] px-3 py-2 text-sm text-[var(--d-ivory)]" />
              </FormSection>
            </form>

            {/* Estimate panel — brick, sticky on desktop, static on mobile. Server-sourced only. */}
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-xl border border-[var(--d-brick)] bg-[var(--d-brick)]/15 p-6">
                {!result ? (
                  <p className="text-sm text-[var(--d-ivory)]/80">Fill in Space and Size + scope, then "See the range" — your estimate appears here.</p>
                ) : result.noPublishedBand ? (
                  <div>
                    <div className="text-xs uppercase tracking-widest text-[var(--d-brick-lo)]" style={{ fontFamily: 'var(--font-plex-mono)' }}>{concept?.label}</div>
                    <div className="mt-1 text-2xl font-bold">Quoted case by case</div>
                    <p className="mt-2 text-sm text-[var(--d-ivory)]/80">This concept carries enough unknowns that a per-sf range would mislead more than it helps — we price it after a walk-through, open-book.</p>
                  </div>
                ) : (
                  <div>
                    <div className="text-xs uppercase tracking-widest text-[var(--d-brick-lo)]" style={{ fontFamily: 'var(--font-plex-mono)' }}>{concept?.label} — order of magnitude</div>
                    <div className="mt-1 text-3xl font-[900]" style={{ fontFamily: 'var(--font-archivo)' }}>
                      {formatMoney(result.totalLo, { cents: false })}–{formatMoney(result.totalHi, { cents: false })}
                    </div>
                    <p className="mt-1 text-xs text-[var(--d-ivory)]/70">${result.psfLo}–${result.psfHi}/sf, plus a separate contingency line — never folded into the per-sf number.</p>

                    <div className="mt-3 inline-flex items-center rounded-full border border-[var(--d-ivory)]/30 px-2 py-0.5 text-[10px] uppercase tracking-widest">
                      Model {result.model}
                    </div>
                    {result.modelReason && <p className="mt-1 text-xs text-[var(--d-ivory)]/70">{result.modelReason}</p>}

                    {result.marketLo && (
                      <p className="mt-3 text-xs text-[var(--d-ivory)]/70">Published NYC market range: ${result.marketLo}–${result.marketHi}/sf.</p>
                    )}

                    {result.serviceTier && (
                      <div className="mt-3 border-t border-[var(--d-ivory)]/20 pt-3">
                        <div className="text-xs font-semibold">{result.serviceTier.name} — included above</div>
                        <p className="text-xs text-[var(--d-ivory)]/70">{result.serviceTier.feeLabel}</p>
                        {result.serviceTier.addOns.map(a => (
                          <div key={a.label} className="mt-1 flex items-center justify-between text-xs text-[var(--d-ivory)]/70">
                            <span>{a.label}</span>
                            <span>{a.atCost ? 'at cost + 10%' : `${formatMoney(a.lo, { cents: false })}–${formatMoney(a.hi, { cents: false })}`}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 border-t border-[var(--d-ivory)]/20 pt-3 text-xs text-[var(--d-ivory)]/70">
                      <div className="mb-1 font-semibold text-[var(--d-ivory)]">Not included</div>
                      <ul className="list-disc space-y-0.5 pl-4">
                        {EXCLUSIONS.map(x => <li key={x}>{x}</li>)}
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 4 "You" — only the screen that asks for contact info, per spec. */}
              {result && (
                <form onSubmit={saveQuote} className="mt-6 space-y-3 rounded-xl border border-[var(--d-hair)] bg-[var(--d-forest-2)] p-6">
                  <div className="text-xs uppercase tracking-[0.2em] text-[var(--d-brick-lo)]" style={{ fontFamily: 'var(--font-plex-mono)' }}>4 · You</div>
                  <p className="text-xs text-[var(--d-sage)]">We'll email the full breakdown and reach out within 2 business hours.</p>
                  <TextField label="Name" required value={contact.contactName} onChange={v => setContact(c => ({ ...c, contactName: v }))} />
                  <TextField label="Email" type="email" value={contact.contactEmail} onChange={v => setContact(c => ({ ...c, contactEmail: v }))} />
                  <TextField label="Phone" value={contact.contactPhone} onChange={v => setContact(c => ({ ...c, contactPhone: v }))} />
                  <TextField label="Company (optional)" value={contact.company} onChange={v => setContact(c => ({ ...c, company: v }))} />
                  <button type="submit" disabled={busy} className="flex h-12 w-full items-center justify-center rounded-full bg-[var(--d-brick)] text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60">
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send me the breakdown
                  </button>
                </form>
              )}
            </aside>
          </div>

          <div className="mt-10 border-t border-[var(--d-hair)] pt-4 text-xs text-[var(--d-sage)]">
            Published ranges are Manhattan-basis. Rate card v{meta.version}, effective {meta.effectiveFrom}.
          </div>
        </div>
      </div>
    </>
  );
}

function FormSection({ n, label, children }) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--d-brick-lo)]" style={{ fontFamily: 'var(--font-plex-mono)' }}>
        <span className="grid h-5 w-5 place-items-center rounded-full border border-[var(--d-brick-lo)] text-[10px]">{n}</span>
        {label}
      </div>
      {children}
    </section>
  );
}

function FieldLabel({ children, className = '' }) {
  return <div className={`mb-2 text-sm font-medium text-[var(--d-ivory)] ${className}`}>{children}</div>;
}

function ChipGroup({ children }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

// A real radio input, visually hidden, behind a <label><span> chip —
// keyboard/screen-reader native, :focus-visible kept on the span.
function Chip({ name, value, checked, onChange, children }) {
  return (
    <label className="cursor-pointer">
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="peer sr-only" />
      <span className="inline-block rounded-full border border-[var(--d-hair)] px-3 py-1.5 text-sm text-[var(--d-mist)] transition-colors peer-checked:border-[var(--d-brick)] peer-checked:bg-[var(--d-brick)] peer-checked:text-[var(--d-ivory)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--d-brick)]">
        {children}
      </span>
    </label>
  );
}

// A real checkbox, same visually-hidden-behind-a-chip pattern.
function Toggle({ checked, onChange, children }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--d-mist)]">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="peer sr-only" />
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded border border-[var(--d-hair)] text-[var(--d-ivory)] peer-checked:border-[var(--d-brick)] peer-checked:bg-[var(--d-brick)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--d-brick)]">
        {checked && '✓'}
      </span>
      {children}
    </label>
  );
}

function TextField({ label, value, onChange, type = 'text', required = false }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-[var(--d-sage)]">{label}</label>
      <input
        type={type} required={required} value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded-md border border-[var(--d-hair)] bg-[var(--d-forest)] px-3 py-2 text-sm text-[var(--d-ivory)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--d-brick)]"
      />
    </div>
  );
}
