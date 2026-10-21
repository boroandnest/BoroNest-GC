# Phase 2 Patch — corrections from live client documents

**Branch:** `feat/phase-2-money-layer` (same branch, append after T13)
**Source:** Veritas Property Management COI requirements (Fairfield Views Inc.), Waterford 3-building HPD engagement, Passport Platform spec.

Three real documents broke three assumptions in `PHASE2_BUILD.md`. Apply these before T14's acceptance sweep.

---

## P1 · COI schema is wrong

`buildings.required_ai text[]` cannot express what a real NYC managing agent requires.

**What Veritas actually demands for Fairfield Views Inc.:**

| # | Additional insured | Type |
|---|---|---|
| 1 | FAIRFIELD VIEWS INC. | static |
| 2 | VERITAS PROPERTY MANAGEMENT LLC | static |
| 3 | `{resident_name}`, Apt `{unit}` | **per-unit, resolved at project creation** |
| 4 | `{resident_phone}` | **per-unit** |

Certificate holder is a **separate** entity with a c/o address. Coverage includes **auto liability** and **employer's liability**, neither of which the schema has. And submission is gated: **four business days in advance, no exceptions** — a COI emailed the morning of work means the crew does not enter the building.

### Migration

```sql
-- buildings: separate the certificate holder from additional insured,
-- and template the per-unit entries
alter table buildings
  drop column required_ai,
  add column cert_holder_name   text,
  add column cert_holder_co     text,              -- "C/O VERITAS PROPERTY MANAGEMENT LLC"
  add column cert_holder_addr   text,
  add column required_ai_static text[] not null default '{}',
  add column required_ai_tokens text[] not null default '{}',
                                                    -- '{resident_name}, Apt {unit}'
  add column coi_lead_days      int not null default 4,
  add column coi_lead_is_business_days boolean default true,
  add column coi_recipients     text[] not null default '{}',
  add column required_auto      numeric(12,2) default 0,
  add column required_el        numeric(12,2) default 0;   -- employer's liability

-- cois: mirror the added coverage lines
alter table cois
  add column auto_limit numeric(12,2),
  add column el_limit   numeric(12,2),
  add column cert_holder_text text,                 -- as it appears on the ACORD
  add column submitted_at timestamptz;
```

### Token resolution

`required_ai_tokens` holds templates. At project creation, resolve against the unit record:

```ts
// lib/coi/tokens.ts
const TOKENS = ['resident_name', 'resident_phone', 'unit', 'building_name'] as const;

export function resolveAI(building: Building, unit: UnitContext): string[] {
  const dynamic = building.required_ai_tokens.map(t =>
    t.replace(/\{(\w+)\}/g, (_, k) => {
      if (!TOKENS.includes(k)) throw new CoiError('unknown_token', k);
      const v = unit[k];
      if (!v) throw new CoiError('missing_token_value', k);  // never silently blank
      return v;
    })
  );
  return [...building.required_ai_static, ...dynamic];
}
```

A missing resident name throws. It does not produce a COI with a blank line — that COI gets rejected and the crew loses a day.

### Compliance check, revised

`coi_compliant()` now also requires: `auto_limit >= required_auto` when `required_auto > 0`, `el_limit >= required_el` when `required_el > 0`, and every entry from `resolveAI()` present in `additional_insured`.

### The lead-time gate

New function, enforced where work is scheduled:

```sql
create or replace function coi_submitted_in_time(sub uuid, proj uuid, work_date date)
returns boolean as $$
declare lead int; biz boolean; sub_at timestamptz;
begin
  select bl.coi_lead_days, bl.coi_lead_is_business_days
    into lead, biz
  from projects p join buildings bl on bl.id = p.building_id
  where p.id = proj;

  if lead is null then return true; end if;

  select c.submitted_at into sub_at
  from cois c
  where c.holder_id = sub and c.project_id = proj and c.verified_at is not null
  order by c.submitted_at desc limit 1;

  if sub_at is null then return false; end if;

  return sub_at::date <= case
    when biz then bn_subtract_business_days(work_date, lead)
    else work_date - lead
  end;
end $$ language plpgsql stable;
```

`bn_subtract_business_days` skips weekends. Federal holidays are a known gap — document it rather than half-solving it.

### Acceptance additions to T9
- [ ] A building with token-based AI resolves `{resident_name}, Apt {unit}` correctly at project creation
- [ ] A missing resident name throws rather than emitting a blank AI line
- [ ] Certificate holder renders separately from additional insured
- [ ] A COI submitted 3 business days before work date fails `coi_submitted_in_time`
- [ ] A COI submitted 4 business days before passes
- [ ] Auto and employer's liability are checked when the building requires them

---

## P2 · Recurring retainer billing is missing

Phase 2 assumed every engagement bills on milestones. The Waterford portfolio bills **$22,500/month for four months**, then **$14,800/month for eight**. There is no milestone. Shipping Phase 2 without this means the live deal can't be invoiced through the platform.

