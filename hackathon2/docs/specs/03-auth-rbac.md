# 03 — Auth, RBAC, first-run setup, user management

Source: docs/PROMPTS.md Prompt 3; HCM_SPEC.md §3 (architecture rules), §4 (functionalities 01, 02, 05), §10 steps 1–2. Stack and conventions: HCM_SPEC.md §2–§3 and AGENTS.md.

## Objective
Replace the Prompt 1 preview-role stub with real Supabase sessions, give every service one `actor` plus guards, and deliver first-run setup, login/logout, forced password change and Admin user management.

## Acceptance criteria
- `getActor()` returns `{ userId, email, role, employeeId, isActive, mustChangePassword }` or `null`; inactive users are treated as logged out.
- `requireRole` / `requireActor` throw AppError 401/403; `assertOwnEmployee` throws 403 for another employee or no linked record.
- `audit()` and `notify()` exist for every later service.
- `GET /api/setup/status`; `POST /api/setup` works once (second call 409); creates the auth user (email confirmed), the admin `app_users` row and `company_settings` in one DB transaction; `ADMIN_EMAIL` pre-fills the email, `ADMIN_PASSWORD` makes the password optional (never sent to the browser).
- Proxy: setup not done → `/setup`; `/setup` after setup → `/login`; logged out → `/login`; `must_change_password` → `/change-password`; `/api/*` never redirected.
- Login rejects inactive accounts; after login `must_change_password` users land on `/change-password`.
- `POST /api/auth/change-password` verifies the current password, updates it, clears the flag.
- Admin-only `/api/users`: list, create HR login (temp password shown once), activate/deactivate (bans the auth user), reset password (new temp password + flag). No API creates admins; no self-deactivate/reset.
- Sidebar, user menu, dashboard use the real role; every `(app)` page checks its role (from `NAV`) and shows a no-access state otherwise.
- TEMP preview files removed.

## Plan
- DB (`supabase/migrations/002_auth.sql`): `fn_proxy_state(uuid) → jsonb`, `fn_complete_setup(uuid, text, text)` — atomic, raises `setup_already_completed`. Service-role only.
- Server: `src/server/auth/{session,guard,authAdmin,tempPassword}.js`, `src/server/{audit,notify}.js`, `src/server/services/{setup,auth,users}.js`.
- Pure proxy rules in `src/lib/auth/redirects.js` (`decideRedirect`), used by `src/lib/supabase/proxy.js`.
- Routes: `api/setup/status` (GET), `api/setup` (POST), `api/auth/change-password` (POST), `api/users` (GET, POST), `api/users/[id]` (PATCH), `api/users/[id]/reset-password` (POST).
- UI: `RoleGate` on every `(app)` page using `rolesFor(href)` from `NAV`; company name in the topbar; real `/users` admin page; setup page passes env hints to the wizard.

## Tasks
- [x] Task: DB functions
  - Acceptance: idempotent, service-role only, covered by self-checks and db:check
  - Verify: PGlite ×2 + checks; Supabase paste + `npm run db:check`
  - Files: supabase/migrations/002_auth.sql, supabase/tests/002_auth_checks.sql, scripts/check-db.mjs
- [x] Task: Session, guards, audit, notify, auth admin helpers
  - Acceptance: API above; guard unit tests
  - Verify: `npm test`
  - Files: src/server/auth/*, src/server/audit.js, src/server/notify.js
- [x] Task: Services + route handlers
  - Acceptance: status codes per the table in the plan; setup 409 test
  - Verify: `npm test`; E2E
  - Files: src/server/services/*, src/app/api/**
- [x] Task: Proxy rules
  - Acceptance: rules in order; unit-tested
  - Verify: `npm test`; E2E
  - Files: src/lib/auth/redirects.js, src/lib/supabase/proxy.js
- [x] Task: UI wiring
  - Acceptance: TEMP preview removed; RoleGate on every page; /users page; setup env hints
  - Verify: build; E2E screenshots
  - Files: src/components/shell/*, src/app/(app)/**, src/app/(public)/setup/*, src/app/actions/auth.js
- [x] Task: End-to-end flow
  - Acceptance: fresh DB → setup → admin → HR created → HR forced to change password → HR menu
  - Verify: headless Edge against Supabase, then reset.sql
  - Files: —
