# Phase 2 — status, decisions and handoff

Branch: `feat/phase-2-money-layer`. It was branched from `feat/phase-1-workspace`, so merging it ships Phase 1 and Phase 2 together.

Specs: [`PHASE2_EXECUTE.md`](PHASE2_EXECUTE.md) and [`PHASE2_PATCH.md`](PHASE2_PATCH.md). `PHASE2_BUILD.md` and `OCERP_DEEP_DIVE.md` were never provided. Every schema detail they would have defined was inferred from the runbook and patch, and is listed under **Inferences to review**.

## Result

| Task | What | Commit | Acceptance |
|---|---|---|---|
| T1 | Decimal money primitives + shared parity fixture | `cef0d92` | ✅ all |
| T2 | Allow-listed formula evaluator | `a5c7fbe` | ✅ all |
| P4 | S3-compatible storage (R2/S3/MinIO), photo → WebP | `7c7baf7` | ✅ all (tested on moto, not real MinIO) |
| T3 | Parametric templates, cycle detection | `6c2d152` | ✅ all |
| T4 | Instantiate + schedule | `2f914c0` | ✅ all |
| T5 | GMP worksheet, stale-cost flags | `b5db596` | ✅ all |
| T6 | Change orders + DB-enforced work block | `9cc0c1f` | ✅ all |
| T7 | Role-gated CO views + signature | `6980ec3` | ✅ all |
| T8 | Contingency burn-down | `9df6c55` | ✅ all |
| T9 + P1 | COI vault, assignment gate, per-unit AI, lead time | `0001514` | ✅ all |
| T10 | COI expiry sweep | `37e4683` | ✅ all |
| T11 | Stripe Connect Express onboarding + webhooks | `d14361d` | ✅ except live test-mode onboarding (no Stripe keys here) |
| T12 | Milestone verification + idempotent release | `fe7c6d6` | ✅ all (with a Stripe double; live transfers need keys) |
| T13 | AI prediction log | `67373a8` | ✅ all |
| T16 | Violation register + AEP density | `6dfc57b` | ✅ all |
| T15 | Retainers, guarantees, material pass-through | `5d03906` | ✅ all |
| T14 | Acceptance sweep + leak audit + PR | this doc | ✅ see below |

T16 was built before T15 because T15's no-violation-growth guarantee is evaluated against T16's register.

### Final sweep (fresh MongoDB 8.0, real `mongod`)

- `npm test`: 144/144 unit tests. These include a live MongoDB Decimal128 round-trip and S3 via moto.
- `tests/api_access_test.mjs` (Phase 1): 20/20.
- `tests/phase2_api_test.mjs` (Phase 2): 45/45.
- **Upgrade simulation:** a Phase 1-shaped database (legacy change orders, numeric milestones and scope lines, existing seed marker) migrates cleanly through 001–009, and the app serves it with zero API errors.
- **Leak audit:**
  - no `parseFloat` / `toFixed` / `Number(` in `lib/money.js` or `lib/formula.js`
  - no `eval(` / `new Function` in `lib/`
  - no secret env names in client pages or components
  - no `sk_` / `whsec_` / secret names in `.next/static`
  - none of those numeric conversions in any money page

**Network-response checks (§T14 manual list), automated in the suites:**
- A sub's scope response has no `gmpCeiling` and no other trade's lines.
- A building rep's scope response has no `unitCost` / `lineTotal` keys.
- A sub viewing a CO sees `scope_revision`, never `bn_error`.
- The client's contingency figures match the T1 fixture: 21000.00 remaining, 65.63%.

## How Postgres/Supabase maps to this app (MongoDB + JS)