```sql
create table retainers (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid references projects(id) on delete cascade,
  label          text not null,              -- 'Crisis response' | 'Steady state'
  monthly_amount numeric(12,2) not null,
  starts_on      date not null,
  ends_on        date,                       -- null = open-ended
  bill_day       int  not null default 1 check (bill_day between 1 and 28),
  status         text not null default 'active',   -- active | paused | ended
  created_at     timestamptz default now()
);

create table retainer_periods (
  id           uuid primary key default gen_random_uuid(),
  retainer_id  uuid references retainers(id) on delete cascade,
  period_start date not null,
  period_end   date not null,
  amount       numeric(12,2) not null,
  status       text not null default 'pending',   -- pending | invoiced | paid | disputed
  invoiced_at  timestamptz,
  paid_at      timestamptz,
  stripe_invoice_id text,
  deliverables_met boolean,                       -- the guarantee gate, see below
  notes        text,
  unique (retainer_id, period_start)
);
```

**Two things make this more than a subscription.**

A retainer can carry a **performance guarantee**. Waterford's steady-state tier promises zero violation growth or a 20% fee reduction. Model it:

```sql
alter table retainers
  add column guarantee_kind text,          -- 'no_violation_growth' | 'response_sla' | null
  add column guarantee_metric jsonb,       -- {"max_density": 1.0}
  add column guarantee_credit_pct numeric(4,2) default 0;
```

The monthly close job evaluates the guarantee against the violation register (P3) and sets `deliverables_met`. A failed month bills at `monthly_amount * (1 - guarantee_credit_pct/100)`. That credit is automatic and visible to the client — it is the reason the guarantee is credible.

**Materials pass through at cost plus a stated markup**, separately from the retainer:

```sql
create table material_passthroughs (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references projects(id) on delete cascade,
  period_start date not null,
  vendor      text not null,
  description text not null,
  cost        numeric(12,2) not null,
  markup_pct  numeric(4,2) not null default 10,
  invoice_path text,                        -- the actual vendor invoice, client-visible
  created_at  timestamptz default now()
);
```

The client sees the vendor invoice. That is the entire basis of "materials at cost + 10%" — without the invoice it's just a number.

### New task T15
- [ ] A retainer generates monthly periods automatically from `starts_on` and `bill_day`
- [ ] A period with `deliverables_met = false` bills at the reduced amount
- [ ] Material passthrough shows the vendor invoice to client and management roles only
- [ ] A sub sees no retainer or passthrough data at all
- [ ] Re-running the period generator does not create duplicate periods

```
feat(billing): recurring retainers with performance guarantees and material passthrough

Monthly retainer periods generate from a schedule rather than milestones.
A failed guarantee month bills at the credited rate automatically. Materials
pass through at cost plus a stated markup with the vendor invoice attached.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## P3 · Pull the violation register forward from Phase 3

The AEP density tracker is three columns and a trigger, and it is the single feature that justifies the Waterford engagement. Building 2 sits at 3.2 violations per unit against a 3.0 threshold — 7% over. Every day without a density number is a day the client is guessing.

```sql
create table violations (
  id            uuid primary key default gen_random_uuid(),
  building_id   uuid references buildings(id) on delete cascade,
  project_id    uuid references projects(id),
  hpd_id        text,                    -- HPD violation number
  class         text not null check (class in ('A','B','C','I')),
  unit          text,
  description   text not null,
  issued_on     date,
  correct_by    date,

  -- the four-state model: these are NOT the same event
  work_completed_at   timestamptz,
  client_accepted_at  timestamptz,
  certified_filed_at  timestamptz,       -- certification of correction submitted
  agency_closed_at    timestamptz,       -- HPD dismissed it

  evidence_status text not null default 'reported',
    -- reported | documented | professionally_assessed | disputed | unknown | superseded
  photo_paths   text[],
  created_at    timestamptz default now()
);

create index on violations (building_id) where agency_closed_at is null;
```

**Open means `agency_closed_at is null`.** Your crew finishing the work does not reduce the density. HPD closing the record does. Conflating those two is how a portfolio believes it escaped AEP and then gets designated.

```sql
create or replace view building_density as
select
  b.id as building_id,
  b.name,
  b.unit_count,
  count(v.id) filter (where v.agency_closed_at is null)                  as open_violations,
  count(v.id) filter (where v.agency_closed_at is null and v.class='C')  as open_class_c,
  count(v.id) filter (where v.work_completed_at is not null
                        and v.agency_closed_at is null)                  as awaiting_closure,
  round(count(v.id) filter (where v.agency_closed_at is null)::numeric
        / nullif(b.unit_count, 0), 2)                                    as density,
  case
    when b.unit_count is null or b.unit_count = 0 then 'unknown'
    when count(v.id) filter (where v.agency_closed_at is null)::numeric
         / b.unit_count >= 3.0 then 'over_threshold'
    when count(v.id) filter (where v.agency_closed_at is null)::numeric
         / b.unit_count >= 2.5 then 'approaching'
    else 'clear'
  end as aep_status
