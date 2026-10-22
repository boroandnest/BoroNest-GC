# Phase 3 — Compliance Spine & Intelligence

> Spec as provided by the owner, 2026-10-22. Reviewed in [`PHASE3_REVIEW.md`](PHASE3_REVIEW.md).
> This app is **MongoDB + JavaScript**; every Postgres/Supabase construct below maps the same way
> Phase 2 did (see `PHASE2_STATUS.md`). `PHASE2_BUILD.md` and `OCERP_DEEP_DIVE.md` are cited here
> but have never been provided.

**Branches:** `feat/phase-3a-compliance` then `feat/phase-3b-intelligence`
**Base:** `main` with Phase 1 and Phase 2 (incl. `PHASE2_PATCH.md`) merged
**Companions:** `PHASE1_BUILD.md`, `PHASE2_BUILD.md`, `PHASE2_EXECUTE.md`, `PHASE2_PATCH.md`, `OCERP_DEEP_DIVE.md`

Phase 1 made a project visible. Phase 2 made it defensible. Phase 3 makes the compliance product real and puts Nest on top of it.

Ships as **two PRs**. 3a is the compliance spine and is independently valuable — a managing agent can use it without 3b existing. Do not start 3b until 3a is merged and running against a live project.

---

## Rules of engagement

Same as Phase 2. One task, one commit, one push. Acceptance before commit. Stop and ask rather than improvising a schema change. No code copied from OpenConstructionERP — that repo is AGPL-3.0 and `OCERP_DEEP_DIVE.md` describes patterns in prose for reimplementation.

Two Phase 3 additions:

**Every compliance number traces to a rule.** No hardcoded 90-day windows scattered through components. If a date or a verdict appears in the UI, a versioned rule produced it and the rule ID is in the record.

**Nest never writes to a table of record.** It proposes. A human applies. Applying runs the same service path a manual entry would.

### Setup

```bash
git checkout main && git pull
git checkout -b feat/phase-3a-compliance
git push -u origin feat/phase-3a-compliance
```

Commit footer on every message:
```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

# PHASE 3A — COMPLIANCE SPINE

---

## T17 · Spaces and occupancies

**Why first:** a ground-floor retail space you build out three times for three tenants is one space with three occupancies. Without this, two projects at the same address have no relationship. It also fixes a real bug in the Phase 2 patch.

```sql
create table spaces (
  id           uuid primary key default gen_random_uuid(),
  building_id  uuid references buildings(id) on delete cascade,
  label        text not null,              -- 'Apt 3H' | 'Ground floor retail'
  kind         text not null check (kind in
                 ('residential','retail','office','common','mechanical','other')),
  floor        text,
  sqft         int,
  created_at   timestamptz default now(),
  unique (building_id, label)
);

create table occupancies (
  id             uuid primary key default gen_random_uuid(),
  space_id       uuid references spaces(id) on delete cascade,
  occupant_name  text not null,
  occupant_phone text,
  occupant_email text,
  kind           text not null check (kind in
                   ('owner_occupant','tenant','commercial_tenant','vacant','sponsor')),
  starts_on      date,
  ends_on        date,                     -- null = current
  created_at     timestamptz default now()
);

create index on occupancies (space_id) where ends_on is null;

