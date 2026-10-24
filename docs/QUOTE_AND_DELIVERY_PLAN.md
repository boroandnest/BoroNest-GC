# Implementation plan — quote engine, documents, trade schedule

Requested 2026-10-23. Nothing below is built yet. Two blockers in §1 need an
answer first; §3 and §4 can start immediately.

Source specs: `QUOTE_ENGINE_BUILD.md` (owner-supplied), the offer/price CSV,
and the existing Phase 1–3 code.

---

## 0. Two naming collisions to settle before anything is written

**The supplied spec numbers its tasks T30–T33. Those are taken.** This repo
already shipped T30 (admin console), T31 (presentations) and T33 (desk-quote
variance). The quote-engine tasks are renumbered **Q1–Q4** here; nothing else
changes.

**There are now two things called a "quote", and conflating them would be a
real bug.** They are different artifacts at different moments:

| | What it is | Binding? | Where |
|---|---|---|---|
| **Rate quote** (new, Q1–Q4) | A range from the public calculator, before anyone has seen the space | No — an estimate | `rate_quotes` |
| **Desk quote** (built, T33) | The number given *after* the site visit | The baseline we are measured against | `desk_quotes` |

The chain is: **calculator range → site visit → desk quote (frozen) → GMP
worksheet → signed baseline → actuals.** Converting a rate quote to a project
must **not** write a desk quote. A range produced without entering the building
is not a promise, and freezing it as one would make every variance in T33 a
measure of how wrong the website was. The convert action links the two and
leaves the desk quote to be issued after the visit.

---

## 1. Competitor pricing — blocked, needs you

### Blocker A: two of the three tabs are missing

The attached file is a **CSV, which holds a single sheet** — the one titled
*Offer / Recommended price / What it answers in the market*. The tabs you
named, **Price intel** and **NYC Construction Benchmark**, are not in it.

Please send those two as separate CSV exports (or the whole workbook as
`.xlsx`). Without them there is no benchmark data to build the comparison
against, and I will not invent market ranges — a published $/sf figure that
turns out to be wrong is the kind of number a client holds you to.

### Blocker B: "never display their names" conflicts with the spec

You said never display competitor company names or anyone associated with them.
The supplied spec requires the opposite in three places: `market_source` on
every concept (e.g. `'LOD Construction, 2026'`), *"Every sourced figure carries
its `source` string"*, and a public *"Market comparison table with sources"*.

The one tab I do have names **PRHI, Thumbtack, LOD Construction, Darby**, and
a Reddit thread. The spec MD additionally names **NYC Estimating Services** and
**InVision**.

**Proposed resolution — two layers:**

- **Stored, staff-only:** the real source string stays in the database. If a
  client disputes a published range you need to be able to say where it came
  from; a benchmark with no provenance is indefensible, and deleting it to be
  safe makes the number worthless.
- **Rendered, anywhere public:** an anonymised band only — *"Published NYC
  market range, 2026"*, never a firm. Enforced structurally, the same way deck
  sections are: a `FORBIDDEN_SOURCE_NAMES` list plus a scrub pass over every
  public payload, and a test asserting that no response body from `/quote`
  contains any of the names above.

**I need one decision:** is storing the real source internally acceptable, or
do you want the names absent from the database entirely? If the latter, say so
and I will store only the anonymised band plus a private note field you fill in
yourself. Everything else in the plan is unaffected.

*Not an issue:* comparing against published market rates is ordinary practice,
and your own offer/price sheet is yours to use however you like.

---

## 2. Q1–Q4 · The quote engine

Stack note: the spec is Postgres + TypeScript; this app is MongoDB + JavaScript.
Same translation as Phases 2 and 3 — tables become collections with
`$jsonSchema` validators, `numeric` becomes `Decimal128`, and money crosses the
wire as strings.

### Q1 · Versioned rate card

`rate_cards` with embedded `concepts`, `modifiers`, `adders` (incl. tiers) and
`tradeSplits`. Embedding rather than five collections because a card is saved
and published atomically; a half-written card that is live is worse than a
slow save.

Database-enforced, in the validator and indexes:
- exactly one card `published` at a time (partial unique index, the same
  pattern as one live desk quote per project);
- each `(profile)` trade-split set sums to **100.00** — a card summing to 97
  produces line items that do not reconcile, and a client comparing bids finds
  it before you do;
- `effectiveFrom` present on every card.

