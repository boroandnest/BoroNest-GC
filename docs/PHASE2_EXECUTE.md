# Phase 2 — Execution Runbook for Claude Code

**Repo:** Boro & Nest Collective (`boro-gmp.emergent.host`)
**Branch:** `feat/phase-2-money-layer`
**Base:** `main` with Phase 1 merged
**Companion specs:** `PHASE1_BUILD.md`, `PHASE2_BUILD.md`, `OCERP_DEEP_DIVE.md`

This file is the ordered task list. Work through it top to bottom. **One task, one commit, one push.** Do not batch tasks.

---

## Rules of engagement

1. **Commit after every task.** Each task below ends with a commit message. Use it verbatim. Push after each commit so Emergent picks up incremental state.
2. **Acceptance before commit.** Every task has an acceptance check. If it fails, fix it before committing. Do not commit red.
3. **Never skip the money tasks.** T1 and T2 are load-bearing for everything after. If they're not green, stop.
4. **Stop and ask** if: a migration conflicts with existing Phase 1 schema, a Phase 1 table is missing a column this spec assumes, or an acceptance check can't pass without changing the spec. Do not improvise a schema change silently.
5. **Do not copy code from OpenConstructionERP.** That repo is AGPL-3.0. `OCERP_DEEP_DIVE.md` describes patterns in prose. Implement from the prose.
6. **No new dependencies** beyond those named in a task.
7. **Server-side only for money.** Any function that produces a dollar figure runs on the server or in the database. Never compute a total in a client component.

### Setup

```bash
git checkout main && git pull
git checkout -b feat/phase-2-money-layer
git push -u origin feat/phase-2-money-layer
```

### Commit footer (append to every message)

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## T1 · Money primitives and parity vectors

**Why first:** your GMP ceiling renders in React and is stored in Postgres. If the browser rounds in float and the server rounds in numeric, a board eventually sees two different numbers for the same project. This task makes that impossible.

### Create

```
shared/fixtures/gmp.vectors.json
lib/money.ts
lib/money.test.ts
supabase/tests/money_test.sql
```

### `shared/fixtures/gmp.vectors.json`

Single source of truth, consumed by **both** test suites.

```json
{
  "_contract": "Loaded by lib/money.test.ts AND supabase/tests/money_test.sql. Every expected value exact at <= 2dp. A case added here must pass on BOTH sides or be removed.",
  "rounding": [
    { "in": "1234.565",  "dp": 2, "out": "1234.57", "note": "half-up, not banker's" },
    { "in": "1234.5649", "dp": 2, "out": "1234.56" },
    { "in": "0.005",     "dp": 2, "out": "0.01" },
    { "in": "-0.005",    "dp": 2, "out": "-0.01" },
    { "in": "0",         "dp": 2, "out": "0.00" }
  ],
  "contingency": [
    {
      "label": "two contingency COs and one ceiling adjustment",
      "ceiling": "420000.00",
      "contingency": "32000.00",
      "signed_cos": [
        { "delta": "6200.00",  "against_contingency": true  },
        { "delta": "4800.00",  "against_contingency": true  },
        { "delta": "15000.00", "against_contingency": false }
      ],
      "expect": {
        "contingency_used": "11000.00",
        "contingency_remaining": "21000.00",
        "ceiling_adjustments": "15000.00",
        "adjusted_ceiling": "435000.00",
        "pct_remaining": "65.63"
      }
    },
    {
      "label": "contingency fully consumed",
      "ceiling": "300000.00",
      "contingency": "20000.00",
      "signed_cos": [{ "delta": "20000.00", "against_contingency": true }],
      "expect": {
        "contingency_used": "20000.00",
        "contingency_remaining": "0.00",
        "ceiling_adjustments": "0.00",
        "adjusted_ceiling": "300000.00",
        "pct_remaining": "0.00"
      }
    },
    {
      "label": "no contingency set",
      "ceiling": "150000.00",
      "contingency": "0.00",
      "signed_cos": [],
      "expect": {
        "contingency_used": "0.00",
        "contingency_remaining": "0.00",
        "ceiling_adjustments": "0.00",
        "adjusted_ceiling": "150000.00",
        "pct_remaining": "0.00"
      }
    }
  ],
  "tariff": [
    { "base": "28400.00", "pct": "50.00", "exposure": "14200.00", "total": "42600.00" },
    { "base": "11100.00", "pct": "0",     "exposure": "0.00",     "total": "11100.00" },
    { "base": "9999.99",  "pct": "25.00", "exposure": "2500.00",  "total": "12499.99" }
  ],
  "line_total": [
    { "qty": "800",    "unit_cost": "25.13", "out": "20104.00" },
    { "qty": "1.5",    "unit_cost": "1000",  "out": "1500.00" },
    { "qty": "0",      "unit_cost": "500",   "out": "0.00" },
    { "qty": "333.33", "unit_cost": "3",     "out": "999.99" }
  ]
}
```