alter table projects  add column space_id     uuid references spaces(id);
alter table violations add column space_id    uuid references spaces(id);
```

### Correction to `PHASE2_PATCH.md` P1

The COI token resolver read `resident_name` and `resident_phone` from a loose `unit` context. Those live on the **current occupancy**, not the space — residents change, the space does not. Veritas requires the resident's name and phone as additional insured entries 3 and 4, so a stale name produces a rejected certificate.

```ts
// lib/coi/tokens.ts — revised
export async function resolveAI(building: Building, spaceId: string): Promise<string[]> {
  const occ = await currentOccupancy(spaceId);        // ends_on is null
  if (!occ) throw new CoiError('no_current_occupancy', spaceId);

  const ctx = {
    resident_name:  occ.occupant_name,
    resident_phone: occ.occupant_phone,
    unit:           (await getSpace(spaceId)).label,
    building_name:  building.name,
  };

  const dynamic = building.required_ai_tokens.map(t =>
    t.replace(/\{(\w+)\}/g, (_, k) => {
      const v = ctx[k as keyof typeof ctx];
      if (!v) throw new CoiError('missing_token_value', k);
      return v;
    })
  );
  return [...building.required_ai_static, ...dynamic];
}
```

### Acceptance
- [ ] A building with 18 spaces and 18 current occupancies resolves COI tokens per space
- [ ] A space with no current occupancy throws rather than emitting a blank AI line
- [ ] Two projects at the same space are relatable through `space_id`
- [ ] An ended occupancy does not leak into a new tenant's COI resolution

```
feat(spaces): spaces and occupancies, with COI token resolution corrected

A space persists across tenants; occupancy is the time-bounded relationship.
COI additional-insured tokens now resolve from the current occupancy rather
than a loose unit context, so a stale resident name cannot reach a certificate.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## T18 · Rules engine core

The pattern from `OCERP_DEEP_DIVE.md` §7. A rule pack declares what it implements and what it only intends to.

```sql
create table rule_packs (
  id            uuid primary key default gen_random_uuid(),
  pack_id       text unique not null,      -- 'nyc_ll11_fisp_cycle10'
  name          text not null,
  jurisdiction  text not null default 'NYC',
  edition       text,                      -- 'Cycle 10, sub-cycle 10B'
  version       int  not null default 1,
  enables_rule_ids           text[] not null default '{}',
  planned_not_built_rule_ids text[] not null default '{}',
  planned_note  text not null default
    'The engine defines none of the planned ids. Move an id to enables_rule_ids on the day its rule lands, not before.',
  active        boolean default true,
  created_at    timestamptz default now()
);

create table rule_evaluations (
  id           bigserial primary key,
  project_id   uuid references projects(id) on delete cascade,
  building_id  uuid references buildings(id) on delete cascade,
  rule_id      text not null,
  rule_version int  not null,
  level        text not null check (level in ('ok','warn','fail')),
  inputs       jsonb not null,             -- what produced the verdict
  message      text,
  evaluated_at timestamptz default now(),
  overridden_by     uuid references profiles(id),
  override_reason   text,
  overridden_at     timestamptz
);

create index on rule_evaluations (project_id, rule_id, evaluated_at desc);
create index on rule_evaluations (building_id, level) where overridden_at is null;
```

### Rule shape

Every rule is a pure, versioned, unit-tested function with a code citation:

```ts
// rules/ll11/unsafe_cure_window.ts
export const meta = {
  id: 'll11.unsafe_cure_window_90d',
  pack: 'nyc_ll11_fisp_cycle10',
  version: 1,
  cites: ['1 RCNY §103-04'],
  audience: ['client', 'management_co', 'bn_staff'] as const,
} as const;

export function evaluate(ctx: BuildingCtx): RuleResult {
  if (ctx.fispClassification !== 'UNSAFE') return ok(meta.id);
  const deadline = addDays(ctx.fispFiledAt, 90);
  const days = daysBetween(ctx.today, deadline);

  if (days < 0)  return fail(meta.id, { days, deadline }, `Cure window closed ${Math.abs(days)} days ago.`);
  if (days < 20) return fail(meta.id, { days, deadline }, `${days} days to cure. Sidewalk shed costs are accruing.`);
  if (days < 45) return warn(meta.id, { days, deadline }, `${days} days remaining in the 90-day cure window.`);
  return ok(meta.id, { days, deadline });
}
```

Same inputs, same output, every time. The `cites` field is what lets a board member check you.

### The runner