Seeding waits on Blocker A for market ranges. The B&N ranges themselves come
from your playbook §3.3, which I also do not have — **please send it, or the
concept ranges directly.** Condition multipliers are explicitly unsourced
planning assumptions and will be labelled as such in `notes`.

### Q2 · The calculation — "always deterministic"

Made concrete, since this is the requirement you named:

1. **Pure function.** `calculate(input, card)`. No clock, no randomness, no I/O,
   no `Date.now()` anywhere in the path. Same inputs and same card version
   always produce the same bytes.
2. **Decimal throughout**, `ROUND_HALF_UP`, as `lib/money.js` already does. No
   float touches a price.
3. **The card version is stored on every quote and is never nullable and never
   back-filled.** A quote whose card cannot be identified is unreproducible and
   therefore undefendable.
4. **Inputs stored verbatim**, so a quote can be recomputed years later.
5. **Golden vectors** in `shared/fixtures/quote.vectors.json`, consumed by the
   test suite exactly as the T1 money vectors are, so a rounding change breaks
   a test rather than a client conversation.
6. **A replay test**: re-running every stored quote against its own card version
   reproduces the stored output exactly. This is the test that actually proves
   determinism, and it keeps proving it as the card evolves.

Order of operations is taken from the spec unchanged, including the one that
matters: **contingency computes on the subtotal including adders**, not on
construction alone — a $60K exhaust riser carries risk too.

Also from the spec, kept because each is a correctness rule rather than a
preference: contingency always shown as its own line; exclusions as a
first-class output block beside the number; Model A/B routing automatic with a
plain-language reason.

### Q3 · Public `/quote`

Range first, email second — gating the number reproduces the thing the
positioning attacks. Gate the saved PDF and the detailed breakdown instead.

Non-negotiable in the response body, not the CSS:
- no `tradeSplits`, no margin, no Model B fee structure;
- no competitor name (per §1);
- "estimate, not a bid" and the Manhattan basis stated on the page;
- card version in the footer.

Verified in the network response the way Phase 1 verifies pricing gates, plus a
phone-width check — this gets opened on job walks.

### Q4 · Admin builder, margin, conversion

Same engine, staff projection. The margin check is the part worth care: until
three jobs close, cost is **backed out of a target margin** — an assumption
wearing a number's clothes, as the spec itself says.

Rather than a bespoke caveat, this reuses the savings-label taxonomy built for
T31: a margin figure is `estimated_capacity` with its basis stated, and it
renders with the same label chip as every other modelled number in the system.
One vocabulary for "this is not measured", everywhere.

Convert-to-project creates the project, instantiates the matching scope
template (T3), links `projectId` both ways, writes a `project_event` — and does
**not** create a desk quote, per §0.

The learning loop (`rate_card_feedback`, quoted vs actual $/sf by concept) is
specified but **deferred until jobs close**: with no closed projects it would
be an empty table and a proposal engine with nothing to propose. Flagged, not
built.

---

## 3. Documents and photos for every party and stage

**What already works:** upload to S3/R2 or local disk with signed expiring URLs,
photo compression to WebP, type allow-listing, access-checked download through
`/api/files/:id`, and `documents` / `photos` collections.

**What is actually missing — and it is the visibility model, not the upload:**

1. **No stage.** A document has a free-text `category` defaulting to
   "Documents". Nothing ties it to a phase, a scope line or a change order.
2. **No audience.** Every project member sees every document except invoices.
   **A subcontractor on one trade can currently open everything on the
   project** — drawings, other trades' paperwork, the lot. That is the real
   gap, and it is a disclosure problem rather than a feature request.
3. **No versioning.** Re-uploading "Plan Set" leaves two rows and no winner,
   which is how a crew builds to a superseded drawing.

**Plan:**
- Add `stage` (the seven existing phases), optional `scopeLineId` /
  `changeOrderId`, and `audience` — the array-of-roles model `messages` already
  uses, plus an explicit party list for "this sub only".
- Default audience by uploader and category rather than open-to-all, so the
  safe case is the one you get by doing nothing.
- Supersede on re-upload of the same logical document, keeping the old file and
  marking it superseded — the same discipline as desk quotes and statutory
  dates, for the same reason.
- Migrate existing rows to a default audience; nothing becomes *more* visible
  than it is today.
- A per-project Files view grouped by stage, and the same list filtered to
  "shared with me" for a trade.
- Tests asserting a sub's file list and a direct file fetch both exclude
  another trade's documents, checked in the response body.

---

## 4. Who is doing what, by when, and how far along

