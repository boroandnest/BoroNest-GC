# Phase 1 handoff for Emergent

> **Phase 2 is built on top of this.** Read [`PHASE2_STATUS.md`](PHASE2_STATUS.md) for what Phase 2 added, the new env vars (CRON_SECRET, S3_*, STRIPE_*, …) and the review targets.

Branch: `feat/phase-1-workspace`. Read `docs/PHASE1_BUILD.md` (the spec) first, then this file.

## Stack decision: stay on MongoDB, no Supabase

The spec says "keep whatever the current build uses." The live app is Next.js 15 + MongoDB on Emergent, so Phase 1 is
implemented on Mongo. **Do not add Supabase.** The spec's Supabase pieces map to this code:

| Spec (Supabase) | Implemented here (Mongo) |
|---|---|
| Supabase Auth magic link | `lib/auth.js` (`createMagicLink` / `consumeMagicLink`), email sent by `sendMagicLinkEmail` in `lib/email.js` via Resend |
| `/auth/callback` | Email link → `/auth/confirm?token=…` page → user clicks Continue → `POST /api/auth/callback` sets the session cookie. Redeeming on click (not on open) stops email link-scanners from using up the single-use token. |
| `profiles.status` pending/verified | `users.status`. Expediters and subcontractors start `pending`; everyone else starts `verified` |
| RLS policies | Access checks in `app/api/[[...path]]/route.js` (`resolveAccess`) + `lib/visibility.js` |
| `projectScope()` (§4) | `lib/visibility.js`: `projectScope`, `projectProject`, `projectMilestones`, `projectChangeOrders`, `projectParties` |
| `project_members` | `project_parties` (accepted invitations) + `projects.clientEmail` for the owner. Subs carry `scopeTrades` |
| `scope_lines` | `scope_lines` collection, `GET/POST/PATCH/DELETE /api/projects/:id/scope` |
| `messages.audience` | `messages.audience` (array of roles; empty = everyone) |
| `project_events` | `project_events` collection. Written for login, phase_change, scope_updated, milestone_verified, message_posted, member_added, project_created |

Role keys stay as the existing app uses them: `client`, `management`, `building-rep`, `expediter`, `subcontractor`, plus `bn_staff` for Boro & Nest.

## What changed in this branch (security)

The previous build had no real authentication:
- Anyone could log in as anyone (including admin) by typing their email. **Fixed.** Login is a one-time emailed link (15 min, single use) for clients and trades, and a password for staff.
- Anyone could become staff by signing up with an `@boronest.co` / `@boroandnest.co` email. **Removed.** Staff is the `bn_staff` role, set only by the server.
- A permanent login token was stored on each user and returned by `/api/subcontractors` to anonymous callers. **Removed.** Sessions are random tokens. Only a SHA-256 hash is stored, in `sessions`. The cookie is `HttpOnly`, and `Secure` in production.
- Messages, change orders, uploads, milestone completion and project creation had no auth checks. **All now require a session plus project access, and staff-only actions are enforced on the server.**
- Uploads went to `/public/uploads`, readable by anyone. Files now go to `storage/uploads` (or `UPLOAD_DIR`) and are served through `GET /api/files/:id` with access checks. File types are allow-listed.
- HTML injection in emails (scoping-call notice, invitations) is now escaped.
- Basic rate limits on login, signup, scoping-call, chat and anonymous uploads.
- First-run seeding could wipe every milestone, document and message. It now only touches the demo project IDs.

### Pricing visibility (spec §4): enforced on the server

| Viewer | GMP / contingency / spend | Scope lines | Milestone $ | Change-order $ | Invoices |
|---|---|---|---|---|---|
| client, management, bn_staff | yes | all, with $ | yes | yes | yes |
| subcontractor | no | own `scopeTrades` only, with $ | only milestones where `payeeEmail` = their email | no | no |
| expediter, building-rep, designer | no | all titles, **no $** | no | no | no |

Fields a role can't see are deleted before the JSON is sent, so they never appear in the network response. `tests/api_access_test.mjs` checks this against the raw response text.

## Environment variables

Set these in the Emergent environment (the `.env` file is gitignored, so never commit it):