```ts
// lib/rules/run.ts
export async function runPack(packId: string, ctx: BuildingCtx): Promise<RuleResult[]> {
  const pack = await getPack(packId);
  const results: RuleResult[] = [];

  for (const id of pack.enables_rule_ids) {
    const rule = REGISTRY[id];
    if (!rule) throw new RuleError('declared_but_missing', id);   // hard fail, not a skip
    results.push(rule.evaluate(ctx));
  }
  return results;
}
```

**`declared_but_missing` must throw.** A pack that declares a rule the registry doesn't define is the exact failure the `planned_not_built` convention exists to prevent. Silently skipping it recreates the problem.

### Acceptance
- [ ] A pack declaring a rule ID with no registry entry throws at load, not at evaluation
- [ ] Moving an ID from `planned_not_built_rule_ids` to `enables_rule_ids` without writing the rule fails CI
- [ ] Every evaluation writes to `rule_evaluations` with inputs captured
- [ ] An override records the actor and reason and suppresses that rule for that project
- [ ] Rules are pure — a rule function importing from `app/` or `supabase/` fails lint

```
feat(rules): versioned NYC rules engine with honest coverage declaration

Rule packs declare implemented and planned ids separately; a declared id with
no registry entry throws at load. Rules are pure versioned functions carrying
a code citation, and every evaluation records the inputs that produced it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## T19 · LL11 / FISP rule pack

First real pack. Be honest about coverage — four implemented beats fifteen claimed.

```json
{
  "pack_id": "nyc_ll11_fisp_cycle10",
  "name": "NYC Local Law 11 / FISP — Cycle 10",
  "jurisdiction": "NYC",
  "edition": "Cycle 10, sub-cycle 10B (opened 2026-02-21)",
  "version": 1,
  "enables_rule_ids": [
    "ll11.unsafe_cure_window_90d",
    "ll11.qewi_license_on_file",
    "ll11.sidewalk_shed_cost_accruing",
    "ll11.subcycle_filing_deadline",
    "ll11.swarmp_repair_before_cycle_end"
  ],
  "planned_not_built_rule_ids": [
    "ll11.parapet_inspection_annual",
    "ll11.prior_cycle_unresolved_carryforward",
    "ll11.shed_permit_renewal_due"
  ]
}
```

`ll11.sidewalk_shed_cost_accruing` is the one clients feel. Shed rental runs monthly and compounds while a facade sits unrepaired — surface the running total, not just the classification.

### Acceptance
- [ ] An Unsafe building 85 days past filing returns `fail` with the day count
- [ ] A SWARMP building inside the cycle returns `warn` with the cycle end date
- [ ] Shed cost accrual multiplies months elapsed by the building's stored monthly rate
- [ ] Every rule output carries its `cites` array through to the UI

---

## T20 · HPD rule pack

Formalizes T16's density logic as rules and adds the cure-window arithmetic.

```json
{
  "pack_id": "nyc_hpd_violations",
  "enables_rule_ids": [
    "hpd.aep_density_threshold",
    "hpd.aep_approaching",
    "hpd.class_c_cure_window",
    "hpd.certification_overdue",
    "hpd.awaiting_agency_closure"
  ],
  "planned_not_built_rule_ids": [
    "hpd.heat_season_class_c_escalation",
    "hpd.ll1_lead_annual_notice",
    "hpd.ll55_mold_cure_window"
  ]
}
```

`hpd.awaiting_agency_closure` is the rule that protects you from the four-state trap: work complete and HPD not yet closed is a real, reportable state, and treating it as cleared is how a portfolio believes it escaped AEP and then gets designated.

### Acceptance
- [ ] 79 open violations across 18 units returns `fail` on `aep_density_threshold` at 4.39/unit
- [ ] Marking work complete changes `awaiting_agency_closure`, not density
- [ ] A building with null `unit_count` returns `ok` with an explicit unknown, never a computed density
- [ ] Class C cure windows count from `issued_on`, not from when you logged it

---

## T21 · Statutory dates

From `OCERP_DEEP_DIVE.md` §4. A statutory date is evidence. It has to survive the rule catalogue being corrected next month, and a board asking what the deadline was in March wants March's answer.

```sql
create table statutory_dates (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid references projects(id) on delete cascade,
  building_id  uuid references buildings(id) on delete cascade,
  kind         text not null,
    -- fisp_cure | board_packet_due | board_meeting | coi_due
    -- | hpd_certify_by | ll97_beam_due | permit_expiry | shed_permit_renewal
  due_date     date not null,
  computed_by  text not null,              -- rule id
  rule_version int  not null,
  basis        jsonb not null,             -- the inputs that produced it
  set_manually boolean default false,
  superseded_by uuid references statutory_dates(id),
  computed_at  timestamptz default now()
);

