# Quote Engine — Build Spec

**Branch:** `feat/quote-engine`
**Base:** `main` with Phase 1 and Phase 2 T1–T5 merged
**Runs in parallel with Phase 3a.** No dependency on the compliance spine.
**Source of truth for all numbers:** `Boro & Nest Pricing and Sales Playbook` §3.3, §3.2, §3.5, §5

---

## 0. The architecture decision

**This is not a separate calculator. It is a restricted public view of the estimating engine from Phase 2.**

One rate card. One pure calculation function. Two projections — public and staff — using the same role-gating pattern as Phase 1 §4.

```
                    ┌──────────────────────────┐
                    │  rate_cards (versioned)  │
                    │  concepts · modifiers    │
                    │  adders · trade splits   │
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │  lib/quote/calculate.ts  │
                    │  pure · Decimal · tested │
                    └────────────┬─────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              ▼                                     ▼
   ┌─────────────────────┐              ┌──────────────────────┐
   │  projectPublic()    │              │  projectStaff()      │
   │  range · schedule   │              │  + trade splits      │
   │  exclusions · CTA   │              │  + margin            │
   │  NO margin          │              │  + routing           │
   │  NO trade splits    │              │  + Model B structure │
   └──────────┬──────────┘              └──────────┬───────────┘
              ▼                                     ▼
       /quote (public)                    /app/admin/quote
              │                                     │
              └──────────► quotes table ◄───────────┘
                                 │
                                 ▼
                          project (on conversion)
```

**If these become two codebases they will drift**, and then you publish $215/sf on the website while the estimator says $240. The entire premise of the playbook — "know the cost before you sign" — dies the first time a client holds you to a public number you can't hit.

---

## 1. Four rules the engine must encode

Each is a direct requirement from the playbook, not a design preference.

**1 · The rate card is versioned.** §12 says re-price after the first three jobs. Every quote stores which card version produced it. Six months later when a prospect says "you quoted me $215/sf," you reproduce exactly what the calculator said and why. Same discipline as `statutory_dates.rule_version` in Phase 3.

**2 · Model A/B routing is automatic.** §3.3 is explicit: full-service restaurant, medical, and anything with unknown existing conditions is Model B. The calculator detects this and switches output. A fixed $/sf handed to a full-service restaurant with unknown conditions is a change-order fight scheduled for month three.

**3 · Contingency is a separate line, always.** §3.3: show 10–15% separately in every budget. "Hiding contingency is how competitors' low bids become change orders." A calculator that folds it in to look cheaper destroys the positioning.

**4 · Exclusions are a first-class output.** §3.3: "Say so on every page." Kitchen equipment, FF&E, A/E fees, permits, landlord charges, after-hours premiums. Rendered as a block beside the number, not as small print beneath it.

---

## 2. Schema

