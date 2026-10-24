# 05 — Employees, salary structure, CSV (M3)

Source: docs/PROMPTS.md Prompt 5; HCM_SPEC.md §4 rows 06, 07, 08, 14, §5, §6. Stack and conventions: HCM_SPEC.md §2–§3 and AGENTS.md.

## Context
Prompts 1–4 built the shell, schema, auth/RBAC and org setup. `/employees`, `/employees/import`, `/salary` and `/profile` are still empty placeholders. This module makes HR able to register employees (each gets a login with a temp password), keep their job and salary data, bulk-import or export them by CSV, and gives every role the right view: Admin/HR the directory + Employee 360, employees only their own profile. Attendance, leave and payroll (Prompts 6–8) all hang off the employee rows and salary structures created here.

## Objective / acceptance criteria
- **Register (HR only):** full_name, email, phone, address, gender, date_of_birth, department (required), designation (optional, must belong to that department or have none), join_date, status `probation|active` (default probation), basic salary > 0. Creates auth user (temp password, `email_confirm: true`) → `app_users` (role employee, `must_change_password: true`, linked `employee_id`) → `employees` (auto `EMP-0001`…) → first `salary_structures` row (effective_from = join_date). Temp password returned once and never stored/audited. Any failure after the auth user exists deletes it, and no partial rows remain.
- **Decision (approved):** if the email already belongs to an HR/Admin login without an employee record, that login is linked instead (role and password unchanged, no temp password). Any other existing email → 409.
- **Update:** HR edits all job/profile fields except email (it is the login) and exit fields; status only `probation↔active`. Employee edits only own phone & address (other fields or other id → 403). Admin: view only. Changes audited with before/after of changed fields.
- **Directory (Admin, HR):** server-side search on name / code / email, filters department, designation, status, pagination (20/page), sort by name, code, join date, department (asc/desc).
- **Employee 360:** profile, job, current salary + history (Admin/HR only — never returned to an Employee), this month's attendance summary (present / late / half_day / missing_checkout / absent / on_leave from `fn_attendance_days`), leave balances for the current year (quota − approved; available = quota − approved − pending; unpaid = unlimited), last 10 leave requests, payslips (Employee: finalized runs only). Employee asking for another id → **403**.
- **Exit (HR):** exit_date (≥ join_date) + status `exited` + login deactivated (`is_active false` + auth ban). An HR user can't exit or change the salary of their own employee record.
- **Salary (HR manage, Admin view):** set basic + effective_from (≥ join_date) → hra 40%, medical 10%, gross 1.5× (DB generated columns). Same effective_from again → replaces that row. Current = latest effective_from ≤ today. History sorted by effective_from desc.
- **CSV (HR only):** export and import with dry run, formats below. Real import runs only with zero errors; returns created count + downloadable credentials CSV.
- **Done when:** HR registers an employee; the employee signs in with the temp password (forced to change it); that employee gets 403 from `GET /api/employees/<other id>`.

## Plan

### Migration `supabase/migrations/003_employees.sql` (functions only, no table changes)
- `fn_next_employee_code()` replaced: loops `nextval` until the code is not taken (CSV may supply codes).
- `fn_register_employees(p_rows jsonb, p_actor uuid) returns jsonb` — one transaction for 1..N employees: per row insert `employees` (given code or default), insert `app_users` (new login) **or** update the existing HR/Admin row `set employee_id` (`where employee_id is null`, else raise), insert `salary_structures`. Returns `[{id, employee_code, email}]`. Granted to service_role only, like the other `fn_*`.
- Service flow: create all auth users first → one RPC → on any RPC/auth error delete every auth user created in this call (`deleteAuthUser`, already in `src/server/auth/authAdmin.js`). Single register and CSV import share this path.

### Validation `src/lib/validation/employees.js` (shared by forms and routes, same style as `organization.js`; reuse its `isoDate`/`name` helpers by exporting them)
- `employeeFields` base: `full_name` (1–100), `email` (email, lowercased), `phone` (≤ 30, optional), `address` (≤ 300, optional), `gender` enum optional, `date_of_birth` isoDate optional, `department_id` uuid, `designation_id` uuid nullable, `join_date` isoDate, `status` `probation|active`.
- `registerEmployeeSchema` = base + `basic` (number > 0, ≤ 10,000,000, 2 dp); refine dob < join_date.
- `updateEmployeeSchema` = base without email, `.partial().strict()`, at least one field.
- `selfUpdateSchema` = `{ phone, address }` `.partial().strict()`.
- `exitEmployeeSchema` = `{ exit_date }`.
- `salarySchema` = `{ basic, effective_from }`.
- `listEmployeesQuery` = `q` (≤ 100), `department`, `designation` (uuid), `status` enum, `page` (int ≥ 1), `sort` `name|code|join_date|department`, `dir` `asc|desc`.

