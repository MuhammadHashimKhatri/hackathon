# 02 — Database schema

Source: docs/PROMPTS.md Prompt 2; HCM_SPEC.md §5 (data model), §6 (business rules). Stack and conventions: HCM_SPEC.md §2–§3 and AGENTS.md.

## Objective
One idempotent SQL script that creates the whole HCM Lite data model in an empty Supabase project, locks it down (RLS on, no policies, no grants to `anon`/`authenticated`), guards the hard rules in the database (finalized payroll, append-only audit, no overlapping leave), and provides the shared working-day and attendance-status functions that every dashboard number is built on.

## Acceptance criteria
- `supabase/migrations/001_schema.sql` runs twice in a row in the SQL Editor without errors.
- Demo objects (`profiles`, `handle_new_user`, `on_auth_user_created`, `set_updated_at`) are dropped.
- Every §5 table exists with its FKs, unique and check constraints; required indexes exist.
- RLS is enabled on every table; `anon` and `authenticated` have no table, sequence or function privileges; only `service_role` can execute the functions.
- `audit_logs` rejects UPDATE/DELETE; a finalized `payroll_runs` row and its `payslips` reject every change.
- `fn_is_working_day`, `fn_working_days`, `fn_attendance_days` follow §6 exactly (see Plan).
- `supabase/reset.sql` empties every app table and `auth.users`, clearly marked destructive.
- `scripts/check-db.mjs` verifies tables, functions, RLS and triggers with the secret key, and that the publishable key is refused.

## Plan
- Script order: drop demo objects → `btree_gist` → enums → sequence + `fn_next_employee_code` → tables in FK order → indexes → trigger functions + triggers → helper functions → RLS + grants. Wrapped in one transaction.
- Every app table has `created_at`; editable tables also have `updated_at` maintained by `tg_touch_updated_at`.
- `employees.user_id → auth.users` and `app_users.employee_id → employees` (no circular FK); services keep the two links in sync.
- `salary_structures.hra/medical/gross` are stored generated columns (0.40 / 0.10 / 1.5 × basic, rounded to 2 dp).
- Leave overlap is guarded by a GiST exclusion constraint over pending + approved requests (SQLSTATE 23P01 → 422); same-calendar-year start/end is a CHECK.
- `audit_logs` and `ai_logs` have no FKs so history survives deleted users and the append-only trigger never fires on `set null`.
- Lock triggers raise `payroll_finalized` / `audit_logs is append-only` with SQLSTATE P0001.
- Functions are `security definer`, `set search_path = ''`, executable by `service_role` only. Missing `company_settings` row ⇒ defaults (Asia/Karachi, weekend {0,6}).
- `fn_attendance_days(from, to, dept)` rows: employee employed on the day (`join_date ≤ d ≤ exit_date`, exit inclusive) **and** (working day **or** an attendance row exists). Status, first match wins: attendance without check-out before today → `missing_checkout`; attendance → stored status; approved leave → `on_leave`; past working day → `absent`; otherwise (today/future, no record) the row is omitted. Attendance beats leave.
- Status at check-in/check-out (present/late/half_day) is computed in `src/server/rules/attendanceStatus.js` and stored; SQL only derives the remaining statuses.

## Tasks
- [x] Task: Migration script
  - Acceptance: runs twice without errors; all tables, constraints, triggers, functions, grants as above
  - Verify: PGlite run ×2; Supabase SQL Editor run ×2
  - Files: supabase/migrations/001_schema.sql
- [x] Task: Self-checking test script
  - Acceptance: asserts §6 derivations and DB guards, leaves no data (ROLLBACK)
  - Verify: PGlite run; optional Supabase run
  - Files: supabase/tests/001_schema_checks.sql
- [x] Task: Reset script
  - Acceptance: empties all app tables and auth.users, schema intact
  - Verify: PGlite run, row counts 0
  - Files: supabase/reset.sql
- [x] Task: check-db script
  - Acceptance: PASS/FAIL per check, non-zero exit on failure, read-only
  - Verify: `npm run db:check` against Supabase
  - Files: scripts/check-db.mjs, package.json
