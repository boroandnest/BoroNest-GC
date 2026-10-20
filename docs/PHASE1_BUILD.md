# Boro & Nest Collective — Phase 1 Build Spec

**Target branch:** `feat/phase-1-workspace`
**Base:** current `main` (live at `boro-gmp.emergent.host`)
**Goal:** turn the marketing shell into a working workspace. Real auth, real projects, role-gated scope and pricing, and a project message thread.

---

## 0. What exists and what we are adding

### Already built (do not rebuild)
- Marketing pages: `/`, `/services`, `/about`, `/join`, `/book-call`
- Role gateway at `/join` with five personas
- Multi-step join forms at `/join/client`, `/join/management`, `/join/building-rep`, `/join/expediter`, `/join/subcontractor`
- Login page shape at `/login`
- Seven-phase project model already published on the homepage
- "Ask Nest" floating widget

### Phase 1 adds
1. Supabase auth + persistence behind the existing join and login forms
2. `/app` workspace with role-gated routing
3. Project record with scope of work and GMP pricing
4. **Role-gated pricing visibility** — the critical rule, see §4
5. Project message thread
6. Every CTA on the site resolves to a real destination

### Explicitly out of scope for Phase 1
COI vault, board package workspace, change orders, risk engine, Nest RAG, Stripe, floor-plan overlay, certified payroll. These are Phase 2+. Do not scaffold them.

---

## 1. Stack

Keep whatever the current build uses. Add:

- **Supabase** — Postgres, Auth (magic link), Storage, RLS
- No new UI framework. Match the existing component style.

```bash
npm i @supabase/supabase-js @supabase/ssr
```

Env vars:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server-only, never expose to client
```

---

## 2. Database schema

Run as a single migration. Order matters.

```sql
-- ── enums ────────────────────────────────────────────────────────
create type party as enum (
  'client',          -- owner / tenant
  'management_co',   -- portfolio ops
  'building_rep',    -- super / landlord / board member
  'expediter',       -- DOB filings
  'subcontractor',   -- licensed trade
  'bn_staff'         -- Boro & Nest internal
);

create type project_phase as enum (
  'discovery','design','permitting','procurement',
  'construction','punch_list','close_out'
);

create type account_status as enum ('pending','verified','suspended');

-- ── profiles ─────────────────────────────────────────────────────
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  email       text not null,
  phone       text,
  company     text,
  role        party not null,
  status      account_status not null default 'pending',
  -- trade pros only
  license_no  text,
  trades      text[],
  created_at  timestamptz default now()
);

-- client + management_co + building_rep auto-verify.
-- expediter + subcontractor stay 'pending' until bn_staff approves.
create or replace function auto_verify() returns trigger as $$
begin
  if new.role in ('client','management_co','building_rep') then
    new.status := 'verified';
  end if;
  return new;
end $$ language plpgsql;

create trigger trg_auto_verify before insert on profiles
  for each row execute function auto_verify();

-- ── projects ─────────────────────────────────────────────────────
create table projects (
  id             uuid primary key default gen_random_uuid(),
  code           text unique not null,        -- BN-0042
  name           text not null,               -- "Lume Café — Williamsburg"
  address        text not null,
  borough        text,
  bin            text,                        -- DOB Building ID Number
  bbl            text,                        -- Borough-Block-Lot
  scope_type     text not null,               -- commercial_buildout | gut_reno | ll11_facade | ll97_retrofit
  phase          project_phase not null default 'discovery',
  gmp_ceiling    numeric(12,2),
  contingency    numeric(12,2) default 0,
  target_start   date,
  target_co      date,                        -- target certificate of occupancy
  created_at     timestamptz default now()
);

-- ── membership: drives every RLS policy ──────────────────────────
create table project_members (
  project_id uuid references projects(id) on delete cascade,
  user_id    uuid references profiles(id)  on delete cascade,
  role       party not null,
  -- subs only: restricts which scope lines they can see
  scope_trades text[],
  added_at   timestamptz default now(),
  primary key (project_id, user_id)
);

create index on project_members (user_id);

-- ── scope of work ────────────────────────────────────────────────
create table scope_lines (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references projects(id) on delete cascade,
  seq           int  not null,
  trade         text not null,               -- demolition | electrical | plumbing | hvac | millwork ...
  title         text not null,
  description   text,
  unit          text,                        -- sqft | ea | lf | ls
  quantity      numeric(10,2),
  -- PRICING: never expose these three to a sub outside their own trade
  unit_cost     numeric(10,2),
  line_total    numeric(12,2),
  is_allowance  boolean default false,
  status        text default 'not_started',  -- not_started | in_progress | complete
  assigned_sub  uuid references profiles(id),
  specified_mfr text,                        -- from the manufacturer database
  specified_product text,
  created_at    timestamptz default now()
);