### `lib/money.ts`

```bash
npm i decimal.js
```

Decimal.js throughout. Never `number` for money. Export:

```ts
export type Money = Decimal;

export function toMoney(v: string | number | Decimal): Money;
export function round2(v: Money): Money;                 // ROUND_HALF_UP
export function lineTotal(qty: Money, unitCost: Money): Money;
export function tariffExposure(base: Money, pct: Money): Money;

export interface ContingencyInput {
  ceiling: Money;
  contingency: Money;
  signedCos: { delta: Money; againstContingency: boolean }[];
}
export interface ContingencyResult {
  contingencyUsed: Money;
  contingencyRemaining: Money;    // floored at 0
  ceilingAdjustments: Money;
  adjustedCeiling: Money;
  pctRemaining: Money;            // 0.00 when contingency is 0
}
export function contingency(i: ContingencyInput): ContingencyResult;
```

`Decimal.set({ rounding: Decimal.ROUND_HALF_UP })` at module load. `pctRemaining` returns `0.00` when `contingency` is zero — no division by zero, no `NaN`.

### `supabase/tests/money_test.sql`

Mirror the same functions in `plpgsql` as `bn_round2`, `bn_line_total`, `bn_tariff_exposure`, `bn_contingency`. Load the same JSON fixture and assert every case. Use pgTAP if available in the project; otherwise a plain assertion function that raises on mismatch is acceptable.

### Acceptance
- [ ] `npm test lib/money.test.ts` passes every fixture case
- [ ] The SQL test passes every fixture case
- [ ] Deleting one case from the fixture causes **both** suites to run one fewer test (proves both actually read it)
- [ ] `grep -rn "parseFloat\|Number(" lib/money.ts` returns nothing

```
feat(money): Decimal-exact money primitives locked by shared parity vectors

One fixture at shared/fixtures/gmp.vectors.json is consumed by both the
TypeScript suite and the Postgres suite, so client and server arithmetic
cannot diverge. Covers half-up rounding, line totals, tariff exposure and
contingency burn-down.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## T2 · Formula evaluator, both sides

**Why:** scope templates carry quantity formulas. They must evaluate identically wherever they run.

### Create

```
lib/formula.ts
lib/formula.test.ts
shared/fixtures/formula.vectors.json
supabase/migrations/<ts>_bn_formula.sql
```

### Grammar — deliberately minimal

```
number | variable | unary + - | binary + - * / | ( ) | round | min | max
```

**Explicitly rejected** by walking the parse tree and whitelisting node kinds: any other function, attribute access, subscripts, comparisons, power, modulo, and any identifier not supplied by the caller. Never `eval`, never `new Function`, never `Function()`.

### Guardrails, checked before any recursive work

```ts
const MAX_LEN = 256;
const MAX_DEPTH = 16;
```

### Behaviour
- All arithmetic in Decimal
- Unknown variable → throws `FormulaError('unknown_variable', name)`
- Division by zero → throws `FormulaError('division_by_zero')`. **Never return 0 silently.**
- Variable names normalise ASCII-only: lowercase, non-alphanumeric → `_`, collapse runs of `_`, leading digit gets `_` prefix. `"Treatment Rooms"` → `treatment_rooms`, `"2ndFloor"` → `_2ndfloor`

### `shared/fixtures/formula.vectors.json`

Include at minimum: name normalisation cases, evaluation cases, and error cases that **both** implementations reject.

```json
{
  "_contract": "Loaded by lib/formula.test.ts AND the SQL test. Error cases here are only ones BOTH sides reject.",
  "normalize": [
    { "raw": "Treatment Rooms", "out": "treatment_rooms" },
    { "raw": "Total SqFt",      "out": "total_sqft" },
    { "raw": "2ndFloor",        "out": "_2ndfloor" },
    { "raw": "a--b__c",         "out": "a_b_c" },
    { "raw": "  padded  ",      "out": "padded" },
    { "raw": "!!!",             "out": "" }
  ],
  "eval": [
    { "src": "qty * unit_cost", "vars": { "qty": "800", "unit_cost": "25.13" }, "out": "20104.00" },
    { "src": "round(total_sqft / 32, 0)", "vars": { "total_sqft": "1400" }, "out": "44" },
    { "src": "max(rooms, 2) * 1500", "vars": { "rooms": "1" }, "out": "3000" },
    { "src": "(a + b) * c", "vars": { "a": "2", "b": "3", "c": "4" }, "out": "20" },
    { "src": "-x + 10", "vars": { "x": "3" }, "out": "7" }
  ],
  "reject": [
    { "src": "qty ** 2",        "reason": "power_not_allowed" },
    { "src": "sqrt(9)",         "reason": "function_not_allowed" },
    { "src": "a.b",            "reason": "attribute_not_allowed" },
    { "src": "a > b",          "reason": "comparison_not_allowed" },
    { "src": "missing_var * 2", "vars": {}, "reason": "unknown_variable" },
    { "src": "1 / 0",          "reason": "division_by_zero" }
  ]
}
```

### Acceptance
- [ ] Every `eval` vector matches in TS and SQL
- [ ] Every `reject` vector throws in TS and raises in SQL
- [ ] A 300-character formula is rejected before parsing
- [ ] `grep -rniE "\beval\(|new Function|Function\(" lib/formula.ts` returns nothing

```
feat(formula): allow-listed Decimal formula evaluator, TS and SQL