| Spec | Here |
|---|---|
| `supabase/migrations/*.sql` | `migrations/00N_*.js`. Each one runs once, recorded in `_migrations`, applied at startup or by `npm run migrate`. |
| CHECK constraints / enums | Collection validators (`$jsonSchema` + query rules). MongoDB rejects bad writes from any client, not just the app. |
| T6 `block_unsigned_work()` trigger | `scope_lines.openBlocks` + a validator: no write can leave a line `in_progress`/`complete` with open blocks (raw-write tested). |
| T9 `gate_sub_assignment()` trigger | Single assignment path `lib/coi/gate.js` + a validator: `assignedSub` requires `assignedCoiId` (raw-write tested). MongoDB can't run cross-collection checks in a validator, so the compliance logic itself is app-side. |
| `numeric` money | Decimal128 in storage, decimal.js in code, strings in JSON. No float ever reaches a browser. |
| `bn_*` plpgsql mirrors (T1/T2) | One JS implementation shared by server and browser. The second suite checks the BSON/Decimal128 storage path instead. |
| Views (`project_financials`, `building_density`) | Pure functions (`lib/co/financials.js`, `lib/compliance/density.js`) behind role-checked endpoints |
| RLS | `lib/access.js` + per-route checks + projections (`lib/visibility.js`, `lib/co/project.js`, `lib/coi/views.js`) |
| pg_cron / edge functions | `POST /api/cron/{coi-sweep,release-milestones,retainers}` with `Authorization: Bearer $CRON_SECRET`, scheduled by `.github/workflows/cron.yml` |
| Supabase Storage (private bucket) | `lib/storage.js`: an S3-compatible bucket with presigned URLs, or local disk with HMAC-signed expiring URLs |

## Inferences to review (no `PHASE2_BUILD.md`)

1. **CO reasons:** `owner_request`, `unforeseen_condition`, `code_requirement`, `design_change`, `value_engineering`, `bn_error`.
   - **Statuses:** `draft`, `pending_signature`, `signed`, `void`.
   - **Client prose:** in `lib/co/financials.js` (`REASON_PROSE`).
2. **bn_error COs:** B&N absorbs the cost (`absorbedLosses`). The client is shown 0.00, and the cost never touches contingency or the ceiling.
3. **Blocking a line already in progress** pauses it (`status: paused`) in the same atomic write. The DB rule would otherwise refuse the block. After signing, the PM resumes the line.
4. **CO page layout (§6):** not available. The pages are a plain-language "Why / What changes / Affected work / Cost / Schedule / Permits / Sign" layout.
5. **Template task fields:** `key, trade, title, unit, quantityFormula | quantity, unitCost, costUpdated, tariffPct, sourcingOrigin, specifiedMfr, specifiedProduct, altDomesticMfr, dependsOn, productionRate, crewSize, durationDays, needsInspection, inspectionLeadDays`. Params and tasks are embedded in the template document, so a save is atomic.
6. **Buildings (with P1):**
   - Certificate holder: name, c/o, address.
   - `requiredAiStatic` + `requiredAiTokens`.
   - `requiredGl`, `requiresWc`, `requiredAuto`, `requiredEl`.
   - `coiLeadDays` (4) + business days; `coiRecipients`.
   - `unitCount` / `Verified` / `Source`.
7. **COIs:** `holderId`, `projectId` (per project, because AI is per unit), limits, `wcPresent`, `additionalInsured[]`, `certHolderText`, `effectiveOn`, `expiresOn`, `submittedAt`, `status`, verified-by.
   - AI matching ignores case and punctuation.
   - Staff correct values against the ACORD form when verifying.
8. **The COI gate applies only when the project has a building attached** (spec: "projects with building requirements on file"). The work date is the line's `plannedStart`, or today if unscheduled.
9. **COI sweep tiers are bands:** ≤30, ≤7, ≤0 days. Each fires once per certificate, so a missed night can't skip a tier.
   - On expiry, the line is first re-pointed to another compliant certificate if one exists.
   - Lines without a planned start are flagged, not unassigned (they aren't "future-dated").
10. **Milestones** extend the Phase 1 collection with `title`, `trigger`, Decimal `amount`, `payeeId`, `verifiedAt`, `releaseEta`, dispute fields, `releaseStatus`, `stripeTransferId`. A milestone with no payee is a client draw and is never transferred.
11. **Retainers:** `starts_on` must fall on `bill_day`, so periods are whole calendar months with no stubs or proration.
    - A `max_density` guarantee needs a **verified** unit count; otherwise a person decides.
    - `response_sla` is always manual.
12. **Stripe events:** `transfer.paid` / `transfer.failed` no longer exist in Stripe's current API. The webhook handles `transfer.created/updated/reversed`, `payout.paid/failed` and `payment_intent.succeeded` (and would accept the spec's names if sent).
13. **Signature IP:** taken from the `X-Forwarded-For` entry appended by our own ingress (`TRUSTED_PROXY_HOPS`, default 1). Next.js route handlers don't expose the socket address.