```sql
-- ── versioned rate cards ────────────────────────────────────────
create table rate_cards (
  id             uuid primary key default gen_random_uuid(),
  version        int  not null unique,
  effective_from date not null,
  effective_to   date,                      -- null = current
  published      boolean default false,     -- the one /quote reads
  contingency_lo numeric(4,2) not null default 10,
  contingency_hi numeric(4,2) not null default 15,
  min_commercial numeric(12,2) not null default 75000,
  notes          text,
  created_by     uuid references profiles(id),
  created_at     timestamptz default now()
);

create unique index one_published on rate_cards (published) where published;

create table rate_concepts (
  id            uuid primary key default gen_random_uuid(),
  rate_card_id  uuid references rate_cards(id) on delete cascade,
  concept_key   text not null,
  label         text not null,
  psf_lo        numeric(8,2) not null,
  psf_hi        numeric(8,2) not null,
  default_model char(1) not null check (default_model in ('A','B')),
  is_fnb        boolean default false,
  permit_wk_lo  int, permit_wk_hi int,
  build_wk_lo   int, build_wk_hi  int,
  market_lo     numeric(8,2),              -- for the comparison table
  market_hi     numeric(8,2),
  market_source text,                      -- 'LOD Construction, 2026'
  unique (rate_card_id, concept_key)
);

create table rate_modifiers (
  id           uuid primary key default gen_random_uuid(),
  rate_card_id uuid references rate_cards(id) on delete cascade,
  key          text not null,              -- outer_borough | after_hours | cond_raw
  label        text not null,
  mult_lo      numeric(5,3) not null,
  mult_hi      numeric(5,3) not null,
  applies_to   text[] default '{}',        -- empty = all concepts
  source       text,
  customer_explain text,
  unique (rate_card_id, key)
);

create table rate_adders (
  id           uuid primary key default gen_random_uuid(),
  rate_card_id uuid references rate_cards(id) on delete cascade,
  key          text not null,              -- hood | grease_interceptor | exhaust_riser
  label        text not null,
  trigger      jsonb not null,             -- {"fnb": true, "cooking": true, "not_existing": "hood"}
  amount_lo    numeric(12,2),
  amount_hi    numeric(12,2),
  tiered_on    text,                       -- 'floors' when the adder is tiered
  source       text,
  unique (rate_card_id, key)
);

create table rate_adder_tiers (
  id        uuid primary key default gen_random_uuid(),
  adder_id  uuid references rate_adders(id) on delete cascade,
  label     text not null,                 -- 'Low-rise (≤6 floors)'
  max_value int,                           -- null = no ceiling
  amount_lo numeric(12,2) not null,
  amount_hi numeric(12,2) not null,
  seq       int not null
);

create table rate_trade_splits (
  id           uuid primary key default gen_random_uuid(),
  rate_card_id uuid references rate_cards(id) on delete cascade,
  profile      text not null,              -- 'fnb' | 'nonfnb'
  trade        text not null,
  pct          numeric(5,2) not null,
  seq          int not null,
  unique (rate_card_id, profile, trade)
);
```

**Constraint worth adding:** a check that each `(rate_card_id, profile)` split set sums to 100. A card whose splits sum to 97 produces line items that don't reconcile to the total, and a client comparing bids will find it.

### The quote record

```sql
create table quotes (
  id            uuid primary key default gen_random_uuid(),
  public_ref    text unique not null,       -- 'BN-Q-7K2M', short enough to read aloud
  rate_card_version int not null,           -- NEVER nullable

  -- inputs, stored verbatim so the quote is reproducible
  concept_key   text not null,
  sqft          int  not null,
  borough       text not null,
  condition     text not null,
  floors        int,
  flags         jsonb not null default '{}',

  -- outputs
  model         char(1) not null,
  psf_lo        numeric(8,2), psf_hi numeric(8,2),
  construction_lo numeric(12,2), construction_hi numeric(12,2),
  adders        jsonb not null default '[]',
  contingency_lo  numeric(12,2), contingency_hi numeric(12,2),
  total_lo      numeric(12,2), total_hi numeric(12,2),
  permit_wk_lo  int, permit_wk_hi int,
  build_wk_lo   int, build_wk_hi  int,

  -- lead capture
  contact_name  text, contact_email text, contact_phone text, company text,
  lease_status  text,                       -- not_looking | touring | loi | signed
  target_open   date,
  source        text,                       -- organic | broker | franchise | referral
  broker_id     uuid references profiles(id),

  -- lifecycle
  status        text not null default 'draft',
    -- draft | captured | contacted | review_sold | converted | disqualified | lost
  disqualify_reason text,
  review_tier   text,                       -- retail | fnb | multi_site
  review_price  numeric(10,2),
  project_id    uuid references projects(id),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index on quotes (status, created_at desc);
create index on quotes (contact_email);
```

`rate_card_version` is not nullable and is never back-filled. A quote without a version is unreproducible and therefore undefendable.

---