Minimal grammar: arithmetic, parens, round/min/max, caller-supplied
variables only. Parse tree is walked and node kinds whitelisted; no eval
anywhere. Unknown variables and division by zero raise rather than
returning zero. Locked by shared/fixtures/formula.vectors.json on both
sides.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## T3 · Scope template schema with parameters

### Create `supabase/migrations/<ts>_scope_templates.sql`

Full DDL in `PHASE2_BUILD.md` §1, **plus** the parameter tables:

```sql
create table template_params (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid references scope_templates(id) on delete cascade,
  name        text not null,
  kind        text not null check (kind in ('input','constant','calculated')),
  label       text not null,
  unit        text,
  default_val numeric(14,4),     -- input only
  const_val   numeric(14,4),     -- constant only
  formula     text,              -- calculated only
  seq         int not null default 0,
  unique (template_id, name),
  constraint param_kind_fields check (
    (kind = 'input'      and default_val is not null and formula is null) or
    (kind = 'constant'   and const_val   is not null and formula is null) or
    (kind = 'calculated' and formula     is not null)
  )
);

alter table template_tasks add column quantity_formula text;
```

RLS: `bn_staff` only on both template tables. Templates are internal pricing IP.

### Create `lib/templates/params.ts`

Pure, database-free. Validates the parameter graph and resolves values in dependency order:

- unique names after normalisation
- every reference in a `calculated` formula resolves to another param
- **no cycles** — reject `area = l * h` together with `h = area / l` at save time, not at evaluation
- topological resolution, then expand each task's `quantity_formula`

Reuse `lib/formula.ts`. **Do not write a second evaluator.**

### Acceptance
- [ ] A template with 3 inputs, 1 constant and 2 calculated params resolves in correct order
- [ ] A cycle is rejected at save with a clear error naming both params
- [ ] A `calculated` formula referencing an undefined name is rejected at save
- [ ] A non-staff user receives zero rows from `scope_templates`

```
feat(templates): parametric scope templates with dependency resolution

Three parameter kinds (input, constant, calculated) with graph validation,
cycle detection and topological resolution. Task quantities are formulas
over those parameters, evaluated by lib/formula.ts. Templates are staff-only.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## T4 · Instantiate and schedule

### Create

```
lib/templates/instantiate.ts
lib/templates/schedule.ts
app/app/admin/projects/[id]/estimate/page.tsx
```

**Instantiate:** copy `template_tasks` into `scope_lines`, resolving params, evaluating each `quantity_formula`, computing `line_total` via `lib/money.ts` with tariff folded in. Carry `specified_mfr`, `specified_product`, `sourcing_origin`, `tariff_pct`, `alt_domestic_mfr`.

**Schedule:** topological sort over `depends_on`. Duration = `ceil(quantity / (production_rate * crew_size))`. Add `inspection_lead_days` before a successor whose predecessor has `needs_inspection`. Skip weekends. No constraint solver — this is a DAG walk.

### Acceptance
- [ ] A 20-task template instantiates with correct quantities from parameters
- [ ] Changing one input param and re-instantiating changes every dependent line
- [ ] The schedule respects `depends_on` and inserts inspection lead time
- [ ] Tariff is included in `line_total`, not bolted on at display time

```
feat(estimating): instantiate projects from templates with schedule generation