create index on statutory_dates (project_id, kind) where superseded_by is null;
```

One writer: `recomputeStatutoryDates()`. It refuses to overwrite `set_manually = true` without an explicit override flag, and it supersedes rather than updates — the old row stays, pointing forward.

### Acceptance
- [ ] Recomputing after a rule version bump creates a new row and supersedes the old
- [ ] A manually set date is not overwritten without the override flag
- [ ] `basis` captures enough to answer "why was this the date" without re-running the rule
- [ ] Nothing else in the codebase writes to `statutory_dates`

```
feat(compliance): statutory dates stored as evidence, not derived on read

One writer, supersede rather than update, manual dates protected. A deadline
computed in March still reads as March's answer after the rule catalogue
changes in June.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## T22 · Board package state machine

The moat item. Neither Procore nor Autodesk models a board, a managing agent, or a monthly meeting cycle.

```sql
alter table buildings
  add column alteration_agreement_path  text,
  add column board_meets_rule           text,     -- 'second_tuesday' | 'last_thursday'
  add column board_lead_days            int default 21,
  add column board_approval_weeks_typ   int default 6,
  add column requires_board_engineer    boolean default false,
  add column board_engineer_name        text,
  add column managing_agent_contacts    jsonb default '[]';

create table board_packages (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references projects(id) on delete cascade,
  status        text not null default 'assembling' check (status in
                  ('assembling','agent_review','engineer_review',
                   'board_vote','approved','rejected','withdrawn')),
  meeting_date     date,
  submitted_at     timestamptz,
  decision_at      timestamptz,
  rejection_reason text,
  resubmit_of      uuid references board_packages(id),
  version          int not null default 1,
  created_at       timestamptz default now()
);

create table package_items (
  id         uuid primary key default gen_random_uuid(),
  package_id uuid references board_packages(id) on delete cascade,
  label      text not null,
  required   boolean default true,
  source     text,                         -- alteration_agreement | nyc_standard | building_custom
  file_path  text,
  satisfied  boolean default false,
  note       text,
  seq        int default 0
);

create table package_events (
  id         bigserial primary key,
  package_id uuid references board_packages(id) on delete cascade,
  actor_id   uuid references profiles(id),
  actor_role party,
  from_status text,
  to_status   text,
  comment     text,
  at          timestamptz default now()
);
```

`package_events` is append-only and never updated. It is the record a board hands its successor.

### Resubmission is a new version, not an edit

A rejected package spawns a new row with `resubmit_of` pointing back and `version` incremented. The rejection reason and the original item list survive. Boards turn over; the next president needs to see why round one failed.

### Acceptance
- [ ] A rejected package resubmits as version 2 with the chain intact
- [ ] `package_events` has no update path — attempting one fails
- [ ] Status transitions outside the allowed graph are rejected
- [ ] A building rep sees package status; a subcontractor sees nothing

---

## T23 · Board cycle calculator

Small, and the thing clients will quote back to you.

If the board meets the second Tuesday, requires 21 days lead, and today is the 25th — the next viable meeting is **not** next month's. It's the month after. Most owners discover that by missing it.