## 3. The calculation

Pure, Decimal, dependency-free, locked by shared vectors the same way `lib/money.ts` is in Phase 2 T1.

```ts
// lib/quote/calculate.ts
import Decimal from 'decimal.js';

export interface QuoteInput {
  conceptKey: string;
  sqft: number;
  borough: 'manhattan' | 'outer';
  condition: 'second_same' | 'second_diff' | 'white_box' | 'raw' | 'unknown';
  floors?: number;
  cooking?: boolean;
  existingHood?: boolean;
  existingGrease?: boolean;
  existingExhaust?: boolean;
  afterHours?: boolean;
}

export interface QuoteResult {
  rateCardVersion: number;
  model: 'A' | 'B';
  modelReason: string | null;          // why B, in plain language
  psfLo: Decimal; psfHi: Decimal;
  constructionLo: Decimal; constructionHi: Decimal;
  adders: { key: string; label: string; lo: Decimal; hi: Decimal }[];
  contingencyLo: Decimal; contingencyHi: Decimal;
  totalLo: Decimal; totalHi: Decimal;
  permitWeeks: [number, number];
  buildWeeks: [number, number];
  disqualified: boolean;
  disqualifyReason: string | null;
  reviewTier: 'retail' | 'fnb';
  reviewPrice: Decimal;
  // staff only — stripped by projectPublic()
  tradeSplits: { trade: string; pct: Decimal; lo: Decimal; hi: Decimal }[];
  modelBStructure: { preconLo: Decimal; preconHi: Decimal; feeLo: Decimal; feeHi: Decimal } | null;
}

export function calculate(input: QuoteInput, card: RateCard): QuoteResult;
```

### Order of operations — matters

1. Base `psf_lo` / `psf_hi` from the concept
2. Borough modifier (multiplicative)
3. Condition modifier (multiplicative)
4. After-hours modifier (multiplicative, widens the band — ×1.15 low, ×1.30 high per §3.3)
5. Construction = adjusted psf × sqft
6. Adders evaluated against triggers, tiered ones resolved by `floors`
7. Subtotal = construction + adders
8. **Contingency computed on the subtotal, never on construction alone** — a $60K exhaust riser carries risk too
9. Total = subtotal + contingency
10. Model routing
11. Disqualify check against `total_lo` vs `min_commercial`

### Model routing

```ts
function routeModel(input: QuoteInput, concept: RateConcept): ['A'|'B', string|null] {
  if (concept.default_model === 'B')
    return ['B', `${concept.label} scopes carry too much unknown to price as a lump sum.`];
  if (input.condition === 'unknown')
    return ['B', "You haven't been inside the space yet — existing conditions drive this budget."];
  if (input.cooking && concept.concept_key === 'bar_lounge')
    return ['B', 'A full kitchen behind a bar carries unknown existing conditions.'];
  return ['A', null];
}
```

`modelReason` is customer-facing copy. It explains the switch rather than just asserting it, which is the difference between sounding expensive and sounding like you know something.

### The projection

```ts
// lib/quote/project.ts
export function projectPublic(r: QuoteResult) {
  const { tradeSplits, modelBStructure, ...pub } = r;
  return pub;
}
export const projectStaff = (r: QuoteResult) => r;
```

**Trade splits and margin never reach a public endpoint.** Not hidden in CSS — absent from the response body. The Phase 1 acceptance test applies: verify in the network response, not the rendered page.

---

## 4. Public page · `/quote`

Progressive disclosure. Number first, email second.

| Step | Shows | Captures |
|---|---|---|
| 1 | Concept, sqft, borough, condition | nothing |
| 2 | **Full range, schedule, exclusions** | nothing |
| 3 | "Save this quote / send me the breakdown" | name, email, lease status, target open |
| 4 | CTA by state | booking or bid upload |