| Var | Required | Notes |
|---|---|---|
| `MONGO_URL`, `DB_NAME` | yes | unchanged |
| `ADMIN_EMAIL` | yes | `admin@boroandnestnyc.com` |
| `ADMIN_PASSWORD` | yes | The owner gives you this privately. **Never write it into a committed file.** On every server start the admin account is created or updated with this password (scrypt-hashed). If unset, admin password login is disabled. |
| `RESEND_API_KEY` | yes | Without it, no sign-in links are sent and clients/trades can't log in. |
| `RESEND_FROM_EMAIL` | yes for prod | Must be an address on a domain verified in Resend (e.g. `Boro & Nest <hello@boroandnestnyc.com>`). The default `onboarding@resend.dev` only delivers to the Resend account owner. |
| `NEXT_PUBLIC_APP_URL` | yes | Public base URL. Used to build sign-in links in emails. |
| `EMERGENT_LLM_KEY` | for Nest | unchanged |
| `AUTH_DEV_LINKS` | dev only | `true` returns the sign-in link in the API response instead of requiring email. **Never set in production.** |
| `SHOW_DEMO_PROJECTS` | optional | `true` shows the 4 seeded demo projects to every verified user. Default: staff only. |
| `FRAME_ANCESTORS` | prod | e.g. `'self'` to block clickjacking. Defaults to `*` so Emergent's preview iframe keeps working. |
| `UPLOAD_DIR` | optional | Where uploaded files are stored. Must be persistent storage in production. |
| `CORS_ORIGINS` | optional | Only needed if another origin calls the API. |
| Phase 2 variables | see PHASE2_STATUS.md | `CRON_SECRET`, `STORAGE_SIGNING_SECRET`, `S3_*`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `TRUSTED_PROXY_HOPS` |

## How to test

```bash
# server must run with AUTH_DEV_LINKS=true (test env only)
BASE_URL=http://localhost:3000 ADMIN_EMAIL=admin@boroandnestnyc.com ADMIN_PASSWORD=… node tests/api_access_test.mjs
```

19 checks covering §9: unauthenticated rejection, logged-out redirect, staff password login, magic-link single use, pending sub flow, staff verification, the client/sub/building-rep pricing gates (checked in the raw response), message audiences, role-restricted writes, phase updates, upload/download access, and server-side logout.

**Never run it against production.** It creates users and a project.

The old `backend_test.py` / `backend_test_iteration2.py` were deleted. They tested the insecure email-only login.

## Remaining Phase 1 work (for Emergent)

Do these in order. Do not break the security model above: every new endpoint needs `getUserFromRequest` + `resolveAccess`, and every dollar figure must go through `lib/visibility.js`.

1. **Seed BN-0001** (spec §8): Unit 3H Renovation, 3215 Arlington Ave, Bronx. The owner must supply the GMP ceiling, contingency, target CO date, scope lines with quantities, manufacturers and unit costs, and the payment schedule. Don't invent numbers. Create it from `/admin` (Create Project), add lines on the project's **Scope** tab, invite the client (role client) and at least one sub with `scopeTrades`.
2. **Milestones from the real payment schedule.** Milestones now support `payeeEmail` (a sub sees their own amounts). Add a staff form to create/edit milestones (`title`, `trigger`, `amount`, `payeeEmail`) and log `milestone_verified` (already done in the verify endpoint).
3. **`/app/*` route names** (spec §5). The current routes work and are protected: `/dashboard` → `/dashboard/[role]`, `/projects/[id]` (tabs: overview, milestones, scope, budget, documents, photos, messages, change-orders, team), `/admin`, `/pending`. If you rename them to `/app/...`, add redirects from the old paths and update `middleware.js`'s matcher.
4. **Design tokens** (spec §7). The app still uses the old royal-blue dark theme. Apply forest/cream/sand/alert and Playfair/Inter/JetBrains Mono in `app/globals.css` + `tailwind.config.js`, and restyle the phase stepper (done=forest, current=sand, future=outlined). The Ask Nest nav pill already uses the spec colors. Use `--alert` (#D4654A) only for real problems.
5. **Role dashboards show placeholder data.** `app/dashboard/[role]/page.js` has hard-coded inspections, bid invitations, "Open Violations: 2", sub payments ($10,500), and the management "Subcontractor Performance" table. Replace them with real data or remove them before real clients log in.
6. **Remove the floating Ask Nest bubble** (spec §7) now that the nav pill exists (`components/nest-chat.js` launcher button). Keep the panel.
7. Phase 2+ items (COI vault, change-order approvals, Stripe, risk engine, RAG): **do not build** (spec §12).

## Known limitations

- Rate limiting is in-memory per server process. It is best-effort, and the IP comes from `X-Forwarded-For`.
- Legacy users with no `status` are treated as verified, so existing accounts keep working. Re-check any existing subcontractor accounts in `/admin`.
- Files uploaded by the old build to `/public/uploads` are still publicly reachable by URL if they exist on the server. Delete them after confirming nothing needs them.
- The board portal (`/portal/:token`) is public to anyone holding the link and shows headline GMP and spend, by design. Per-milestone amounts are hidden there.