```ts
// lib/board/cycle.ts
export function nextViableMeeting(
  building: Pick<Building, 'board_meets_rule' | 'board_lead_days'>,
  from: Date = new Date()
): { meeting: Date; packetDue: Date; weeksOut: number } {
  let meeting = nextMeetingDate(building.board_meets_rule, from);
  let packetDue = subtractDays(meeting, building.board_lead_days);

  while (packetDue <= from) {                       // already too late for this one
    meeting = nextMeetingDate(building.board_meets_rule, addDays(meeting, 1));
    packetDue = subtractDays(meeting, building.board_lead_days);
  }
  return { meeting, packetDue, weeksOut: weeksBetween(from, meeting) };
}
```

Writes a `board_packet_due` and `board_meeting` row to `statutory_dates` via the T21 writer.

### Acceptance
- [ ] Second-Tuesday board, 21-day lead, today the 25th → skips to the following month
- [ ] Packet due date lands exactly `board_lead_days` before the meeting
- [ ] Both dates persist through `recomputeStatutoryDates`, not computed in the component
- [ ] A building with no `board_meets_rule` returns null rather than guessing

```
feat(board): alteration package workspace with real board-cycle arithmetic

Packages version on resubmission with the rejection chain intact, events are
append-only, and the next viable meeting accounts for lead time rather than
returning the next date on the calendar.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## T24 · Compliance surfaces

Three views, all reading from rules and statutory dates. No arithmetic in components.

```
/app/buildings/[id]/compliance      rule results, grouped by pack, with citations
/app/projects/[id]/board            package assembly, checklist, timeline
/app/admin/portfolio                cross-building rollup for managing agents
```

The portfolio view is what earns preferred-vendor status. One screen, every building, density and open deadlines, sorted by what's closest to failing.

### Role gating

| Role | Compliance | Board package | Portfolio |
|---|---|---|---|
| `client`, `management_co` | ✅ full | ✅ full | ✅ own portfolio |
| `building_rep` | ✅ own building | ✅ status + items | ❌ |
| `bn_staff` | ✅ all | ✅ all | ✅ all |
| `expediter` | ✅ permit rules only | ✅ DOB items only | ❌ |
| `subcontractor` | ❌ | ❌ | ❌ |

### Acceptance
- [ ] Every compliance figure renders with its rule ID and citation available
- [ ] An overridden rule shows as overridden with actor and reason, not as passing
- [ ] Portfolio view sorts by proximity to failure, not alphabetically
- [ ] A subcontractor hitting any of these three routes gets 404

---

## 3A acceptance sweep

```bash
grep -rn "90\s*\*\|addDays(.*90)" app/ components/     # hardcoded cure windows
grep -rn "3\.0" app/ components/                        # hardcoded AEP threshold
```

Both should return nothing outside `rules/`. If a compliance constant lives in a component, it isn't a rule.

- [ ] Every number on a compliance screen traces to a `rule_evaluations` row
- [ ] Every date traces to a `statutory_dates` row
- [ ] Rule pack coverage is declared honestly — no planned ID claimed as implemented
- [ ] Run against the live Bronx project end to end before opening the PR

```bash
gh pr create --base main --head feat/phase-3a-compliance \
  --title "Phase 3a — compliance spine"