**Give the number before asking for the email.** §3.1's whole premise is that competitors hide pricing until a site visit. Gating the number behind a form reproduces the thing you're attacking. Gate the *saved PDF* and the *detailed breakdown*, not the range.

### CTA routing

| State | CTA |
|---|---|
| Model A, qualified | Book Buildability Review — $1,250 retail / $2,250 F&B, credited in full within 90 days |
| Model B, qualified | Book Review + explain open-book structure |
| Disqualified (< $75K) | Show the number, decline cleanly, suggest a trade contractor |
| Holding a competing bid | Free Quote Check — upload, 2 business days |
| Multi-unit flagged | Multi-Site Review $4,500 + Prototype Cost Book $9,500 |

Disqualifying well matters. §5 lists projects under $75K as a disqualify, but a dead-end page loses a prospect whose *next* project is $300K. Give them the number, say plainly why you're not the fit, point them somewhere useful.

### Required on the page

- Exclusions block adjacent to the number, not below the fold
- "This is an estimate, not a bid" with one line on what moves it
- Market comparison table with sources — §2's "actually publish the numbers" play against InVision
- Rate card version in the footer

---

## 5. Admin page · `/app/admin/quote`

Same inputs, same engine, staff projection. Adds:

**Margin check.** Quote midpoint, estimated sub + material, gross margin $ and %. Flags below target.

> Until real sub costs exist, cost is backed out of a target margin — it is an assumption wearing a number's clothing. Label it as such on screen. §12.1 asks whether the published ranges actually cover sub pricing at target margin; that question is unanswerable until three jobs close.

**Trade breakdown.** The line-itemed proposal §3.3 requires, so a client can compare bids item by item — the same structure the Reddit café owner received.

**Routing summary.** Model, review tier and price, qualified yes/no, rate card version, Care attach line ($449/mo quoted inside the build proposal with first 90 days free, per §3.5).

**Model B structure** when routed there: preconstruction fee by size ($5K–$15K, 50% credited at GMP signing), fee at 10–12% of cost of work, savings split 50/50.

**Convert to project.** One action: creates the project, instantiates the matching scope template from Phase 2 T3, copies quote inputs into project fields, sets `quotes.project_id`, writes `project_events`.

---

## 6. The learning loop

This is what makes the rate card an asset rather than a price list.

```
quote → review → contract → build → closeout actuals
                                          │
                                          ▼
                              variance by trade by concept
                                          │
                                          ▼
                          proposed rate card v+1 (staff reviews)
                                          │
                                          ▼
                              published → better public quote
```

```sql
create table rate_card_feedback (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid references projects(id),
  quote_id     uuid references quotes(id),
  concept_key  text not null,
  rate_card_version int not null,
  quoted_psf   numeric(8,2),
  actual_psf   numeric(8,2),
  variance_pct numeric(6,2),
  trade_actuals jsonb,                     -- actual % by trade
  notes        text,
  created_at   timestamptz default now()
);
```

**Never auto-apply.** A card version bump changes every future public quote. A human reviews the variance and publishes. This is the same proposal-boundary discipline as Phase 3 T27 — the system proposes, a person applies.

After ten closed jobs this holds real NYC cost data by concept that no competitor has, and it's the input that turns §12.1 from an open question into a measured answer.

---

## 7. Tasks

### T30 · Rate card schema + seed from the playbook

