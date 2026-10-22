# Phase 3 — review before building

Reviewed 2026-10-22 against `main` at `1fa395e` (Phase 1 + Phase 2 merged). Spec: [`PHASE3_BUILD.md`](PHASE3_BUILD.md).

**Verdict: the plan is sound and the sequencing is right.** 3a before 3b is correct, and T17 genuinely belongs
first. Below is what has to change before T17, what I'd push back on, and what I can't build without you.

---

## 1. Blockers — I need an answer before the task that needs it

### B1. Compliance thresholds and benchmarks (blocks T19, T20, T25)

`PHASE2_BUILD.md` and `OCERP_DEEP_DIVE.md` have never been provided. Phase 2 worked around their
absence because the missing pieces were *schema shapes*, which I could infer and list for review.
Phase 3 is different: what's missing is **numbers that carry legal weight**.

- T19 cites `1 RCNY §103-04` and a 90-day cure window. The sub-cycle 10B filing deadline, the
  SWARMP cycle-end date, and the shed monthly rate are not in the spec.
- T20's Class C cure window length is not stated.
- T25 says "benchmarks and thresholds are in the earlier build spec" — I don't have that spec.

I will not invent a statutory deadline. Inventing one produces a rule that is wrong, cited, versioned
and stored as evidence — the worst possible failure mode for this product. **Either send the two docs,
or give me the numbers per rule and I'll record you as the source in `cites`.**

The AEP density threshold (3.0/unit) and the 79/18 → 4.39 case are already implemented and tested from
Phase 2 T16, so T20's density rules can proceed on those.

### B2. Vector store for T26 (blocks T26, T27 — decide before 3b starts)

The spec says pgvector. We're on MongoDB. There is no pgvector, and **self-hosted `mongod` has no
vector search** — Atlas Vector Search is an Atlas-only feature.

Three options:

| Option | Cost | Verdict |
|---|---|---|
| Move the DB to MongoDB Atlas (M10+) | new monthly spend, migration | works, heaviest |
| Add a dedicated vector store (Qdrant/pgvector alongside) | second datastore to secure, and the cross-store scoping is where leaks happen | I'd avoid: it puts the tenant boundary across two systems |
| **Embeddings as arrays in Mongo, cosine similarity in JS** | none | **recommended at your scale** |

The third is what I'd do. At your corpus size (a few thousand chunks) an exact cosine scan is
single-digit milliseconds, needs no new infrastructure, and — the real argument — the project filter
is a **Mongo query predicate**, so a cross-tenant leak is structurally impossible rather than a filter
someone can forget. It stops being the right answer somewhere around 50k chunks, which is many
projects away; swapping to Atlas later is a change in one module.

### B3. `boro_nest_arv_and_savings.html` is not in the repo (blocks T28)

T28 says "fold it into the platform". Send the file.

Related: T28 says the three views "keep the savings labels". **They don't exist yet** — P5 savings
labels were explicitly not built in Phase 2 ("there is no savings/finding model to attach them to").
So T28 has to *build* the taxonomy (observed / estimated capacity / realized cash / risk hypothesis /
unverified), not preserve it. That's more work than the task implies, and given the Waterford 84%
error is the reason the taxonomy exists, it shouldn't be a bolt-on at the end of 3b.

---

## 2. Corrections to the spec

### C1. T17's bug is real, and worse than described

The spec says the resolver reads from a "loose unit context". Accurate, but the staleness isn't
really in *where* the tokens read from — it's that the result is **frozen**.

`lib/coi/buildings.js:64-74` resolves the additional-insured list once, at building-attach time, and
writes the finished array onto the project as `requiredAi`. Nothing ever recomputes it.

So adding `spaces` + `occupancies` and reading from the current occupancy fixes *new* projects and
leaves every existing one wrong. The acceptance check "an ended occupancy does not leak into a new
tenant's COI resolution" would pass at creation and fail in production the first time a tenant moves.

**T17 must also include:** a recompute path that re-resolves `requiredAi` when the occupancy changes
(ending an occupancy, starting a new one, correcting a name), and marks any COI verified against the
superseded list as needing re-verification. Otherwise a certificate that was compliant stays marked
compliant against a resident who moved out.

### C2. Keep `resolveAI` pure — don't adopt the spec's signature

The spec's revised `resolveAI(building, spaceId)` is `async` and does two DB reads inside the resolver.