```

---

# PHASE 3B — INTELLIGENCE

Start only after 3a is merged and running against live data. Every module below reads from tables 3a populates; building them against seed data produces a demo, not a product.

```bash
git checkout main && git pull
git checkout -b feat/phase-3b-intelligence
```

---

## T25 · Risk sweep

Nightly pass over benchmarks. **Not AI** — a rules engine on NYC norms, and the client-facing copy says exactly that.

Benchmarks and thresholds are in the earlier build spec. Three implementation rules:

**Dollarize every red flag.** A board acts on "tracking 11 days late, which is $3,100 in carry at your rate," not on "schedule risk."

**Write every evaluation to `ai_predictions`** (table from T13) with a stated confidence and null outcome. Resolve the outcome when the thing either happened or didn't. At project 50 that's a labeled dataset.

**The override is the training signal.** When a PM marks a flag as not-a-risk, store it and suppress that rule for that project. Those overrides are what a real model trains on later.

### Acceptance
- [ ] Running the sweep twice in a day sends one notification set
- [ ] Every alert carries a dollar figure derived from the project's carry cost
- [ ] Overrides persist and suppress correctly
- [ ] No client-facing copy anywhere calls this AI

---

## T26 · Nest corpora

Three corpora in pgvector, scoped by RLS so one client's documents can never reach another's answer.

| Corpus | Contents | Refresh |
|---|---|---|
| NYC code | DOB sections, FISP requirements, LL97 caps, ECB classes, prevailing wage | quarterly |
| Project history | Closed project actuals, permit durations by type, board timelines by agent, CO reasons | on closeout |
| Live project | Drawings, specs, alteration agreement, COIs, permits, daily logs | on upload |

Corpus 2 is the one no competitor can copy. It grows every time you close a job.

### Acceptance
- [ ] A retrieval query scoped to project A returns zero chunks from project B
- [ ] Chunks carry source path, page and date through to the answer
- [ ] Re-embedding a replaced document supersedes rather than duplicates

---

## T27 · Nest chat, tools, and the proposal boundary

Role-aware system prompt with project state injected. Four tools: `get_permit_status(bin)`, `get_project_state(id)`, `get_compliance_status(building_id)`, `get_benchmark(scope_type, trade)`.

### The trust envelope

Every analytical answer carries structured confidence — adapted from `OCERP_DEEP_DIVE.md`, written fresh in TypeScript:

```ts
interface TrustEnvelope {
  confidence: number;                        // 0..1, never fabricated
  rationale: string;
  sources: { kind: string; id: string; page?: number }[];   // real ids only
  whatWouldIncreaseConfidence: string[];
}
```

### The proposal boundary

**Nest never writes to a table of record.**

```ts
interface Proposal<T> {
  id: string;
  kind: 'scope_line' | 'change_order' | 'package_item' | 'violation_classification';
  payload: T;
  envelope: TrustEnvelope;
  status: 'pending' | 'applied' | 'rejected';
  appliedBy?: string;
  rejectedReason?: string;
}
```

Apply runs the same service path a manual entry would — same validation, same locking, same provenance stamp, tagged with the proposal id. Rejections feed T25's calibration.

### Behavior rules

1. Answer the practical question first. Caveats second, never instead.
2. Cite the source inline. Never state a permit status without calling the tool.
3. Client and board: convert to dates and dollars.
4. Subcontractor: confirm the milestone trigger and payment status.
5. End with one next action, not three options.
6. **If retrieval returned nothing relevant, say so and route to a human.** Never fill the gap with general construction knowledge dressed as project fact.

Rule 6 is the one that protects you. A confident wrong answer about an alteration agreement requirement costs a client a board cycle.

### Acceptance
- [ ] An out-of-scope question returns the no-answer path, not a plausible guess
- [ ] Every factual claim carries a source the user can open
- [ ] No proposal reaches a table of record without an explicit Apply
- [ ] An applied proposal is indistinguishable from a manual entry except for its tag
- [ ] A subcontractor cannot elicit GMP or another trade's cost through Nest

```
feat(nest): role-aware assistant with trust envelopes and a hard apply boundary

Retrieval is permission-scoped before it reaches the model. Analytical answers
carry calibrated confidence and real source ids. Nest proposes; a human applies
through the same service path a manual entry uses.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## T28 · Portfolio intelligence

Fold `boro_nest_arv_and_savings.html` into the platform, reading live data instead of sliders.

- **Unit ARV** — pulls `spaces.sqft`, scope from `scope_lines`, comps stay a manual input
- **Building ARV** — pulls `occupancies` for the rent roll, violation counts for the enforcement panel
- **Cost comparison** — pulls actual portfolio cost against the modeled reactive baseline