Seed v1 directly from §3.3. Concepts with published ranges, market ranges and sources. Modifiers: outer borough ×0.85 [LOD], after-hours ×1.15–1.30 [LOD], condition multipliers (label these as Boro & Nest planning assumptions — the playbook doesn't source them). Adders: hood $8K–$35K, grease interceptor $8K–$60K [NYC Estimating Services], exhaust riser tiered by floors $12K–$18K / $30K–$60K / $50K–$100K [LOD]. Trade splits for `fnb` and `nonfnb`.

- [ ] Exactly one rate card can be `published` at a time
- [ ] Each `(card, profile)` trade split set sums to 100
- [ ] Every sourced figure carries its `source` string
- [ ] Unsourced assumptions are flagged as such in `notes`

```
feat(quote): versioned rate card seeded from the pricing playbook

Concepts, modifiers, adders and trade splits as data rather than constants.
One card is published at a time; sourced market figures carry their source
and unsourced planning assumptions are labeled.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

### T31 · Calculation engine + parity vectors

Pure function, Decimal throughout, shared fixture consumed by both the TS suite and a SQL mirror — same pattern as Phase 2 T1.

- [ ] A 1,200 sf coffee concept in Manhattan, second-gen different use, 6 floors, no existing hood/grease/exhaust returns a reproducible total
- [ ] Contingency computes on subtotal including adders, not on construction alone
- [ ] Condition `unknown` routes to Model B with a reason string
- [ ] A total below `min_commercial` sets `disqualified` with a reason
- [ ] **`projectPublic()` output contains no `tradeSplits` and no `modelBStructure` keys**
- [ ] Re-running with the same inputs and card version produces identical output

### T32 · Public `/quote` page

- [ ] The range renders before any contact field is shown
- [ ] Exclusions render adjacent to the number
- [ ] Rate card version appears in the footer
- [ ] Model B routing changes the output and shows the reason
- [ ] Disqualified state declines cleanly and still shows the number
- [ ] Network response contains no margin and no trade splits
- [ ] Email capture creates a `quotes` row with `status = 'captured'`
- [ ] Works on a phone — this gets opened on job walks

### T33 · Admin quote builder + conversion

- [ ] Same inputs reproduce the public number exactly
- [ ] Trade breakdown reconciles to the construction subtotal
- [ ] Margin flags below target
- [ ] Convert creates a project, instantiates the scope template, links `project_id`
- [ ] `rate_card_feedback` row created at project closeout
- [ ] Staff-only RLS on every quote-builder route

```
feat(quote): admin builder with margin check and project conversion

Same engine as the public calculator with the staff projection: trade
splits, margin against target, routing and Model B structure. Converting a
quote instantiates the scope template and links the project back to the quote.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## 8. Guardrails

**Estimate, not a bid.** Stated on the page and in the stored record. The playbook's §4.2 Schedule Commitment attaches at contract, after permits are issued — nothing on the quote page implies a binding date or price.

**No competitor named.** §3.1's guardrail: "review the document, not the contractor." That applies to the market comparison table too — compare to published market ranges with sources, never to a named firm's pricing.

**Published ranges are Manhattan basis.** Every surface that shows a range says so, per §3.3.

**Schedule is permit + construction, stated separately.** Most calculators give a build duration. Separating them, and saying the opening date is driven by the permit rather than the build, is the insight that proves you've done this. It also sets up §4.2 honestly — the commitment starts at permit issuance.

**Re-price after three jobs.** Put a reminder on the rate card itself: `notes` carries the review date, and the admin page surfaces it when the current card is older than 90 days with closed projects against it.

---

## 9. Where it slots

| Phase | Status |
|---|---|
| Phase 1 | auth, projects, role-gated pricing, messages |
| Phase 2 T1–T5 | money primitives, formula engine, scope templates, estimate worksheet |
| **Quote engine T30–T33** | **parallel with Phase 3a — no compliance dependency** |
| Phase 2 T6–T16 | change orders, COI, payments, retainers, violations |
| Phase 3a | compliance spine |
| Phase 3b | Nest, risk sweep, portfolio |

T30–T33 depend only on `lib/money.ts` (T1) and `scope_templates` (T3). Everything else is independent, so this can run on its own branch while Phase 3a proceeds.

**Ship order recommendation:** T30 and T31 first, even before the public page. The rate card and the engine are what the admin estimator in T5 should already be reading. Building the public page against a hardcoded rate table and retrofitting the card later is how the two numbers drift apart.