Parameters resolve, quantity formulas evaluate, tariff folds into line
totals at instantiation. Schedule is a topological walk honouring
dependencies and inspection lead days.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## T5 · Estimate worksheet

### Build `/app/admin/projects/[id]/estimate`

Columns: trade, title, qty, unit, unit cost, tariff exposure, line total, specified product, domestic alternative.

**Stale cost flag:** if `template_tasks.cost_updated` is older than 120 days, render the row with `--alert` and a "verify pricing" badge. A GMP built on year-old unit costs is how the reserve gets spent.

**Rollup:** scope total, tariff total, contingency, proposed ceiling — all from `lib/money.ts`. No arithmetic in the component.

### Acceptance
- [ ] Rollup figures match `lib/money.ts` output exactly
- [ ] A task with `cost_updated` 130 days ago shows the stale flag
- [ ] A line with `tariff_pct > 0` shows exposure and the domestic alternative
- [ ] No `toFixed`, `parseFloat` or `Number()` anywhere in the page component

```
feat(estimating): GMP worksheet with tariff exposure and stale-cost flags

All figures come from lib/money.ts; the component does no arithmetic.
Unit costs older than 120 days are flagged before they reach a ceiling.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## T6 · Change orders schema and the work block

### Create `supabase/migrations/<ts>_change_orders.sql`

DDL in `PHASE2_BUILD.md` §2: `co_reason` enum, `co_status` enum, `change_orders`, `co_scope_lines`, `scope_blocks`, and the `block_unsigned_work()` trigger.

**The trigger is the point of this task.** A scope line cannot move to `in_progress` or `complete` while a non-signed, non-void CO is linked through `scope_blocks`. Enforced in the database, not in application code, because schedule pressure is exactly when application-level policy gets bypassed.

Also add the `project_financials` view. Restrict it to `bn_staff` — it exposes `absorbed_losses`, which is your estimating accuracy record.

### Acceptance
- [ ] Inserting a `scope_blocks` row then updating that line to `in_progress` raises the exception
- [ ] Signing the CO clears the block and the update succeeds
- [ ] Voiding the CO also clears the block
- [ ] A non-staff user selecting from `project_financials` gets zero rows

```
feat(changeorders): schema with database-enforced work blocking

A scope line cannot start while an unsigned change order is linked to it.
Enforced by trigger rather than application policy. Adds project_financials
with absorbed_losses restricted to staff.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## T7 · Change order UI and signature

### Create

```
app/app/projects/[id]/changes/page.tsx
app/app/projects/[id]/changes/[coId]/page.tsx
app/app/admin/projects/[id]/changes/new/page.tsx
lib/co/project.ts
```

### Role projection — `lib/co/project.ts`, server-side

| Role | Sees | Cost delta | Reason | Can sign |
|---|---|---|---|---|
| `client`, `management_co` | all | ✅ | ✅ | ✅ |
| `bn_staff` | all | ✅ | ✅ | ❌ |
| `building_rep` | schedule impact only | ❌ | ❌ | ❌ |
| `expediter` | permit-affecting only | ❌ | ❌ | ❌ |
| `subcontractor` | own trade only | own scope only | ❌ | ❌ |

**Project `bn_error` as `scope_revision` for subcontractor viewers.** A sub must never see that you classified a change as your own mistake.

### Signature capture
Typed full name, plus server-captured `signature_ip` from the request. **Never read the IP from a client-supplied header.** Writes `signed_by`, `signed_name`, `signed_at`, `signature_ip`, sets status `signed`, logs `project_events`.

### Client-facing copy
Plain language. Reason renders as prose ("Found when we opened the wall"), never the enum value. Layout in `PHASE2_BUILD.md` §6.

### Acceptance
- [ ] A sub fetching a CO on another trade gets 404, not a filtered 200
- [ ] A building rep's network response contains no `cost_delta` key at all
- [ ] A sub's response shows `scope_revision`, never `bn_error`
- [ ] Signing records a server-derived IP
- [ ] Only `client` and `management_co` can reach the sign endpoint