All three keep the savings labels: observed / estimated capacity / realized cash / risk hypothesis / unverified. The Waterford 84% error happened because a figure excluding $687,000 of remediation wasn't labeled. The taxonomy is what catches that.

### Acceptance
- [ ] ARV inputs populate from project data where it exists, manual where it doesn't
- [ ] Every output figure carries a savings label
- [ ] A modeled comparison is visually distinct from an actual
- [ ] Client and management see it; trades do not

---

## T29 · Sweep and PR

Run everything from T17 to T28. Then:

```bash
grep -rn "SUPABASE_SERVICE_ROLE_KEY\|ANTHROPIC_API_KEY" app/ components/ --include=*.tsx
grep -rn "hardcoded\|TODO\|FIXME" rules/
```

Manual verification in the network response, not the rendered page:

- [ ] Subcontractor on any compliance route — 404, not a filtered 200
- [ ] Building rep on portfolio — 404
- [ ] Nest answer for a sub contains no GMP, no other trade's cost
- [ ] Every rule pack's declared coverage matches the registry exactly

---

## What stays deferred

| Deferred | Why | When |
|---|---|---|
| Certified payroll / WH-347 | Compliance liability; a bug means client contract default | After a won government contract |
| Blockchain payment rails | Stripe escrow is working; migrate only when 10+ subs ask | Phase 4 |
| Acqivest handoff | Needs permissioned package architecture of its own | Phase 4 |
| Floor-plan overlay | Sales asset, not operations | When it closes a managing agent |
| Public NYC rule pack | Depends on the naming decision below | Optional, after 3a |

---

## One decision before T18

**Will the NYC rules ever publish as a standalone pack?**

It changes nothing about what gets built. It changes how rule IDs are named — and `statutory_dates.computed_by` stores a rule reference on every historical record, so renaming later means a versioned migration across all of them.

Naming them publishable costs nothing today: `nyc_ll11_fisp_cycle10` rather than `boro_ll11_rules`. If you never publish, you've lost nothing. If you do, the pack boundary carries public code requirements only — not your board workflow, not your pricing engine.

**Recommendation: name them as if you will.**

---

## Task summary

| # | Task | Branch |
|---|---|---|
| T17 | Spaces, occupancies, COI token fix | 3a |
| T18 | Rules engine core | 3a |
| T19 | LL11 / FISP pack | 3a |
| T20 | HPD pack | 3a |
| T21 | Statutory dates | 3a |
| T22 | Board package state machine | 3a |
| T23 | Board cycle calculator | 3a |
| T24 | Compliance surfaces | 3a |
| T25 | Risk sweep | 3b |
| T26 | Nest corpora | 3b |
| T27 | Nest chat + proposal boundary | 3b |
| T28 | Portfolio intelligence + ARV | 3b |
| T29 | Sweep + PR | 3b |

**13 tasks, 2 PRs.** 3a is independently shippable and is the piece a managing agent can actually use.

---

# ADDENDUM — admin console (owner request, 2026-10-22)

Added after the spec above. Not yet sequenced into 3a/3b; see the open
questions, which need answers before the affected task starts.

## T30 · Admin console

One place giving staff everything: projects, buildings, insurance, templates,
milestones, violations, billing and predictions, plus T32 and T33 below and the
3a compliance surfaces.

Access already exists — `bn_staff` sees everything by role, and `/admin` has
the pieces scattered across separate pages. This is consolidation and a
landing surface, not a new permission. **No new "superadmin" role**: a second
all-access role would be a second thing to get wrong, and the projections in
`lib/visibility.js` already key on `bn_staff`.

Visual language from the owner's references: a bento of stat tiles over dense
tables, big display figures with deltas, pill-shaped status. The T0 primitives
(`components/brand/`) are those pieces.

### Acceptance
- [ ] Every existing admin route is reachable from one console
- [ ] Figures are server-computed; the console does no arithmetic
- [ ] A non-staff user hitting `/admin/*` gets 404, verified in the network response