### Services
- `src/server/services/employeeQuery.js`: shared reads (`findEmployee`, `queryEmployees` with `count: "exact"`, sanitized `.or(ilike…)`, `.range()`), no role checks.
- `src/server/services/employees.js`: `registerEmployee`, `createEmployees` (shared with CSV), `updateEmployee` (picks HR vs self schema by role), `listEmployees`, `getEmployee360`, `exitEmployee`. Uses `requireRole`/`assertOwnEmployee` (`src/server/auth/guard.js`), `check()` (`src/server/dbErrors.js`), `audit()`, `setAuthBanned`, `generateTempPassword`.
- `src/server/services/salary.js`: `setSalary` (upsert on `(employee_id, effective_from)`), `getSalaryHistory`, `currentSalary`, `listCurrentSalaries` (salary page; same filters/pagination as the directory).
- `src/server/services/leaveBalance.js`: `getLeaveBalances(employeeId, year)` — small read helper that Prompt 7's leave service will reuse.
- `src/server/services/employeeCsv.js`: `parseCsv` (papaparse, header row, BOM stripped), pure `validateImportRows(rows, lookups)` (unit tested), `importEmployees(actor, text, { dryRun })`, `exportEmployeesCsv(actor)` (cells starting `= + - @` prefixed with `'` against CSV formula injection).

### API (all via `withApi` + `parse` + `requireActor`, status codes per HCM_SPEC §3)
| Method & path | Who | Notes |
|---|---|---|
| `GET /api/employees` | Admin, HR | list query above → `{ employees, total, page, pageSize }` |
| `POST /api/employees` | HR | 201 `{ employee, tempPassword \| null, linked }` |
| `GET /api/employees/[id]` | all | Employee 360; Employee other id → 403 |
| `PATCH /api/employees/[id]` | HR, Employee (self) | |
| `POST /api/employees/[id]/exit` | HR | `{ exit_date }` |
| `GET/POST /api/employees/[id]/salary` | GET Admin/HR, POST HR | history / set basic |
| `GET /api/employees/export.csv` | HR | `text/csv`, `Content-Disposition: attachment; filename="employees-YYYY-MM-DD.csv"` |
| `POST /api/employees/import?dryRun=true\|false` | HR | multipart, field `file` |

### CSV format
Columns (header names trimmed, case-insensitive; `*` = required; unknown column → error on row 1):
`employee_code, full_name*, email*, phone, address, gender, date_of_birth, department*, designation, join_date*, status, basic_salary*`
- employee_code: blank = auto, else `EMP-` + 4+ digits, unique in file and DB. department: existing name (case-insensitive). designation: existing title in that department (or a department-less one). Dates `YYYY-MM-DD`. gender `male|female|other`. status `probation|active` (blank = probation). basic_salary number > 0. email valid, unique in file and among employees/employee logins (HR/Admin email → linked, reported in the summary).
- Limits: 1 MB, 500 data rows; empty file → 422.
- Export: same columns (basic_salary = current basic) plus `status` incl. `exited`, `exit_date`.

Dry-run response (`200`):
```json
{ "dryRun": true, "totalRows": 3, "validRows": 2, "linkedRows": 0,
  "errors": [ { "row": 3, "field": "email", "reason": "Email already used on row 2" } ] }
```
`row` = spreadsheet line number (header is row 1). Real import with errors → `422` `{ error: { code: "CSV_INVALID", details: { errors: [...] } } }`, nothing created. Success → `201 { "created": 2, "linked": 0, "credentialsCsv": "employee_code,full_name,email,temp_password\n…" }`; the page turns it into a Blob download and warns it is shown once.