Ours is a pure synchronous function, which is why it has five unit tests with no database
(`lib/coi/compliance.test.js`). Making it async-and-DB-reading loses that, and it contradicts T18's
own principle three tasks later ("rules are pure — a rule function importing from `app/` or
`supabase/` fails lint"). Token resolution is the same class of thing as a rule.

Proposed instead — same behaviour, purity kept:

```js
// lib/coi/occupancy.js   (does the I/O)
export async function coiContext(spaceId) {
  const occ = await currentOccupancy(spaceId);           // endsOn == null
  if (!occ) throw new CoiError('no_current_occupancy', spaceId);
  const space = await getSpace(spaceId);
  return { resident_name: occ.occupantName, resident_phone: occ.occupantPhone,
           unit: space.label, building_name: ... };
}

// lib/coi/compliance.js  (unchanged, still pure, still sync)
resolveAI(building, ctx)
```

`no_current_occupancy` as a distinct error code is a good addition — I'll keep that.

### C3. Role keys don't match the codebase

The spec uses `management_co`, `building_rep`. The app uses **`management`** and **`building-rep`**
(hyphen) — `lib/api-helpers.js:7`. `package_events.actor_role party` also references a Postgres enum
type we don't have.

This matters more than a rename: a role gate comparing against `'management_co'` matches nobody, so
every management-company user silently loses access to the compliance and portfolio screens — or, if
the gate is written as a denylist, gains access they shouldn't have. I'll use the existing keys and
won't introduce new spellings.

### C4. `package_events` append-only is not enforceable by a Mongo validator

T22's acceptance says "`package_events` has no update path — attempting one fails". Phase 2's
DB-enforced rules worked because each was expressible as a predicate on the *resulting document*
(a line can't be `in_progress` with open blocks). "No updates allowed" isn't that shape — Mongo
validators can't see that a write is an update rather than an insert.

Honest version, which I'd implement:
- app-level single writer, no update route;
- a test asserting no code path issues an update or delete against the collection;
- each event stores the hash of the previous event for its package, so tampering is **detectable**
  even though it can't be **prevented** at the driver level.

I'd rather write that down than claim DB enforcement we don't have. Same reasoning as the spec's own
`planned_not_built` convention.

### C5. `rule_evaluations` / `statutory_dates` need building-level rows with no project

Both tables carry `project_id` and `building_id`. Most LL11 and HPD rules are **building-level** —
the portfolio view (T24) evaluates buildings with no project attached at all. Fine in Mongo, but
worth stating: `projectId` is nullable, and the uniqueness/supersede logic keys on
`(buildingId, projectId|null, kind)`.

### C6. "Fails CI" and "fails lint" acceptance checks have nothing to run

Three acceptance criteria depend on CI or lint:
- T18: moving an ID to `enables_rule_ids` without the rule "fails CI"
- T18: a rule importing from `app/` "fails lint"
- T29's greps

**The repo has no CI and no lint config.** The only automation is `npm test` and the Phase 2 cron
workflow. So those checks currently assert nothing.

I'd add, as part of T18: a `rules/registry.test.js` that loads every pack and asserts
`enables_rule_ids` matches the registry exactly (this makes the first one a real failing test rather
than a CI promise), plus a purity test that walks each rule file's imports. And a small GitHub Actions
workflow running `npm test` on PRs, so "fails CI" becomes true. That's cheap and makes four acceptance
checks enforceable instead of aspirational.

### C7. T19's `cites` needs to survive to the client, and the audience field needs a mapping

`meta.audience` lists `['client','management_co','bn_staff']`. We already have a projection layer for
exactly this (`lib/visibility.js`, `lib/co/project.js`). Rule output should go through it rather than
a second parallel mechanism — otherwise we have two role systems and they will drift.

---

## 3. Design principles — the part you asked about

### D1. The Phase 1 §7 tokens are still not applied, and Phase 3 adds four new screens

This is the most consequential design finding.

`docs/PHASE1_BUILD.md` §7 specifies forest `#253D35`, cream `#F6F2EC`, sand `#C8B89A`, alert
`#D4654A`, Playfair Display (display, ≥18px), Inter (body), JetBrains Mono (labels/codes/CTAs).

What's actually in the code:
- `app/globals.css:22` — `--primary: 220 92% 58%` — still the royal-blue dark theme.
- `tailwind.config.js` — no forest/cream/sand/alert tokens at all.
- It's item 4 on Phase 1's remaining list and item 3 on Phase 2's still-to-do.

Phase 3a adds `/buildings/[id]/compliance`, `/projects/[id]/board`, `/admin/portfolio`, and 3b adds the
three ARV views. **Built today, all seven land in the wrong theme and get restyled later** — every one
of them touched twice, and the portfolio view is the screen you say earns preferred-vendor status.

**Recommendation: a token pass as T0, before T17.** It's one small commit (`globals.css`,
`tailwind.config.js`, the phase stepper: done=forest, current=sand, future=outlined), it's already
fully specified, and it's the cheapest it will ever be — fewer screens exist now than at any later
point. Then every Phase 3 screen is correct on the first pass.

### D2. The compliance spine will break the `--alert` rule unless we set the discipline now

§7 is explicit: `--alert` is **"ONLY for genuine problems — never decoration"**.

A compliance product is made of problems. A portfolio view "sorted by what's closest to failing"
(T24) renders, by construction, a column of things in trouble. If every `fail` paints `--alert`, the
first managing-agent demo is a wall of red — and a token that's everywhere signals nothing. That is
how a design system dies, and it would happen on exactly the screen that's supposed to sell.

Proposed mapping, which keeps the token meaningful:

| Rule level | Colour | Reasoning |
|---|---|---|
| `fail`, deadline **passed** | `--alert` | a genuine problem, happening now |
| `fail`, deadline approaching | `--sand` | urgent, not yet failed — sand is already the accent/data-highlight token |
| `warn` | `--sand` at lower emphasis | |
| `ok` | `--forest` | |
| overridden | outlined, mono label | must read as overridden, never as passing (T24) |

So `--alert` means "past due or designated", not "scored badly". Worth deciding before T24 rather than
after, because retrofitting colour semantics across seven screens is the same double-work as D1.

### D3. "No arithmetic in components" is the Phase 2 money rule again — reuse its enforcement

T24's "no arithmetic in components" is exactly Phase 2's money discipline (string-only formatting via
`lib/format.js`; no `toFixed`/`parseFloat`/`Number(` in any money page), which is already enforced and
swept.

The 3a sweep as written is weaker than Phase 2's:

```bash
grep -rn "90\s*\*\|addDays(.*90)" app/ components/
grep -rn "3\.0" app/ components/
```

Those catch two specific constants. Day-counts and dollarized carry costs have the same failure class
as money, so I'd extend the 3a sweep to Phase 2's set over the compliance pages, plus `daysBetween(`,
`new Date(` and `Date.now(` in components — a component computing "days remaining" from the clock is
the same violation as one computing a line total, and it will drift from the stored
`statutory_dates` row.

### D4. Where the tokens actively help

Worth noting, since it supports doing D1 first: §7's type rules fit the compliance screens better than
they fit anything in Phase 1. Dense rule tables want mono labels and codes (rule IDs, `1 RCNY §103-04`
citations, BINs); the portfolio rollup wants Playfair for the big numbers (density, days remaining).
The tokens aren't a tax here — they're the right tool for the screens 3a adds.

### D5. Principles from Phase 2 that Phase 3 should inherit explicitly

Three Phase 2 disciplines Phase 3 doesn't restate but should keep:

1. **Projections delete fields server-side** — a field a role can't see never reaches the JSON, and the
   e2e suites assert against the raw response text, not the rendered page. T24's role table and T29's
   manual checks should be automated the same way (they're testable in `tests/phase3_api_test.mjs`).
2. **Money stays Decimal/string end to end.** T19's shed-cost accrual and T25's dollarized flags must
   go through `lib/money.js` and be stored as Decimal128 — not computed as floats because they're
   "just estimates". An estimate shown to a board is a number they'll quote back.
3. **Migrations are additive and tested against a Phase-1-shaped database.** Phase 2's upgrade
   simulation (legacy rows migrate cleanly through 001–009) is worth repeating for 010+ before the PR.

---

## 4. The decision you asked for

**Name the rule IDs as if you'll publish** — `nyc_ll11_fisp_cycle10`, not `boro_ll11_rules`. Agreed,
and Phase 2 gives a concrete reason beyond the one in the spec: `rule_evaluations.rule_id` and
`statutory_dates.computed_by` would both need a data migration across all historical rows, and
reshaping historical records is the expensive, risky kind of migration — Phase 2's upgrade simulation
exists because of exactly that class of change. Costs nothing now; costs real work later.

---

## 5. Proposed sequence

| | Task | Change from the spec |
|---|---|---|
| **T0** | **Design tokens (Phase 1 §7)** | **new — before any 3a UI** |
| T17 | Spaces, occupancies, COI fix | + recompute path (C1), keep `resolveAI` pure (C2) |
| T18 | Rules engine core | + registry/purity tests + CI workflow (C6) |
| T19 | LL11 / FISP pack | **needs B1** |
| T20 | HPD pack | density rules OK; cure windows need B1 |
| T21 | Statutory dates | nullable `projectId` (C5) |
| T22 | Board state machine | append-only as hash chain + tests (C4) |
| T23 | Board cycle calculator | reuses `lib/dates.js` business days |
| T24 | Compliance surfaces | alert discipline (D2), existing role keys (C3) |
| — | 3a sweep + PR | extended sweep (D3) |

3b after 3a merges and runs live, as specified — with B2 decided before T26 and B3 before T28.

`lib/dates.js` still has no holiday calendar (documented Phase 2 gap). T23's `board_lead_days` is
calendar days so it's unaffected, but if any statutory deadline turns out to be business days, that
gap becomes real. Flagging it now rather than discovering it in T21.