## T31 · Presentations for owners and partners

Create a presentation from live project data and share it with an owner or a
**potential partner — who has no account**. That last part is the whole design.

The precedent is the Phase 1 board portal (`/portal/[token]`): public to whoever
holds the link, deliberately limited to headline figures, per-milestone amounts
hidden. A partner deck is the same problem with a wider blast radius, so it
reuses that model rather than inventing one.

What it must not leak: client contact details, resident names and phones (the
T17 occupancy data), per-sub pricing, another trade's costs, GMP where the
audience isn't entitled to it. A presentation is a **projection**, built
server-side from the same role-gated functions, never a client-side render of a
full project object.

Tokens need an expiry and a revoke — a deck sent to a partner who passes on the
deal should stop working. The Phase 1 portal token has neither.

### Acceptance
- [ ] A share link renders without a session and shows only the projected fields
- [ ] Revoking a link stops it serving, immediately
- [ ] An expired link returns a dead page, not a login prompt
- [ ] The raw network response for a partner link contains no resident name, no sub cost, no client email
- [ ] Every share is logged: who shared, with whom, what was included, when

## T32 · Subcontractor responsiveness

Time between a message that needs a sub's answer and their answer. Phase 1
already stores `messages` with timestamps and `project_events`.

This measures a person's performance and may affect who gets offered work, so
two rules:

1. **Business hours only.** A message sent at 23:40 that gets answered at 08:10
   is a prompt reply, not a nine-hour delay. This needs the business-day
   arithmetic in `lib/dates.js` — and its documented gap, the missing holiday
   calendar, becomes real here.
2. **A sub can see their own number.** A score that decides who gets work and is
   invisible to the person being scored is indefensible, and the first dispute
   makes it unusable. Subs see their own; they never see another sub's.

### Acceptance
- [ ] Response time counts business hours, not wall-clock
- [ ] A sub sees their own figure and no one else's
- [ ] A message needing no reply does not count against anyone
- [ ] The figure is stored per response, not recomputed from scratch on read

## T33 · Desk quote vs live

Time and cost variance between what was quoted at the desk and what the job is
actually doing.

**The baseline has to be frozen when the quote goes out.** Comparing live
figures against a current estimate compares a number to itself — the estimate
moves as the job moves. This is T21's lesson applied to money: store the quote
as evidence, supersede rather than update, keep what was promised. Without the
frozen snapshot there is no variance to compute, so this is the first thing T33
builds, not a detail.

Cost sources already exist: the T5 estimate, `scope_lines`, change-order
`costDelta`, milestones, `actualSpend`. Schedule comes from T4's scheduler.

Variance is signed and its meaning is not the sign: under budget is negative and
good, a contingency draw is positive and bad. `components/brand/stat.js` takes
an explicit intent for exactly this.

Change orders are the honest part: a signed owner-requested CO raises the
ceiling legitimately and should not read as an overrun. A `bn_error` CO is
absorbed by B&N and must not be charged to the client's variance either. The
variance that means something is **against the revised, signed baseline**, with
the original quote shown alongside it.

### Acceptance
- [ ] The quote baseline is frozen at issue and never overwritten
- [ ] A signed owner CO moves the revised baseline, not the overrun
- [ ] A `bn_error` CO appears in neither the client's cost nor their variance
- [ ] Under-budget renders as good news, not as an alert
- [ ] Both original and revised baselines are visible, labelled

## Open questions

1. **T31 — what is in a presentation?** Project highlights, the T28 ARV and
   savings figures, compliance posture, portfolio summary? And is a partner deck
   a different, narrower template than an owner's?
2. **T31 — how long should a share link live by default?**
3. **T32 — what counts as needing a reply?** Any message addressed to the sub, a
   message mentioning them, or only an explicit request? And what are the
   business hours?
4. **T33 — is "desk quote" the T5 GMP worksheet at issue**, or a separate
   earlier number produced before the worksheet exists?