```
feat(changeorders): role-gated CO views with server-side signature capture

Cost and reason are stripped server-side before props are built, not hidden
in CSS. bn_error projects as scope_revision for subcontractors. Signature IP
is derived from the request, never from a client header.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## T8 · Contingency burn-down

### Add to `/app/projects/[id]`

Bar for `client` and `management_co` only. Figures from `lib/money.ts` via the `project_financials` view. Fill `--forest` above 40% remaining, `--sand` at 15–40%, `--alert` below 15%.

### Acceptance
- [ ] Displayed remaining matches the T1 fixture for the same inputs
- [ ] A signed CO against contingency reduces the bar immediately
- [ ] A sub or building rep sees no bar and receives no contingency value in props

```
feat(projects): contingency burn-down for client and management roles

Figures sourced from lib/money.ts; the component renders, it does not
compute. Hidden and absent from props for trade and building roles.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## T9 · COI vault and assignment gate

### Create `supabase/migrations/<ts>_coi.sql`

DDL in `PHASE2_BUILD.md` §3: `buildings`, `cois`, `coi_compliant()`, and the `gate_sub_assignment()` trigger. Add `building_id` to `projects`.

**The gate is the point.** A sub without a compliant COI cannot be assigned to a scope line on a project with building requirements on file. Checks: verified, unexpired, GL limit meets requirement, WC present when required, and every `required_ai` entity appears in `additional_insured`.

### Create `/app/projects/[id]/insurance` and `/app/admin/insurance`

Upload, staff verification queue, status chips. COI files go to a **private** bucket with signed URLs — they carry policy numbers.

### Acceptance
- [ ] Assigning a sub with no COI raises the exception
- [ ] A COI missing one `required_ai` entity fails `coi_compliant`
- [ ] A COI expiring yesterday fails
- [ ] Trade licence numbers are absent from any member list rendered to non-staff
- [ ] COI files are not reachable without a signed URL

```
feat(coi): insurance vault with database-enforced assignment gate

A subcontractor without a verified, unexpired, limit-compliant COI naming
every required additional insured cannot be assigned to a scope line.
Certificate files live in a private bucket behind signed URLs.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## T10 · COI expiry sweep

### Create `supabase/functions/coi-sweep/index.ts`

Nightly via `pg_cron`.

| Days out | Action |
|---|---|
| 30 | Email holder + staff. Badge `--sand`. |
| 7 | Email holder + staff + PM. Badge `--alert`. |
| 0 | Email all. **Auto-unassign from future-dated scope lines only.** |

**Do not revert in-progress work.** A hard stop mid-task over a lapsed certificate creates a worse problem than the lapse. Flag it loudly and let the PM decide.

Every action writes `project_events`.

### Acceptance
- [ ] Running the sweep twice on the same day sends one notification set, not two
- [ ] A COI at exactly 30 and exactly 7 days fires the correct tier
- [ ] An expired COI unassigns a future-dated line and only flags an in-progress one

```
feat(coi): nightly expiry sweep with tiered alerts

30/7/0-day tiers. Expiry unassigns future-dated scope lines and flags
in-progress work rather than halting it. Idempotent per day.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## T11 · Stripe Connect onboarding

```bash
npm i stripe
```

### Create

```
app/app/payments/setup/page.tsx
app/api/stripe/onboard/route.ts
app/api/stripe/webhook/route.ts
```

Connect Express. **Stripe's hosted flow collects tax ID and bank details.** Never build your own bank-detail form. Store only `stripe_account_id` and `payouts_enabled`.

Webhook, signature-verified: `account.updated` syncs `payouts_enabled`; `transfer.paid`, `transfer.failed`, `payment_intent.succeeded` log to `payment_events`.

### Acceptance
- [ ] Onboarding completes in Stripe test mode and `payouts_enabled` syncs
- [ ] An unsigned webhook POST is rejected with 400
- [ ] No bank or tax identifier appears in any table or log line
- [ ] `STRIPE_SECRET_KEY` is absent from the client bundle

```
feat(payments): Stripe Connect Express onboarding with verified webhooks

Bank and tax details are collected by Stripe's hosted flow and never touch
our database. Webhook signature verification is mandatory.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## T12 · Milestone verification and release

### Create

```
app/app/admin/projects/[id]/milestones/page.tsx
supabase/functions/release-milestones/index.ts
```

**Verify:** PM uploads photos, marks verified, sets `release_eta = now() + 24h`.
**Dispute:** client may open one inside the window; sets `dispute_opened_at`, pauses release.
**Release:** every 15 minutes, transfer for milestones past `release_eta` with no dispute and no existing `stripe_transfer_id`.

**Idempotency key is `ms_${milestone.id}`.** Non-negotiable. A duplicate transfer is real money gone.

If `payouts_enabled` is false, log `transfer_failed` and notify. Do not retry blindly.

### Acceptance
- [ ] **Run the release job twice against the same due milestone — exactly one transfer exists**
- [ ] A dispute inside the window prevents release
- [ ] Resolving a dispute allows the next run to release
- [ ] A sub with `payouts_enabled: false` produces a logged failure and an alert
- [ ] A sub sees only their own milestones; a client sees all

```
feat(payments): milestone verification and idempotent release job