from buildings b
left join violations v on v.building_id = b.id
group by b.id, b.name, b.unit_count;
```

Add `unit_count` to `buildings` — the Waterford deliverable estimated Building 3 at "~22 pending verification" while the density math treated it as fact. Make unverified counts explicit:

```sql
alter table buildings
  add column unit_count int,
  add column unit_count_verified boolean default false,
  add column unit_count_source text;
```

The density view returns `'unknown'` rather than a number when `unit_count` is null. An unverified count renders with a caveat in the UI. A density figure built on a guess is worse than no figure.

### New task T16
- [ ] A building with 79 open violations across 18 units reports density 4.39 and `over_threshold`
- [ ] Marking work complete does **not** change density; only `agency_closed_at` does
- [ ] `awaiting_closure` counts the gap between finished work and HPD closure
- [ ] A building with null `unit_count` returns `'unknown'`, never a computed density
- [ ] Client and management see density; subs see none of it

```
feat(compliance): violation register with four-state closure and AEP density

Work completed, client accepted, certification filed and agency closed are
separate timestamps. Density counts only agency-closed records, so finishing
work does not create a false sense of escaping AEP designation.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## P4 · Storage will hit a wall

Waterford alone: 68 units, weekly photo documentation, twelve months. At roughly 20 photos per unit per week and 3 MB each, that is about **200 GB in year one for one portfolio**. Supabase's included storage does not cover it, and egress on a photo-heavy portal is the line item that surprises people.

**Move file storage to an S3-compatible bucket behind the app, not to Supabase Storage.** Cloudflare R2 has no egress fees, which matters when boards and managing agents are pulling photo sets. The API is S3-compatible, so R2, S3 and MinIO are interchangeable and nothing in your code binds to a vendor.

```ts
// lib/storage.ts — the only file that knows which provider is behind it
import { S3Client } from '@aws-sdk/client-s3';

export const storage = new S3Client({
  region: 'auto',
  endpoint: process.env.S3_ENDPOINT,     // R2, AWS, or MinIO locally
  credentials: {
    accessKeyId: process.env.S3_KEY!,
    secretAccessKey: process.env.S3_SECRET!,
  },
});
```

Everything else calls `getSignedUrl()` and `putObject()` from this module. Swapping provider is an environment variable.

Also compress on upload. A 3 MB phone photo becomes a 400 KB WebP that is still legible as violation evidence — roughly a 7× reduction before anything else.

### Acceptance
- [ ] `grep -rn "supabase.storage" app/ lib/` returns nothing outside `lib/storage.ts`
- [ ] Changing `S3_ENDPOINT` to a local MinIO instance works without code changes
- [ ] Uploaded photos are compressed; originals are retained only when flagged as evidence

---

## P5 · Four ideas worth taking from the Passport spec

**The four-state completion model** is already in P3. It is the single best idea in that document.

**Evidence status, not a boolean.** Apply the `evidence_status` enum from P3 to findings generally. A condition someone reported by phone and a condition a QEWI engineer assessed are not the same fact, and a `verified` checkbox hides which one you have.

**Space and occupancy as separate records.** A ground-floor retail space you build out three times for three tenants is one space with three occupancies. Phase 2 does not need this. Phase 3 does, before you have two projects at the same address and no way to relate them:

```sql
create table spaces (
  id          uuid primary key default gen_random_uuid(),
  building_id uuid references buildings(id) on delete cascade,
  label       text not null,              -- 'Ground floor retail', 'Apt 3H'
  kind        text not null,              -- residential | retail | office | common
  sqft        int
);

create table occupancies (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid references spaces(id) on delete cascade,
  occupant   text not null,
  starts_on  date,
  ends_on    date
);

alter table projects add column space_id uuid references spaces(id);
```

A new tenant may inherit authorized facts about installed equipment and prior physical work. They do not inherit the previous tenant's budget.

**Savings labels on every figure.** Observed / estimated capacity / realized cash / risk hypothesis / unverified. Had the Waterford deliverable used this taxonomy, the 84% error could not have shipped — a figure excluding $687,000 of remediation would have been labeled and caught.

What to **leave**: the six-phase sequence, the Acqivest handoff layer, the outcomes module, and the full passport page inventory. That spec builds a records platform. You are building a money platform with records attached, and the ordering matters.

---

## Revised task count

| # | Task | Status |
|---|---|---|
| T1–T13 | As specced in `PHASE2_EXECUTE.md` | unchanged |
| **P1** | COI schema correction | **fold into T9** |
| **T15** | Retainer billing + guarantees + passthrough | **new** |
| **T16** | Violation register + AEP density | **new** |
| **P4** | S3-compatible storage abstraction | **fold into T1** |
| T14 | Acceptance sweep + PR | run last, includes P1/T15/T16 checks |

**16 commits, 1 PR.**

T16 is the one with a live deal behind it. If Waterford signs before Phase 2 closes, that is the module that has to exist.