**Not implemented:**
- **P5 savings labels.** There is no savings/finding model to attach them to yet.
- **Spaces/occupancies.** The patch says Phase 3.
- **Stripe invoicing of retainer periods.** Staff mark periods invoiced/paid.
- **Holiday calendar.** A documented gap in `lib/dates.js`.

## New environment variables

| Var | Needed for | Notes |
|---|---|---|
| `CRON_SECRET` | cron endpoints | Long random string. The cron endpoints return 503 without it. Put the same value in the GitHub repo secrets. |
| `STORAGE_SIGNING_SECRET` | local-disk signed URLs | Long random string. Without it, a value derived from `MONGO_URL` is used (and a warning is logged). |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_KEY`, `S3_SECRET`, `S3_REGION` (`auto` for R2), `S3_FORCE_PATH_STYLE` (`true` for MinIO) | bucket storage | Leave unset to keep local disk. The **bucket must be private.** |
| `UPLOAD_DIR` | local storage | Must be persistent in production |
| `STRIPE_SECRET_KEY` | onboarding, release job | Server only |
| `STRIPE_WEBHOOK_SECRET` | `/api/stripe/webhook` | From the Stripe dashboard webhook endpoint. Subscribe to `account.updated`, `transfer.*`, `payout.*`, `payment_intent.succeeded`. |
| `TRUSTED_PROXY_HOPS` | signature IP | Number of proxies we control in front of Next (default 1) |

**GitHub → Settings → Secrets → Actions:** `APP_URL` (e.g. `https://boro-gmp.emergent.host`) and `CRON_SECRET`. Until both are set, the scheduled workflow does nothing.

## Running the tests

```bash
npm test                                   # unit (pure)
MONGO_URL=mongodb://… S3_TEST_ENDPOINT=http://localhost:9000 npm test   # + live Mongo / S3 round-trips

# end-to-end: start the server with AUTH_DEV_LINKS=true CRON_SECRET=test-cron-secret
#   STRIPE_WEBHOOK_SECRET=whsec_test_secret, then:
BASE_URL=http://localhost:3000 ADMIN_PASSWORD=… node tests/api_access_test.mjs
MONGO_URL=… DB_NAME=<server db> BASE_URL=… ADMIN_PASSWORD=… node tests/phase2_api_test.mjs
```

**Never run the end-to-end suites against production.** They create users, projects and money records.

## Review targets

- **Database rules:**
  - `migrations/002_change_orders.js` (work block)
  - `migrations/003_coi.js` (assignment reference)
  - `migrations/006_milestone_release.js` (released ⇒ transfer id; unique transfer id)
- **Idempotency:** `lib/payments/release.js`. Atomic claim, then `ms_${id}` key, then validator and unique index.
- **Server-side projections:** `lib/co/project.js`, `lib/visibility.js`, `lib/coi/views.js`, `lib/billing/http.js`.

## Still to do (for Emergent or the next session)

1. **Set the env vars above.** Run once with Stripe in test mode: onboard a sub at `/payments/setup`, verify a milestone, and let `release-milestones` pay it.
2. **Real data.** Enter BN-0001 and the Waterford buildings (unit counts with source), import HPD violations at `/admin/buildings/[id]`, and create the two Waterford retainers.
3. **Design tokens.** Forest/cream/sand from the Phase 1 spec §7 are still pending. Phase 2 pages already use the sand/alert/forest tokens for status colours.
4. **Spaces/occupancies and savings labels** (Phase 3, per the patch).