create index on scope_lines (project_id, seq);

-- ── payment milestones ───────────────────────────────────────────
create table milestones (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references projects(id) on delete cascade,
  seq         int not null,
  title       text not null,
  trigger     text not null,                 -- plain language: "Rough plumbing inspection passed"
  amount      numeric(12,2) not null,
  payee_id    uuid references profiles(id),  -- null = client-to-BN draw
  status      text default 'pending',        -- pending | verified | paid
  verified_at timestamptz,
  verified_by uuid references profiles(id),
  paid_at     timestamptz
);

-- ── messages ─────────────────────────────────────────────────────
create table messages (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references projects(id) on delete cascade,
  author_id   uuid references profiles(id),
  body        text not null,
  -- visibility: who can read this message
  audience    party[] not null default
              '{client,management_co,building_rep,expediter,subcontractor,bn_staff}',
  created_at  timestamptz default now()
);

create index on messages (project_id, created_at desc);

-- ── event log: write to this from day one ────────────────────────
-- Phase 2's risk engine trains on it. Costs nothing now, expensive to retrofit.
create table project_events (
  id         bigserial primary key,
  project_id uuid references projects(id) on delete cascade,
  actor_id   uuid references profiles(id),
  actor_role party,
  kind       text not null,   -- phase_change | scope_updated | milestone_verified
                              -- | message_posted | member_added | login
  payload    jsonb not null default '{}',
  at         timestamptz default now()
);

create index on project_events (project_id, kind, at desc);
```

---

## 3. Row Level Security

Enable on every table. These policies are the product, not boilerplate.

```sql
alter table profiles        enable row level security;
alter table projects        enable row level security;
alter table project_members enable row level security;
alter table scope_lines     enable row level security;
alter table milestones      enable row level security;
alter table messages        enable row level security;
alter table project_events  enable row level security;

-- helper: is the current user on this project?
create or replace function is_member(p uuid) returns boolean as $$
  select exists (
    select 1 from project_members
    where project_id = p and user_id = auth.uid()
  );
$$ language sql security definer stable;

-- helper: current user's role on this project
create or replace function my_role(p uuid) returns party as $$
  select role from project_members
  where project_id = p and user_id = auth.uid();
$$ language sql security definer stable;

-- helper: is the current user Boro & Nest staff?
create or replace function is_staff() returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'bn_staff'
  );
$$ language sql security definer stable;

-- profiles: read own, staff reads all
create policy p_own on profiles for select
  using (id = auth.uid() or is_staff());
create policy p_update_own on profiles for update
  using (id = auth.uid());

-- projects: members only
create policy pr_member on projects for select
  using (is_member(id) or is_staff());

-- project_members: see co-members on your own projects
create policy pm_member on project_members for select
  using (is_member(project_id) or is_staff());

-- scope_lines: SEE §4 — this is the pricing gate
create policy sl_read on scope_lines for select
  using (
    is_staff()
    or (
      is_member(project_id)
      and (
        my_role(project_id) in ('client','management_co','expediter')
        or my_role(project_id) = 'building_rep'
        or (
          my_role(project_id) = 'subcontractor'
          and trade = any (
            select unnest(scope_trades) from project_members
            where project_id = scope_lines.project_id and user_id = auth.uid()
          )
        )
      )
    )
  );

-- milestones: client sees all; sub sees only their own
create policy ms_read on milestones for select
  using (
    is_staff()
    or (is_member(project_id) and my_role(project_id) in ('client','management_co'))
    or (payee_id = auth.uid())
  );

-- messages: audience array gate
create policy msg_read on messages for select
  using (is_staff() or (is_member(project_id) and my_role(project_id) = any(audience)));

create policy msg_write on messages for insert
  with check (is_member(project_id) and author_id = auth.uid());

-- events: staff + client read, everyone writes via trigger
create policy ev_read on project_events for select
  using (is_staff() or (is_member(project_id) and my_role(project_id) in ('client','management_co')));
