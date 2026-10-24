'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import SiteNav from '@/components/site-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { formatMoney } from '@/lib/format';
import Pill from '@/components/brand/pill';
import { SectionLabel, Figure } from '@/components/brand/stat';

const inputCls = 'w-full min-w-0 rounded-md border border-border bg-background px-2 py-1 text-sm';
const CONDITIONS = ['second_same', 'second_diff', 'white_box', 'raw', 'unknown'];

function sumsByProfile(tradeSplits) {
  const m = new Map();
  for (const s of tradeSplits) m.set(s.profile, (m.get(s.profile) || 0) + (Number(s.pct) || 0));
  return m;
}

export default function RateCardEditor() {
  const [list, setList] = useState([]);
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewErr, setPreviewErr] = useState(null);
  const [input, setInput] = useState({ conceptKey: '', sqft: 1200, borough: 'manhattan', condition: 'second_same', cooking: false, existingHood: false, existingGrease: false, existingExhaust: false, afterHours: false, floors: '' });
  const debounceRef = useRef(null);

  async function load(id) {
    setLoading(true);
    const lr = await fetch('/api/admin/rate-cards');
    if (!lr.ok) { toast.error('Could not load rate cards'); setLoading(false); return; }
    const { cards } = await lr.json();
    setList(cards);
    const targetId = id || cards[0]?.id;
    if (!targetId) { setLoading(false); return; }
    const cr = await fetch(`/api/admin/rate-cards/${targetId}`);
    const { card: c } = await cr.json();
    setCard(c);
    setInput(i => ({ ...i, conceptKey: c.concepts[0]?.conceptKey || '' }));
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // Live preview: recompute on every edit to the draft card or the test
  // inputs, using the exact calculate() path the saved card will use. This is
  // what "results done live from input" means — not a snapshot taken after
  // saving.
  useEffect(() => {
    if (!card || !input.conceptKey) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const r = await fetch('/api/admin/quote/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card, input: { ...input, sqft: Number(input.sqft) || 0, floors: input.floors === '' ? undefined : Number(input.floors) } })
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setPreview(d.result); setPreviewErr(null); }
      else { setPreview(null); setPreviewErr(d.error || 'Could not compute'); }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [card, input]);

  const profileSums = useMemo(() => (card ? sumsByProfile(card.tradeSplits) : new Map()), [card]);
  const publishable = card && card.tradeSplits.length > 0 && [...profileSums.values()].every(v => Math.abs(v - 100) < 0.005);

  function patch(fn) { setCard(c => { const next = structuredClone(c); fn(next); return next; }); }

  async function save() {
    setSaving(true);
    const r = await fetch(`/api/admin/rate-cards/${card.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(card) });
    const d = await r.json().catch(() => ({}));
    setSaving(false);
    if (r.ok) { toast.success('Saved'); setCard(d.card); }
    else toast.error(d.error || 'Could not save');
  }

  async function publish() {
    const r = await fetch(`/api/admin/rate-cards/${card.id}/publish`, { method: 'POST' });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { toast.success(`Version ${d.card.version} is now live`); setCard(d.card); load(card.id); }
    else toast.error(d.error || 'Could not publish');
  }

  if (loading) return <><SiteNav /><div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></>;
  if (!card) return <><SiteNav /><div className="container py-8 text-sm text-muted-foreground">No rate card exists yet. Run <code>npm run seed:rate-card</code>.</div></>;

  return (
    <>
      <SiteNav />
      <div className="container py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <SectionLabel>Quote engine</SectionLabel>
            <h1 className="mt-1 text-2xl tracking-tight">Rate card v{card.version}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Pill tone={card.published ? 'ok' : 'neutral'}>{card.published ? 'Published' : 'Draft'}</Pill>
            {list.length > 1 && (
              <select className={`${inputCls} w-auto`} value={card.id} onChange={e => load(e.target.value)}>
                {list.map(c => <option key={c.id} value={c.id}>v{c.version}{c.published ? ' (live)' : ''}</option>)}
              </select>
            )}
            <Button variant="outline" disabled={card.published || saving} onClick={save}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save draft
            </Button>
            <Button disabled={card.published || !publishable} onClick={publish}>Publish</Button>
          </div>
        </div>

        {card.published && (
          <div className="mb-6 rounded-md border border-sand bg-sand/20 p-3 text-sm text-sand-ink">
            This card is live — quotes have been issued against it, so it is frozen. Changes here will be rejected until a new version is created.
          </div>
        )}
        {!card.published && !publishable && (
          <div className="mb-6 rounded-md border border-alert/50 bg-alert/12 p-3 text-sm text-alert-ink">
            Cannot publish yet: every profile's trade splits must sum to 100.
            {[...profileSums.entries()].map(([p, v]) => <span key={p} className="ml-2 data-mono">{p}={v.toFixed(2)}</span>)}
            {card.tradeSplits.length === 0 && ' No trade splits are entered.'}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Card basics</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Contingency lo %"><input className={inputCls} value={card.contingencyLo} onChange={e => patch(c => c.contingencyLo = e.target.value)} /></Field>
                <Field label="Contingency hi %"><input className={inputCls} value={card.contingencyHi} onChange={e => patch(c => c.contingencyHi = e.target.value)} /></Field>
                <Field label="Min commercial $"><input className={inputCls} value={card.minCommercial} onChange={e => patch(c => c.minCommercial = e.target.value)} /></Field>
                <Field label="Min residential $"><input className={inputCls} value={card.minResidential || ''} onChange={e => patch(c => c.minResidential = e.target.value)} /></Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Concepts</CardTitle>
                <CardDescription>marketSource is internal only — stripped from every public response, never shown to a client or prospect.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {card.concepts.map((c, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2 rounded-md border border-border p-3 sm:grid-cols-6">
                    <Field label="Label" className="sm:col-span-2"><input className={inputCls} value={c.label} onChange={e => patch(x => x.concepts[i].label = e.target.value)} /></Field>
                    <Field label="B&N psf lo"><input className={inputCls} value={c.psfLo ?? ''} placeholder="Model B only" onChange={e => patch(x => x.concepts[i].psfLo = e.target.value || null)} /></Field>
                    <Field label="B&N psf hi"><input className={inputCls} value={c.psfHi ?? ''} placeholder="Model B only" onChange={e => patch(x => x.concepts[i].psfHi = e.target.value || null)} /></Field>
                    <Field label="Model">
                      <select className={inputCls} value={c.defaultModel} onChange={e => patch(x => x.concepts[i].defaultModel = e.target.value)}>
                        <option value="A">A</option><option value="B">B</option>
                      </select>
                    </Field>
                    <Field label="F&amp;B?">
                      <select className={inputCls} value={c.isFnb ? '1' : '0'} onChange={e => patch(x => x.concepts[i].isFnb = e.target.value === '1')}>
                        <option value="0">No</option><option value="1">Yes</option>
                      </select>
                    </Field>
                    <Field label="Market lo"><input className={inputCls} value={c.marketLo ?? ''} onChange={e => patch(x => x.concepts[i].marketLo = e.target.value || null)} /></Field>
                    <Field label="Market hi"><input className={inputCls} value={c.marketHi ?? ''} onChange={e => patch(x => x.concepts[i].marketHi = e.target.value || null)} /></Field>
                    <Field label="Market source (internal only)" className="sm:col-span-2">
                      <input className={inputCls} value={c.marketSource ?? ''} onChange={e => patch(x => x.concepts[i].marketSource = e.target.value || null)} />
                    </Field>
                    <div className="flex items-end justify-end sm:col-span-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => patch(x => x.concepts.splice(i, 1))}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => patch(x => x.concepts.push({ conceptKey: `concept_${x.concepts.length + 1}`, label: 'New concept', psfLo: '100.00', psfHi: '200.00', defaultModel: 'A', isFnb: false, marketLo: null, marketHi: null, marketSource: null, permitWkLo: null, permitWkHi: null, buildWkLo: null, buildWkHi: null, notes: null }))}>
                  <Plus className="mr-1 h-4 w-4" /> Add concept
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Modifiers</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {card.modifiers.map((m, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2 rounded-md border border-border p-3 sm:grid-cols-5">
                    <Field label="Label" className="sm:col-span-2"><input className={inputCls} value={m.label} onChange={e => patch(x => x.modifiers[i].label = e.target.value)} /></Field>
                    <Field label="× lo"><input className={inputCls} value={m.multLo} onChange={e => patch(x => x.modifiers[i].multLo = e.target.value)} /></Field>
                    <Field label="× hi"><input className={inputCls} value={m.multHi} onChange={e => patch(x => x.modifiers[i].multHi = e.target.value)} /></Field>
                    <Field label="Source (internal only)"><input className={inputCls} value={m.source ?? ''} onChange={e => patch(x => x.modifiers[i].source = e.target.value || null)} /></Field>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Adders</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {card.adders.map((a, i) => (
                  <div key={i} className="rounded-md border border-border p-3">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Field label="Label"><input className={inputCls} value={a.label} onChange={e => patch(x => x.adders[i].label = e.target.value)} /></Field>
                      <Field label="Source (internal only)"><input className={inputCls} value={a.source ?? ''} onChange={e => patch(x => x.adders[i].source = e.target.value || null)} /></Field>
                      {!a.tieredOn && <>
                        <Field label="Amount lo"><input className={inputCls} value={a.amountLo ?? ''} onChange={e => patch(x => x.adders[i].amountLo = e.target.value)} /></Field>
                        <Field label="Amount hi"><input className={inputCls} value={a.amountHi ?? ''} onChange={e => patch(x => x.adders[i].amountHi = e.target.value)} /></Field>
                      </>}
                    </div>
                    {a.tieredOn && (
                      <div className="mt-2 space-y-2">
                        <SectionLabel>Tiers (by {a.tieredOn})</SectionLabel>
                        {a.tiers.map((t, ti) => (
                          <div key={ti} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <Field label="Label"><input className={inputCls} value={t.label} onChange={e => patch(x => x.adders[i].tiers[ti].label = e.target.value)} /></Field>
                            <Field label="Max value"><input className={inputCls} value={t.maxValue ?? ''} placeholder="no ceiling" onChange={e => patch(x => x.adders[i].tiers[ti].maxValue = e.target.value || null)} /></Field>
                            <Field label="Amount lo"><input className={inputCls} value={t.amountLo} onChange={e => patch(x => x.adders[i].tiers[ti].amountLo = e.target.value)} /></Field>
                            <Field label="Amount hi"><input className={inputCls} value={t.amountHi} onChange={e => patch(x => x.adders[i].tiers[ti].amountHi = e.target.value)} /></Field>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Trade splits</CardTitle>
                <CardDescription>Each profile (fnb / nonfnb) must sum to exactly 100. This is what blocks publishing today.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-3">
                  {[...profileSums.entries()].map(([p, v]) => (
                    <Pill key={p} tone={Math.abs(v - 100) < 0.005 ? 'ok' : 'problem'}>{p}: {v.toFixed(2)}</Pill>
                  ))}
                  {card.tradeSplits.length === 0 && <span className="text-sm text-muted-foreground">No trade splits entered.</span>}
                </div>
                {card.tradeSplits.map((s, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    <Field label="Profile">
                      <select className={inputCls} value={s.profile} onChange={e => patch(x => x.tradeSplits[i].profile = e.target.value)}>
                        <option value="fnb">fnb</option><option value="nonfnb">nonfnb</option>
                      </select>
                    </Field>
                    <Field label="Trade"><input className={inputCls} value={s.trade} onChange={e => patch(x => x.tradeSplits[i].trade = e.target.value)} /></Field>
                    <Field label="Pct"><input className={inputCls} value={s.pct} onChange={e => patch(x => x.tradeSplits[i].pct = e.target.value)} /></Field>
                    <div className="flex items-end"><Button type="button" variant="ghost" size="sm" onClick={() => patch(x => x.tradeSplits.splice(i, 1))}><Trash2 className="h-4 w-4" /></Button></div>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => patch(x => x.tradeSplits.push({ profile: 'nonfnb', trade: 'New trade', pct: '0.00', seq: x.tradeSplits.length + 1 }))}>
                    <Plus className="mr-1 h-4 w-4" /> Add split
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Live preview — recomputes from the draft above via /api/admin/quote/preview on every change. */}
          <div className="lg:sticky lg:top-20 lg:self-start">
            <Card>
              <CardHeader><CardTitle className="text-base">Test this card — live</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Field label="Concept">
                  <select className={inputCls} value={input.conceptKey} onChange={e => setInput(i => ({ ...i, conceptKey: e.target.value }))}>
                    {card.concepts.map(c => <option key={c.conceptKey} value={c.conceptKey}>{c.label}</option>)}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Sqft"><input type="number" className={inputCls} value={input.sqft} onChange={e => setInput(i => ({ ...i, sqft: e.target.value }))} /></Field>
                  <Field label="Borough">
                    <select className={inputCls} value={input.borough} onChange={e => setInput(i => ({ ...i, borough: e.target.value }))}>
                      <option value="manhattan">Manhattan</option><option value="outer">Outer borough</option>
                    </select>
                  </Field>
                </div>
                <Field label="Condition">
                  <select className={inputCls} value={input.condition} onChange={e => setInput(i => ({ ...i, condition: e.target.value }))}>
                    {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {['cooking', 'afterHours'].map(k => (
                    <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={!!input[k]} onChange={e => setInput(i => ({ ...i, [k]: e.target.checked }))} /> {k}</label>
                  ))}
                  {['existingHood', 'existingGrease', 'existingExhaust'].map(k => (
                    <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={!!input[k]} onChange={e => setInput(i => ({ ...i, [k]: e.target.checked }))} /> {k}</label>
                  ))}
                </div>
                <Field label="Floors (needed for exhaust riser tiering)"><input type="number" className={inputCls} value={input.floors} onChange={e => setInput(i => ({ ...i, floors: e.target.value }))} /></Field>

                <div className="border-t border-border pt-3">
                  {previewErr && <div className="text-sm text-alert-ink">{previewErr}</div>}
                  {preview && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Pill tone={preview.model === 'B' ? 'warn' : 'ok'}>Model {preview.model}</Pill>
                        {preview.disqualified && <Pill tone="problem">Disqualified</Pill>}
                      </div>
                      {preview.modelReason && <div className="text-xs text-muted-foreground">{preview.modelReason}</div>}
                      <Figure size="md">{formatMoney(preview.totalLo, { cents: false })}–{formatMoney(preview.totalHi, { cents: false })}</Figure>
                      <div className="text-xs text-muted-foreground">
                        psf {preview.psfLo}–{preview.psfHi} · construction {formatMoney(preview.constructionLo, { cents: false })}–{formatMoney(preview.constructionHi, { cents: false })} · contingency {formatMoney(preview.contingencyLo, { cents: false })}–{formatMoney(preview.contingencyHi, { cents: false })}
                      </div>
                      {preview.adders.length > 0 && (
                        <ul className="text-xs text-muted-foreground">
                          {preview.adders.map((a, i) => <li key={i}>{a.label}{a.tierLabel ? ` (${a.tierLabel})` : ''}: {formatMoney(a.lo, { cents: false })}–{formatMoney(a.hi, { cents: false })}</li>)}
                        </ul>
                      )}
                      {preview.tradeSplits?.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          <SectionLabel>Trade breakdown</SectionLabel>
                          {preview.tradeSplits.map((t, i) => <div key={i}>{t.trade} ({t.pct}%): {formatMoney(t.lo, { cents: false })}–{formatMoney(t.hi, { cents: false })}</div>)}
                        </div>
                      )}
                      {preview.modelBStructure && (
                        <div className="text-xs text-muted-foreground">
                          <SectionLabel>Model B structure</SectionLabel>
                          Precon {formatMoney(preview.modelBStructure.preconLo, { cents: false })}–{formatMoney(preview.modelBStructure.preconHi, { cents: false })} · Fee {formatMoney(preview.modelBStructure.feeLo, { cents: false })}–{formatMoney(preview.modelBStructure.feeHi, { cents: false })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ label, className = '', children }) {
  return <div className={className}><label className="mb-1 block text-xs text-muted-foreground">{label}</label>{children}</div>;
}