Verification opens a 24h dispute window; release transfers on expiry.
Every Stripe write carries an idempotency key derived from the milestone id,
so a re-run cannot double-pay.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## T13 · Prediction log (Phase 3 groundwork)

Cheap now, expensive to retrofit. The table only — no agents yet.

```sql
create table ai_predictions (
  id          uuid primary key default gen_random_uuid(),
  agent       text not null,
  task_type   text not null,
  project_id  uuid references projects(id) on delete cascade,
  confidence  numeric(4,3) not null check (confidence between 0 and 1),
  prediction  jsonb not null,
  envelope    jsonb not null,    -- rationale, sources, what_would_increase_confidence
  outcome     boolean,           -- null until resolved
  resolved_at timestamptz,
  resolved_by uuid references profiles(id),
  created_at  timestamptz default now()
);

create index on ai_predictions (agent, resolved_at) where outcome is not null;
```

RLS: staff only.

### Acceptance
- [ ] Migration applies
- [ ] `confidence` outside 0–1 is rejected
- [ ] Non-staff get zero rows

```
feat(ai): prediction log for Phase 3 calibration

Table only. Records stated confidence, a trust envelope and the realized
outcome so Brier score and calibration error can be computed once agents
land. Staff-only.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## T14 · Acceptance sweep and PR

Run every acceptance box from T1 to T13. Then:

### Leak audit — run these and confirm empty or expected

```bash
grep -rn "parseFloat\|toFixed\|Number(" lib/money.ts lib/formula.ts
grep -rniE "\beval\(|new Function" lib/
grep -rn "SUPABASE_SERVICE_ROLE_KEY" app/ components/ --include=*.tsx
grep -rn "STRIPE_SECRET" app/ components/ --include=*.tsx
```

### Manual verification — inspect the network response, not the rendered page

- [ ] Subcontractor on `/app/projects/[id]/scope` — no `gmp_ceiling`, no other trade's lines
- [ ] Building rep on the same route — no `unit_cost`, no `line_total` keys present
- [ ] Subcontractor on a CO — `scope_revision`, never `bn_error`
- [ ] Client on `/app/projects/[id]` — contingency present and matching the T1 fixture

```bash
git push
gh pr create --base main --head feat/phase-2-money-layer \
  --title "Phase 2 — money layer" \
  --body-file .github/PHASE2_PR.md
```

PR body: the full T1–T13 checklist, plus a note that the review targets are the two database triggers (T6, T9), the idempotency key (T12), and the server-side role projections (T7).

---

## Failure handling

| Situation | Do |
|---|---|
| Acceptance check fails | Fix before committing. Never commit red. |
| Migration conflicts with Phase 1 schema | Stop. Report the conflict. Do not alter Phase 1 tables without asking. |
| A spec assumption is wrong about existing code | Stop. Report what you found. Do not silently adapt the spec. |
| A Stripe test-mode call fails | Report the exact error. Do not retry a transfer. |
| Tempted to add a dependency | Ask first. |

---

## Task summary

| # | Task | Commits |
|---|---|---|
| T1 | Money primitives + parity vectors | 1 |
| T2 | Formula evaluator, TS + SQL | 1 |
| T3 | Template schema + params DAG | 1 |
| T4 | Instantiate + schedule | 1 |
| T5 | Estimate worksheet | 1 |
| T6 | CO schema + work block trigger | 1 |
| T7 | CO UI + signature | 1 |
| T8 | Contingency burn-down | 1 |
| T9 | COI vault + assignment gate | 1 |
| T10 | COI expiry sweep | 1 |
| T11 | Stripe Connect onboarding | 1 |
| T12 | Milestone release, idempotent | 1 |
| T13 | Prediction log | 1 |
| T14 | Acceptance sweep + PR | 0 |

**13 commits, 1 PR.** T1 and T2 are load-bearing. If they're not green, nothing after them can be trusted.