```

---

## 4. Pricing visibility — the rule that matters most

**Do not render a single dollar figure without checking the viewer's role.** Getting this wrong leaks margin to the trades.

| Role | GMP ceiling | Scope line totals | Unit costs | Their own milestone $ | Other subs' $ | Contingency |
|---|---|---|---|---|---|---|
| `client` | ✅ | ✅ all | ✅ | ✅ | ✅ | ✅ |
| `management_co` | ✅ | ✅ all | ✅ | ✅ | ✅ | ✅ |
| `bn_staff` | ✅ | ✅ all | ✅ | ✅ | ✅ | ✅ |
| `expediter` | ❌ | ✅ titles only, **no $** | ❌ | ❌ | ❌ | ❌ |
| `building_rep` | ❌ | ✅ titles only, **no $** | ❌ | ❌ | ❌ | ❌ |
| `subcontractor` | ❌ | ✅ **own trade only** | ✅ own only | ✅ | ❌ | ❌ |

Implement as a server-side projection, not a CSS hide:

```ts
// lib/scope.ts — strip before it reaches the client bundle
type Viewer = { role: Party; trades?: string[] };

export function projectScope(lines: ScopeLine[], v: Viewer) {
  const full = ['client', 'management_co', 'bn_staff'].includes(v.role);
  if (full) return lines;

  if (v.role === 'subcontractor') {
    return lines
      .filter(l => v.trades?.includes(l.trade))
      .map(l => ({ ...l }));          // keeps $ for their own trade
  }

  // expediter + building_rep: scope visible, money removed
  return lines.map(({ unit_cost, line_total, ...rest }) => rest);
}
```

Same treatment for `gmp_ceiling` and `contingency` on the project object. Never ship them in props for a role that cannot see them.

---

## 5. Routes to build

```
/login                      existing shell → wire to Supabase magic link
/join/[role]                existing 3-step forms → persist on final step
/auth/callback              new — magic link handler

/app                        new — redirects by role
/app/projects               project list (filtered by membership)
/app/projects/[id]          overview: phase tracker, GMP summary (role-gated)
/app/projects/[id]/scope    scope of work table (role-gated columns)
/app/projects/[id]/payments milestones (role-gated rows)
/app/projects/[id]/messages thread
/app/projects/[id]/team     members list, no contact details for subs

/app/admin                  bn_staff only
/app/admin/verify           approve pending expediters + subs
/app/admin/projects/new     create project, add members, enter scope
```

### Auth flow
1. `/join/[role]` step 3 submit → `supabase.auth.signInWithOtp({ email })` + insert `profiles` row
2. Email magic link → `/auth/callback` → exchange code → redirect `/app`
3. `/app` reads `profiles.status`:
   - `verified` → `/app/projects`
   - `pending` → `/app/pending` (a simple "we're reviewing your application" page)
4. `/login` is the same `signInWithOtp` call, no password field. Keep the existing single-email UI — it was already built for this.

---

## 6. Every button must resolve

Audit pass. Current site has CTAs that go nowhere useful once auth exists.

| Location | Current | Phase 1 target |
|---|---|---|
| Home hero "Book a Scoping Call" | `/book-call` | keep |
| Home hero "See How It Works" | `#how-it-works` | keep |
| Nav "Get Started" | `/join` | keep |
| `/services` "Talk to Nest" | links to homepage — **broken intent** | open Ask Nest panel |
| `/join/[role]` "Continue" | advances step | persist + advance; step 3 creates account |
| `/login` "Sign in" | unknown | `signInWithOtp` → confirmation state |
| Any `/app` link when logged out | — | redirect `/login?next=` |
| Role cards on `/join` | correct | keep |

Add to the nav when a session exists: **Workspace →** linking `/app`. Replace **Get Started** with it.

---

## 7. Design tokens

Apply the brand system. Do not introduce new colors.

```css
:root {
  --forest:   #253D35;   /* primary, headers, nav */
  --forest-d: #16241F;   /* deep backgrounds */
  --cream:    #F6F2EC;   /* page background */
  --sand:     #C8B89A;   /* accent, CTAs, data highlights */
  --alert:    #D4654A;   /* ONLY for genuine problems — never decoration */

  --font-display: 'Playfair Display', serif;   /* headlines, big numbers, ≥18px only */
  --font-body:    'Inter', sans-serif;         /* everything functional */
  --font-mono:    'JetBrains Mono', monospace; /* labels, codes, data, CTAs */
}
```

**Mono rules:** uppercase, 1–2.6px letter-spacing, 9–11px. Use for: section labels, project codes (BN-0042), phase names, dollar figures in tables, button text.

**Alert color discipline:** `--alert` appears only where something is actually wrong — an overdue milestone, a failed inspection, a pending verification that's aged out. Its scarcity is what makes it work. Never as a brand accent.