### Pages (frontend-design: reuse Prompt 1 tokens + `src/components/ui`; loading/empty/error states; 375 px; dark mode)
- `/employees` (Admin, HR): `SearchBar` + `FilterBar` (department, designation, status) + `Table` + `Pagination`, URL state via `useUrlParams`; HR sees "Register employee" + "Import/Export" buttons. Cards instead of table rows below `sm`.
- `/employees/new` (HR): register form with live HRA/medical/gross preview; success dialog shows the temp password once (reuse the `TempPasswordDialog` pattern from `UsersManager.js`, extracted to `src/components/employees/`), then links to the 360.
- `/employees/[id]` (Admin, HR): header (name, code, status badge) + `Tabs`: Overview · Salary · Attendance · Leave · Payslips. HR: Edit drawer (`Drawer`), Exit (`ConfirmDialog` + date), Set salary.
- `/salary` (HR manage, Admin view): employees with current basic/HRA/medical/gross; row opens history drawer; HR "Set new salary" form with preview.
- `/employees/import` (HR): Export button, file picker → Dry run → error table (row, field, reason) or green summary → Import (enabled only at zero errors) → credentials CSV download.
- `/profile` (Employee): the same 360 component in self mode — no salary tab, phone/address edit only; "No employee record linked" when `employeeId` is null.
- Navigation (`src/config/navigation.js`): HR "Employees" item `covers: ["/employees/new"]`; admin gets "Salary Structures" (`/salary`). `/employees/[id]` pages gate with `href="/employees"`; `/employees/new` gate checks HR via its own covers entry, so Admin gets the no-access card.

### Risks
- Auth user + DB rows can't share one transaction → compensating delete (tested with a failing fake RPC).
- Supabase `.or()` filter syntax breaks on `,()` in user input → escape/strip before building it.
- Large imports: N sequential `createUser` calls; 500-row cap keeps it within the Vercel function time limit.

## Tasks
- [x] Task: Migration 003 + docs/specs/05-employees.md
  - Acceptance: `fn_register_employees` inserts all-or-nothing; code generator skips taken codes; `npm run db:check` still passes
  - Verify: run in Supabase SQL editor (user), SQL checks in `supabase/tests/003_employees_checks.sql`
  - Files: supabase/migrations/003_employees.sql, supabase/tests/003_employees_checks.sql, supabase/reset.sql, scripts/check-db.mjs
- [x] Task: Validation schemas
  - Acceptance: register/update/self/exit/salary/list schemas as above
  - Verify: `npm test` (new `src/lib/validation/employees.test.js`)
  - Files: src/lib/validation/employees.js (+ test), src/lib/validation/organization.js (export helpers)
- [x] Task: employees + salary + leaveBalance services and routes
  - Acceptance: role/scope rules above; auth user cleaned up on failure; Employee never gets salary or other ids (403); audits on every write, no passwords in audit
  - Verify: `npm test` (`employees.test.js`, `salary.test.js` with `test/fakeDb.js`)
  - Files: src/server/services/{employees,salary,leaveBalance}.js (+ tests), src/app/api/employees/**
- [x] Task: CSV import/export
  - Acceptance: every dry-run check listed; real import refuses on errors; credentials CSV; formula-injection guard
  - Verify: `npm test` (`employeeCsv.test.js` for `validateImportRows` + export escaping)
  - Files: src/server/services/employeeCsv.js (+ test), src/app/api/employees/import/route.js, src/app/api/employees/export.csv/route.js
- [x] Task: Directory + register pages, navigation
  - Acceptance: search/filter/sort/pagination via URL; temp password shown once; Admin has no register button and no-access card on /employees/new
  - Verify: navigation tests; browser at 375 px + dark mode
  - Files: src/app/(app)/employees/page.js, src/app/(app)/employees/new/*, src/components/employees/*, src/config/navigation.js (+ test)
- [x] Task: Employee 360 + My Profile
  - Acceptance: tabs per role; HR edit/exit/salary actions; Employee self edit of phone/address only
  - Verify: browser as HR, Admin, Employee
  - Files: src/app/(app)/employees/[id]/*, src/app/(app)/profile/page.js, src/components/employees/Employee360.js
- [x] Task: Salary page + import page
  - Acceptance: Admin read-only; dry-run error table; import enabled only at zero errors
  - Verify: browser with a CSV containing each error type
  - Files: src/app/(app)/salary/*, src/app/(app)/employees/import/*
- [x] Task: End-to-end
  - Acceptance: "Done when" above; `npm test`, `npm run lint`, `npm run build` green
  - Verify: headless Edge flow (HR registers → employee logs in with temp password → change password) + `fetch` with employee cookies to another 360 → 403; Admin POSTs → 403; then `supabase/reset.sql`
  - Files: —

## Assumptions (approved with the plan)
1. Department is required on register and import; designation optional.
2. Email can't be edited after registration (it is the login).
3. HR can't exit or change the salary of their own employee record; Admin is view-only for everything here.
4. Employees see only payslips of finalized runs; Admin/HR see drafts too.