**What already exists** (more than it looks): `scope_lines` carry `trade`,
`title`, `status`, `assignedSub`, `assignedCoiId`, `openBlocks`, and —
when instantiated from a template — `plannedStart`, `plannedEnd` and
`durationDays` from the T4 scheduler, which already honours dependencies and
inspection lead times. Assignment already refuses a sub without a compliant
certificate.

**What is missing is progress and the view.**

**Progress model — one decision for you.** I propose:
- status transitions (`not_started → in_progress → complete`) stay the spine,
  and the existing rule holds: a line cannot go `in_progress` while a change
  order blocks it;
- a sub may report **"ready for review"**, not "complete". Letting a trade mark
  its own work finished is how a punch list becomes an argument, and the
  milestone verification already built is the natural gate;
- `actualStart` / `actualEnd` recorded on transition, which makes per-trade
  schedule variance fall out of data rather than needing a new estimate.

**Views:**
- **Project schedule board** — lines grouped by trade, each showing the
  assigned sub, planned window, status, and days ahead or behind. Bars sized
  from server-computed figures; no date arithmetic in a component, the same
  rule the money screens follow.
- **"My work"** for a subcontractor — their own lines only, their own dates,
  no other trade's scope and no pricing beyond their own.
- **Console rollup** — trades running behind across every project, slotted into
  the attention list that already exists, with the same severity discipline:
  behind schedule is `warn`, past a committed date is `problem`.

---

## 5. Sequence

| | Task | Depends on | Status |
|---|---|---|---|
| 1 | §3 documents — stage, audience, supersede | nothing | **ready** |
| 2 | §4 progress + schedule board | nothing | **ready** |
| 3 | Q1 rate card schema | Blocker A + playbook §3.3 | blocked |
| 4 | Q2 engine + vectors | Q1 | blocked |
| 5 | Q3 public page | Q2, Blocker B decision | blocked |
| 6 | Q4 admin + convert | Q2 | blocked |

**Recommendation: start with §3, because it is a live disclosure gap** — subs
can read documents meant for other parties today — then §4, which is mostly a
view over data that already exists. The quote engine follows as soon as the two
missing tabs and the playbook ranges arrive.

Q1 and Q2 before Q3, per the spec's own advice: building the public page
against a hardcoded table and retrofitting the card is how the website number
and the estimator number drift apart.

---

## 6. What I need from you

1. The **Price intel** and **NYC Construction Benchmark** tabs (CSV or xlsx).
2. The **Pricing and Sales Playbook** §3.3 concept ranges, or those numbers
   directly. I will not invent them.
3. **Blocker B decision:** store real sources internally and anonymise on
   render (recommended), or keep names out of the database entirely.
4. **Progress model:** is "sub reports ready for review, staff marks complete"
   right, or do you want trades to close their own lines?

Still outstanding from earlier: the Leaflet map privacy decision, and whether
scoping calls get a `handled` flag so leads can become actionable.

---

## 7. Blockers resolved (2026-10-23)

**Blocker 1 (playbook)** — resolved. `docs/PRICING_PLAYBOOK.md` is now in the
repo and is the source of truth the spec names. §3.3 gives sourced concept
ranges; §3.2 gives Buildability Review pricing; §5 gives the $75K disqualify
threshold. The CSV's two missing tabs are superseded by this — the spec
itself says the playbook, not a spreadsheet, is authoritative.

**Blocker 2 (names)** — resolved by re-reading the playbook's own rule, not by
asking again. It already draws the line I was asking about:

- **Market benchmark sources** — LOD Construction, NYC Estimating Services,
  Hudson Weekly — are research citations the playbook itself publishes (§3.3's
  "Market source" column is in the *published* price guide; §7.3 lists them as
  sources for the public cost guide). These may render publicly, with
  attribution, exactly as the spec's `market_source` field intends.
- **Named competitors** — JJS, PRHI, Agalliu, K&D, TRH, Darby, Bolt, InVision,
  Reidy, MGI, Jay P, AKU, Slate — are for internal sales use only (§6
  battlecards, "never disparage... by name," "review the document, not the
  contractor"). These never appear in `rate_cards`, never reach `/quote`, and
  are not stored anywhere the app renders. The battlecard content itself stays
  in the playbook doc for staff to read, not in application data.

So `market_source` is real and public; competitor identity is excluded from
the system entirely, not merely hidden.

**What the playbook does not give me:** numeric trade-split percentages by
trade, and numeric condition-modifier multipliers. Both are left unseeded
(not invented) — see Q1 below.