### Move Ask Nest into the nav
Currently a floating bubble, which reads as support chat. Make it a nav pill:

```
┌──────────────────────────────────────────────────────────┐
│  Boro & Nest    Services  About  Workspace   ✦ Ask Nest →│
└──────────────────────────────────────────────────────────┘
```
Styling: `background: rgba(200,184,154,.11)`, `border: 1px solid rgba(200,184,154,.38)`, `border-radius: 20px`, mono label in `--sand`.

### Phase tracker component
Reuse the seven phases already on the homepage. In `/app/projects/[id]` render as a horizontal stepper: completed phases filled `--forest`, current phase filled `--sand`, future phases outlined `--bdr`.

---

## 8. Seed data

Create one real project so the workspace isn't empty on first login. Use the actual Bronx job.

```sql
insert into projects (code, name, address, borough, scope_type, phase, gmp_ceiling, contingency, target_co)
values ('BN-0001', 'Unit 3H Renovation', '3215 Arlington Ave, Bronx NY', 'Bronx',
        'gut_reno', 'construction', <ceiling>, <contingency>, <date>);
```

Add scope lines by trade with real quantities and the specified manufacturers from the manufacturer database. Add milestones matching the agreed payment schedule. Add the client as a `client` member and at least one trade as a `subcontractor` member with `scope_trades` set, so the pricing gate can be verified end to end.

---

## 9. Acceptance criteria

Phase 1 ships when all of these pass:

- [ ] A new client completes `/join/client` and receives a magic link
- [ ] Clicking the link lands them in `/app/projects` with their project visible
- [ ] A subcontractor signs up and lands on `/app/pending` until staff verifies them
- [ ] `bn_staff` can verify a pending sub from `/app/admin/verify`
- [ ] Client at `/app/projects/[id]/scope` sees every line with unit cost and line total
- [ ] **Subcontractor at the same URL sees only their trade's lines** — verify by inspecting the network response, not just the UI
- [ ] **Building rep at the same URL sees line titles and zero dollar figures** — verify in the network response
- [ ] Client sees the GMP ceiling and contingency; sub and building rep receive neither in props
- [ ] Any user on a project can post a message; the thread renders newest-last
- [ ] A message with a restricted `audience` is invisible to excluded roles
- [ ] Every CTA in §6 reaches a real destination
- [ ] Logged-out access to any `/app` route redirects to `/login`
- [ ] Phase tracker reflects `projects.phase`
- [ ] Writes land in `project_events` for: login, phase_change, scope_updated, milestone_verified, message_posted

---

## 10. Security notes

- `SUPABASE_SERVICE_ROLE_KEY` is server-only. If it reaches a client bundle, RLS is bypassed entirely and subs can read the full GMP.
- The pricing projection in §4 runs server-side. A client-side filter is not a security control.
- Do not log full scope rows or milestone amounts to the browser console.
- Trade professional license numbers are collected but are not public — exclude from any member list rendered to non-staff.

---

## 11. Commit and PR

```bash
git checkout -b feat/phase-1-workspace
# ... work ...
git add -A
git commit -m "feat(phase-1): auth, workspace, role-gated scope and pricing

Adds Supabase auth behind existing join/login shells, /app workspace
with per-role routing, project + scope_lines + milestones + messages
schema with RLS, and server-side pricing projection so subcontractors
and building reps never receive GMP or other trades' costs in props.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push -u origin feat/phase-1-workspace
```

PR description should list the §9 acceptance criteria as a checklist and call out the §4 pricing table as the primary review target.

---

## 12. Deliberately deferred

Do not build these in Phase 1, even if they seem quick:

| Deferred | Why | Phase |
|---|---|---|
| COI vault | Needs building-specific insurance requirements that don't exist yet | 2 |
| Board package workspace | Needs a real co-op job to model the review loop against | 3 |
| Change orders | Needs scope baselined first | 2 |
| Risk engine | Needs `project_events` to accumulate | 3 |
| Nest RAG | Needs document corpus; keep the current widget scoped to pre-sale questions | 3 |
| Stripe Connect | Milestones must be verified manually first | 2 |
| Floor-plan overlay | Sales asset, not operations | 3 |
| Certified payroll | Compliance liability; needs a won government contract first | 4 |

**On the Ask Nest widget:** until the RAG layer exists, scope it to pre-sale questions only and give it a hard fallback to a contact form. A confident wrong answer about an LL11 cure window in front of a board president is worse than no widget.
