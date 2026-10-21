## Phase 2 — money layer (and Phase 1)

This branch was built on `feat/phase-1-workspace`, so **merging this PR ships Phase 1 (secure auth, role-gated pricing) and Phase 2 together.**

Stack: **MongoDB + JavaScript**, as chosen when Phase 2 started. Every Postgres/Supabase construct in `PHASE2_EXECUTE.md` / `PHASE2_PATCH.md` is mapped in [`docs/PHASE2_STATUS.md`](../docs/PHASE2_STATUS.md). `PHASE2_BUILD.md` was not available, and every schema inference is listed there for review.

### Review targets
- **Database-enforced rules (the spec's two triggers):**
  - `migrations/002_change_orders.js`: a scope line cannot be `in_progress`/`complete` with an open change-order block.
  - `migrations/003_coi.js`: a scope line cannot carry `assignedSub` without the `assignedCoiId` that justified it.
  - Both are MongoDB collection validators, tested with raw driver writes.
- **Idempotent release (T12):** `lib/payments/release.js`. Atomic claim, then Stripe idempotency key `ms_${milestone.id}`, then the validator (released ⇒ `stripeTransferId`) and a unique index on `stripeTransferId`.
- **Server-side role projections (T7 and the rest):** `lib/co/project.js`, `lib/visibility.js`, `lib/coi/views.js`, `lib/billing/http.js`.

### Acceptance checklist
- [x] T1 Money primitives: fixture consumed by both suites; deleting a case reduces both; no float conversions in `lib/money.js`
- [x] T2 Formula evaluator: eval/reject vectors in both suites; 300-char formula rejected before parsing; no eval
- [x] P4 Storage: no `supabase.storage`; S3 endpoint swap is env-only (moto); photos compressed, originals only as evidence
- [x] T3 Templates: 3 inputs + 1 constant + 2 calculated resolve in order; cycle names both params; undefined ref rejected; non-staff get no rows
- [x] T4 Instantiate: 20-task template; changing one input changes every dependent line; schedule honours depends_on + inspection lead; tariff inside line_total
- [x] T5 Worksheet: rollup equals lib/money; 130-day stale flag; tariff exposure + domestic alternative; no toFixed/parseFloat/Number() in the page
- [x] T6 Work block: block → in_progress refused (API 409 and DB); signing clears; voiding clears; financials staff-only
- [x] T7 CO views: sub on another trade's CO → 404; building rep has no `costDelta` key; sub sees `scope_revision`; server-derived signature IP; only client/management can sign
- [x] T8 Contingency bar: matches T1 fixture; moves on signature; absent from sub/rep responses
- [x] T9 + P1 COI: no COI → refused; missing AI entity fails; expired yesterday fails; licences hidden from non-staff; files only via signed URL; per-unit AI resolves at creation; missing resident name throws; holder separate from AI; 3 business days fails, 4 passes; auto + employer's liability checked
- [x] T10 Sweep: idempotent per day; exact 30/7-day tiers; expired → future lines unassigned, in-progress lines flagged
- [x] T11 Stripe: unsigned webhook → 400; payouts_enabled syncs (signed event); no bank/tax data stored; no secret in client bundle. Not verified: live test-mode onboarding (needs keys)
- [x] T12 Release: two runs (also concurrent) → exactly one transfer; a dispute blocks release; resolving releases; payouts disabled → logged failure + alert; subs see only their own milestones
- [x] T13 Prediction log: migration applies; confidence outside 0–1 rejected by the DB; non-staff get no rows
- [x] T15 Retainers: monthly periods from starts_on/bill_day; failed guarantee bills the reduced amount; vendor invoice visible to client/management only; subs see nothing; no duplicate periods
- [x] T16 Violations: 79/18 → 4.39 over_threshold; finishing work doesn't change density, only agency closure does; awaiting_closure; null unit count → unknown; subs see none
- [x] T14 Leak audit clean; network-response checks automated

**Tests:** 144 unit + 20 Phase 1 end-to-end + 45 Phase 2 end-to-end, all passing against a real MongoDB 8.0. A Phase 1-shaped database migrates cleanly through 001–009.

### Before/after merging
Set the env vars in `docs/PHASE2_STATUS.md` (`CRON_SECRET`, `STRIPE_*`, optional `S3_*`) and the GitHub secrets `APP_URL` + `CRON_SECRET`. Then run Stripe in test mode once.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EECo4mF3SA7hWh7g9PV5vg
