# HCM Lite — Step-wise Agent Prompts

Har prompt ka tareeqa:
1. Prompt copy karke agent ko do. Ye **sirf plan** banayega, code nahi likhega.
2. Plan padho. Kuch galat lage to wahi bata do.
3. Theek ho to bhejo: **"Plan approved. Implement it now, then run `npm run build` and `npx vitest run` and report results."**
4. Kaam check karo, phir agla prompt.

Prompt 0.5 ke baad, Prompt 1 se aage har prompt ki pehli line mein ye add kar dena:
`Use the spec-driven-development skill for this module (and the frontend-design skill for all UI work), as described in AGENTS.md.`

Order: 0 → 1 → 2 → 3 lazmi pehle. Uske baad 4–11 team mein baant sakte ho (neeche table dekho). Bonus aur deploy aakhir mein.

| # | Prompt | Kaun | Priority |
|---|---|---|---|
| 0 | Foundation & cleanup | Backend 1 | Must |
| 0.5 | Skills install (frontend-design + spec-driven-development) | Backend 1 | Must |
| 1 | UI shell & design system | Frontend 1 + 2 | Must |
| 2 | Database schema | Backend 2 | Must |
| 3 | Auth, RBAC, first-run setup, users, audit/notify helpers | Backend 1 + Frontend 1 | Must |
| 4 | Organization setup (M2) | Backend 2 + Frontend 2 | Must |
| 5 | Employees + salary + CSV (M3) | Backend 1 + Frontend 1 | Must |
| 6 | Attendance (M4) | Backend 2 + Frontend 2 | Must |
| 7 | Leave (M5) | Backend 1 + Frontend 1 | Must |
| 8 | Payroll + payslip PDF (M6) | Backend 2 + Frontend 2 | Must |
| 9 | Dashboards & analytics (M7) | Backend 1 + Frontend 1 | Must |
| 10 | AI assistant (M8) | Backend 2 + Frontend 2 | Must |
| 11 | Announcements, notifications, audit UI (M9) | Frontend 1 | Must |
| 12 | Bonus: camera attendance, late penalty, PWA | Any | Bonus |
| 13 | QA, README, deploy, demo prep | All | Must |

> Agar 2 log ek hi folder mein alag-alag agent chala rahe hon to Git branch alag rakho aur har prompt ke baad merge karo.

---

## Prompt 0 — Foundation & cleanup

```
You are building "HCM Lite" for a hackathon. First read AGENTS.md and docs/HCM_SPEC.md completely. This is Next.js 16 — read the relevant guides in node_modules/next/dist/docs/ before coding (proxy.js instead of middleware, cacheComponents is ON, params/searchParams are Promises).

PLAN ONLY — do not write or change any code yet. Give me a numbered plan with: files to create/change/delete, packages to install, and how you will verify. Then stop and wait for my approval.

Task (Spec §2, §3):
1. Remove the earlier demo: public signup button/action, the demo /profile page, supabase/schema.sql and supabase/test-queries.sql (they will be replaced in Prompt 2). Keep src/lib/supabase/* clients and src/proxy.js but plan to move server-side helpers under src/server/.
2. Install: zod, recharts, @react-pdf/renderer, papaparse, openai, server-only, vitest.
3. Create the folder structure from Spec §3 with these working pieces:
   - src/server/db.js: Supabase client using SUPABASE_SECRET_KEY, imports "server-only", no session persistence.
   - src/server/errors.js: AppError(status, code, message, details) + toResponse(err) that maps AppError to NextResponse JSON and unknown errors to 500 without leaking internals.
   - src/server/http.js: helper withApi(handler) for route handlers: try/catch, zod parse helper that throws AppError 422 with field errors.
   - src/server/rules/ with empty-but-exported modules: tax.js, payroll.js, workingDays.js, attendanceStatus.js, leaveDays.js, geo.js (implementations come later, but add vitest config and one passing smoke test).
4. Add .env.example with every variable from Spec §2 (no real values). Make sure .env.local is gitignored.
5. Add npm scripts: "test": "vitest run".
Done when: npm run build passes, npm test passes, no secret key is referenced in any client component.
```

## Prompt 0.5 — Skills install (frontend-design + spec-driven-development)

> Prompt 0 ke baad aur Prompt 1 se pehle. Skills install hone ke baad Claude Code band karke dobara kholo (ya naya session), taake skills load ho jayein.

```
PLAN ONLY first — tell me the exact commands you will run, where the skill files will land, and how you will verify. Wait for approval.

Task: install two agent skills from skills.sh into THIS project (project scope, not global) for Claude Code, then wire them into our workflow.

1. Install:
   npx skills add https://github.com/anthropics/skills --skill frontend-design -a claude-code
   npx skills add https://github.com/addyosmani/agent-skills --skill spec-driven-development -a claude-code
   If the CLI asks interactive questions, choose: project scope, Claude Code agent only. If a flag is wrong, run `npx skills add --help` and adapt — do not install any other skill.
2. Verify with `npx skills list` and show me the installed paths (expected under .claude/skills/).
3. Read both SKILL.md files completely (plus any files they reference) and give me a short summary of each: what it makes the agent do, which phases/gates it has, which files it creates. Flag anything in them that runs scripts, calls the network, or conflicts with AGENTS.md / docs/HCM_SPEC.md.
4. Add a section "Agent skills" to AGENTS.md (below the existing Next.js block, do not touch that block):
   - spec-driven-development: use it for every feature prompt in docs/PROMPTS.md. docs/HCM_SPEC.md is the approved product spec — do NOT rewrite it. For each module, run the skill's phases scoped to that module only: write docs/specs/<NN>-<module>.md (requirements + acceptance criteria taken from HCM_SPEC.md), then the plan, then the task list, and only implement after I approve. If HCM_SPEC.md is ambiguous, ask instead of inventing.
   - frontend-design: use it for every page/component (Prompt 1 and the UI part of Prompts 3–12). Keep one consistent design system across the app (tokens in globals.css, components in src/components/ui); the brief requires 375px+ responsive, dark mode, and loading/empty/error states.
5. Commit: "Add frontend-design and spec-driven-development skills".
Done when: both skills appear in `npx skills list`, AGENTS.md has the new section, and the summaries are shown to me.
```

## Prompt 1 — UI shell & design system

```
Read docs/HCM_SPEC.md §4, §7 and AGENTS.md. Next.js 16 + Tailwind v4, JavaScript.

PLAN ONLY — no code yet. Show me: component list with props, route/page map per role, layout structure, and a rough ASCII wireframe of the app shell and of each dashboard. Then wait for approval.

Task: build the UI foundation with NO fake data (pages show proper empty states until the backend exists).
1. Design tokens in globals.css (light + dark mode via prefers-color-scheme and a toggle). Clean HR-product look, one accent color, readable at 375px.
2. UI kit in src/components/ui/: Button (variants, loading), Input, Select, Textarea, DatePicker (native), Checkbox, Card, StatCard (KPI), Table (responsive: cards on mobile), Badge (status colors for present/late/half_day/absent/on_leave/pending/approved/rejected/draft/finalized), Modal/Dialog, Tabs, Toast, EmptyState, ErrorState, Skeleton, Pagination, SearchBar, FilterBar (date range + department), PageHeader, AIBadge ("AI-generated" label).
3. App shell: src/app/(app)/layout.js with sidebar + topbar (company name, notifications bell placeholder, user menu with logout). Sidebar menu is built from a single config keyed by role:
   - Admin: Dashboard, Company Settings, Departments & Designations, Leave Types & Holidays, Users, Employees, Attendance, Leave, Payroll, Payslips, Announcements, Audit Log, AI Assistant
   - HR: Dashboard, Employees, Import/Export, Attendance Board, Corrections, Leave Approvals, My Leave, Salary Structures, Payroll, Payslips, Announcements, AI Assistant
   - Employee: Dashboard, Check-in, My Attendance, My Leave, My Payslips, My Profile, Announcements, AI Assistant
   For now read the role from a temporary prop/stub; Prompt 3 will wire the real session. Mobile: collapsible drawer.
4. Public pages: /login (email + password only, no signup), /change-password, /setup (first-run wizard: company name + admin email/password), all with form validation states.
5. Placeholder page for every menu route using PageHeader + EmptyState, plus loading.js and error.js per route group.
6. Reusable AI chat panel component (slide-over) with message list, input, loading dots, AIBadge on answers — UI only.
Remember: anything that will read cookies/searchParams must be inside <Suspense>.
Done when: npm run build passes and every route renders at 375px and 1280px in light and dark mode.
```

## Prompt 2 — Database schema

```
Read docs/HCM_SPEC.md §5 and §6 carefully.

PLAN ONLY — no SQL yet. Give me: the table list with columns/types/constraints, enums, indexes, triggers, and the list of SQL functions with their signatures and what each returns. Then wait for approval.

Task: write supabase/migrations/001_schema.sql (one idempotent script I will paste into Supabase SQL Editor) and supabase/reset.sql.
1. At the top: drop the old demo objects if they exist (public.profiles table, handle_new_user function, on_auth_user_created trigger, set_updated_at) — this was demo-only data.
2. Create all enums and tables from Spec §5 with FKs, unique constraints, check constraints (basic > 0, end_date >= start_date, etc.) and indexes on (employee_id, work_date), (employee_id, start_date, end_date), (month), (created_at).
3. Enable RLS on every table with NO policies (server uses the secret key). Revoke all from anon and authenticated on these tables.
4. Triggers: audit_logs append-only; payroll_runs/payslips locked when run status = finalized; updated_at maintenance where useful.
5. Helper SQL functions (security definer, set search_path = ''):
   - fn_is_working_day(d date) and fn_working_days(from date, to date) returns int, using company_settings.weekend_days and holidays.
   - fn_attendance_days(from date, to date, dept uuid default null) returns one row per (employee, date) for every working day the employee was employed plus any non-working day with an attendance row, with effective_status in present|late|half_day|missing_checkout|absent|on_leave (Spec §6 derivation rules, timezone from company_settings).
   These become the base for every dashboard number.
6. supabase/reset.sql: truncates all app tables and deletes auth.users (so judges get a fresh install). Mark it clearly as destructive.
7. After I run it, write a small node script scripts/check-db.mjs that uses SUPABASE_SECRET_KEY to verify every table exists and the functions respond.
Done when: I can paste 001_schema.sql into an empty project and it runs twice without errors.
```

## Prompt 3 — Auth, RBAC, first-run setup, user management

```
Read docs/HCM_SPEC.md §3, §4, §10 step 1–2.

PLAN ONLY first: list the files, the session/guard API, the redirect rules in proxy.js, each route handler with method + path + allowed roles + status codes, and the test cases. Wait for approval.

Task (functionalities 01, 02, 05):
1. src/server/auth/session.js getActor(): reads the Supabase session (getClaims/getUser), loads app_users → { userId, email, role, employeeId, isActive, mustChangePassword }. Inactive user → treat as logged out.
2. src/server/auth/guard.js: requireActor(), requireRole(actor, ...roles) → AppError 401/403, assertOwnEmployee(actor, employeeId).
3. src/server/audit.js audit(actor, action, entity, entityId, before, after) and src/server/notify.js notify(userId, type, title, body, link). Every later service must call audit() on create/update/approve/reject/finalize.
4. First-run setup: GET /api/setup/status; POST /api/setup (only while company_settings.setup_completed = false, else 409) creates the auth user via auth.admin.createUser({ email_confirm: true }), app_users row role=admin, company_settings row, sets setup_completed. Also support ADMIN_EMAIL/ADMIN_PASSWORD env: if set and no admin exists, the setup page pre-fills the email. proxy.js redirects every page to /setup until setup is done, and /setup to /login after.
5. Login/logout with Supabase Auth (signInWithPassword). After login, if must_change_password → force /change-password (proxy.js enforces it). Change password: verify current, update, clear the flag.
6. Users (Admin only): /api/users — list, create HR login (temp password generated server-side, shown once), deactivate/activate, reset password (new temp password + must_change_password=true). Admin cannot be created through this API.
7. Wire the real role into the sidebar from Prompt 1; role dashboards route to /dashboard which renders the right dashboard per role.
8. Remind me in the plan to disable "Allow new users to sign up" in Supabase Auth settings.
Tests: guard unit tests (employee cannot pass requireRole('hr')), setup returns 409 the second time.
Done when: fresh DB → /setup → admin logs in → creates HR → HR logs in, is forced to change password, sees HR menu.
```

## Prompt 4 — Organization setup (M2)

```
Read docs/HCM_SPEC.md §4 (rows 03, 04), §5, §6.

PLAN ONLY first: services, route handlers (method, path, roles), zod schemas, pages and forms. Wait for approval.

Task:
1. src/server/services/settings.js: get (Admin, HR read-only), update (Admin only): company_name, timezone, office_start, grace_minutes, half_day_hours, weekend_days, office_lat/lng/radius, max_gps_accuracy_m, late_penalty_enabled. Changes apply to new records only (no recalculation). Audit every change with before/after.
2. Services + APIs + Admin pages for departments, designations (linked to department), leave types (code, name, yearly_quota or unlimited, is_paid; button "Add standard leave types" creating annual 14 / sick 8 / casual 10 / unpaid unlimited if missing), holidays (date + name). Prevent deleting a department that has employees (422).
3. Office location picker: lat/lng inputs + "Use my current location" button (browser Geolocation) + radius.
4. HR sees these pages read-only (no edit buttons AND server rejects with 403).
Done when: Admin can configure everything from an empty DB; HR gets 403 on any write via curl.
```

## Prompt 5 — Employees, salary structure, CSV (M3)

```
Read docs/HCM_SPEC.md §4 (rows 06, 07, 08, 14), §5, §6.

PLAN ONLY first: services, APIs, zod schemas, the CSV column format and the dry-run response shape, pages. Wait for approval.

Task:
1. services/employees.js:
   - register (HR): creates auth user (temp password, email_confirm true), app_users(role employee, must_change_password true), employees row (auto employee_code EMP-0001...), initial salary_structure. Do it so a failure midway cleans up the auth user. Return the temp password once.
   - update (HR: all job fields; Employee: only own phone & address).
   - list (Admin/HR): server-side search (name, code, email), filters (department, designation, status), pagination, sort.
   - get360(id): profile, job, current salary (Admin/HR only), attendance summary this month, leave balances, recent leave, payslips. Employee may only call it for self and never sees other people.
   - exit/deactivate employee (set exit_date + status exited + deactivate login).
2. services/salary.js (HR manage, Admin view): set basic → hra 40%, medical 10%, gross 1.5×; history by effective_from.
3. CSV (HR): GET /api/employees/export.csv; POST /api/employees/import?dryRun=true|false. Dry run returns [{row, field, reason}] checking: required fields, unique code/email (in file and DB), valid email, known department name, ISO date, salary > 0. Real import only if zero errors; returns created count + temp passwords as a downloadable CSV.
4. Pages: directory (table + search + filters + pagination), register form, Employee 360 page with tabs, salary structure page, import page showing the dry-run error table, "My Profile" for employees.
Done when: HR registers an employee, the employee logs in with the temp password, an employee gets 403 when requesting another employee's 360.
```

## Prompt 6 — Attendance (M4)

```
Read docs/HCM_SPEC.md §6 Attendance carefully (timezone, 409 rules, derived statuses, weekend decision).

PLAN ONLY first: pure rule functions with signatures + test cases, services, APIs, pages. Wait for approval.

Task:
1. src/server/rules/attendanceStatus.js + workingDays.js (pure, unit tested): status at check-in (late after office_start + grace), half_day at checkout (< half_day_hours), local date in company timezone.
2. services/attendance.js:
   - checkIn(actor, {source, lat?, lng?, accuracy?}) — server timestamp, one row per day (409), allowed on weekends.
   - checkOut(actor) — 422 if no check-in, 409 if already out, recompute status.
   - myCalendar(actor, month) — uses fn_attendance_days for derived statuses.
   - dailyBoard(actor, date, dept) — Admin/HR: every employee with today's effective status, check-in/out times.
   - corrections: request (Employee, own, reason required), list pending (HR), approve/reject with comment (HR) → upsert attendance with source=correction, notify + audit.
3. APIs: POST /api/attendance/check-in, /check-out, GET /api/attendance/me, /board, corrections endpoints.
4. Pages: Employee check-in widget (big button, shows server time + status, disabled state after check-out), monthly calendar with colored statuses and "Request correction" per day; HR daily board with filters; HR corrections inbox.
Tests: 09:15 → present, 09:16 → late, 4h59m → half_day, second check-in → 409.
```

## Prompt 7 — Leave (M5)

```
Read docs/HCM_SPEC.md §6 Leave.

PLAN ONLY first: rule functions + test cases, services, APIs, pages. Wait for approval.

Task:
1. rules/leaveDays.js (pure, tested): working days between two dates given weekend_days + holidays.
2. services/leave.js:
   - apply(actor, {leave_type_id, start_date, end_date, reason, source}) — Employee/HR for self. Validate: start ≤ end, same year, days > 0, no overlap with own pending/approved (422), days ≤ available (quota − approved − pending) unless unpaid (422 with clear message).
   - cancel(actor, id) — own pending or future approved.
   - balances(actor, employeeId?, year) — per type: quota, approved, pending, remaining. Employee only self.
   - history(actor, filters); inbox(actor) for HR (pending, with employee + balance info); decide(actor, id, approve|reject, comment) — HR only, comment required on reject, notify employee, audit.
   - whoIsOnLeave(actor, from, to, dept) — Admin/HR (used by dashboard + AI later).
3. Pages: My Leave (balance cards, apply form with live "X working days" preview, history with cancel), HR Approvals inbox with approve/reject modal + comment.
Tests: overlap → 422, over-balance → 422, Fri–Mon range counts 2 days with Sat–Sun weekend, holiday skipped.
```

## Prompt 8 — Payroll + payslip PDF (M6)

```
Read docs/HCM_SPEC.md §6 Payroll including the worked example.

PLAN ONLY first: rule functions + test cases (include the worked example and every tax slab boundary), services, APIs, pages, PDF layout. Wait for approval.

Task:
1. rules/tax.js and rules/payroll.js (pure, tested): computeMonthlyTax(gross), computePayslip({basic, workingDays, eligibleDays, absent, unpaid, halfDays, lates, latePenaltyEnabled}).
2. services/payroll.js:
   - createOrRegenerateDraft(actor, month) — HR only; refuses if month is finalized (422). Pulls counts from fn_attendance_days + approved unpaid leave; prorates joiners/leavers; upserts payslips; totals on the run; audit.
   - getRun / listRuns (Admin/HR); finalize(actor, runId) — Admin only, locks, notifies every employee "payslip ready", audit.
   - payslips: list (Admin/HR all, Employee own), GET /api/payslips/[id]/pdf → PDF via @react-pdf/renderer (company name, employee, month, earnings, deductions, tax, net). Employee requesting someone else's → 403.
3. Pages: Payroll (pick month → Generate draft → review table with per-employee breakdown → Admin sees Finalize button with confirm modal; finalized shows lock badge), Payslips list with Download PDF, Employee "My Payslips".
Done when: the worked example test passes, a finalized run cannot be regenerated (API 422 and DB trigger both block it).
```

## Prompt 9 — Dashboards & analytics (M7)

```
Read docs/HCM_SPEC.md §6 Metrics and §7.

PLAN ONLY first: list every KPI/chart per role, the SQL function that computes it (signature + return shape), the service that wraps it, and the filters. Wait for approval.

Task:
1. supabase/migrations/002_analytics.sql: SQL functions built on fn_attendance_days for headcount, attrition, attendance rate, late %, absenteeism by dept, leave utilization, payroll cost by dept/month, avg salary, top late-comers, attendance trend by day, gender & tenure split. All accept (from, to, dept). Numbers must be computed in the DB, not in JS loops.
2. services/analytics.js: getAdminDashboard, getHrDashboard, getEmployeeDashboard(actor) — each returns one JSON object (this exact JSON is reused by the AI summary in Prompt 10).
3. Dashboard pages per role with FilterBar (date range + department, kept in URL search params), StatCards, recharts charts, top-5 list, audit feed (Admin), announcements, empty states when there is no data yet, a "Summarize" button placeholder (Admin/HR).
4. Employee dashboard: check-in widget, hours this week vs 40 h, late count this month, leave balances, last payslip, announcements, "Ask my assistant" button.
Done when: after creating 3 employees with some check-ins and one approved leave, every number on the dashboard matches a manual SQL count (show me the SQL you used to verify).
```

## Prompt 10 — AI assistant (M8)

```
Read docs/HCM_SPEC.md §8 fully (guardrails are graded).

PLAN ONLY first: provider setup, tool definitions (name, description, JSON schema, which roles get it, which service it calls), system prompt outline, rate limit + logging flow, smart-leave JSON schema + retry/fallback flow, and the test questions you will run. Wait for approval.

Task:
1. src/server/ai/client.js: openai SDK with AI_BASE_URL/AI_API_KEY/AI_MODEL, 15 s AbortController timeout. Server only.
2. src/server/ai/tools.js: get_headcount, get_attendance_summary, get_late_comers, get_leave_summary (who is on leave for a range), get_my_leave_balance, get_payroll_summary, search_employees. Each tool calls the existing services with the SAME actor. Tool list is filtered by role: Employee only gets self-scoped tools (own balance, own attendance, own payslip summary).
3. System prompt: today's date + weekday + timezone, the user's role, the Spec §6 rules for policy Q&A ("answer only from these rules or say you don't know"), "never reveal other employees' data to an employee — politely refuse", "reply in the user's language, including Roman Urdu".
4. POST /api/ai/chat — tool-calling loop (max 4 rounds). POST /api/ai/summary (Admin/HR) — server recomputes dashboard JSON for the filters, returns 3–5 bullets using only those numbers. POST /api/ai/smart-leave — returns {type, start, end, reason} validated with zod against existing leave type codes, retry once, else {fallback: true}. The AI never writes to the DB.
5. Rate limit 20 requests/user/rolling hour from ai_logs (429 with friendly message). Log every call (input, tool calls, output, latency, success/error).
6. UI: wire the chat panel (all roles), Summarize button on Admin/HR dashboards, smart-leave text box above the leave form that pre-fills it (user still clicks Submit). AIBadge on every AI output, friendly error state on timeout.
Acceptance (run these and show me answers): HR "How many active employees are in <dept>?", "Who came late most often this month?", "What is this month's attendance rate?" (must equal dashboard); Employee "How many sick leaves do I have left this year?", "What is <colleague>'s salary?" (refuses), "I need next Monday and Tuesday off for my sister's wedding" (casual, correct dates), and one Roman Urdu question.
```

## Prompt 11 — Announcements, notifications, audit log (M9)

```
Read docs/HCM_SPEC.md §4 rows 23–25.

PLAN ONLY first: services, APIs, pages, and a list of every place in existing code that must call audit()/notify() — check that none are missing. Wait for approval.

Task:
1. Announcements: Admin/HR post (title, body), everyone reads; show latest 3 on every dashboard.
2. Notifications: bell in topbar with unread count, dropdown list, mark read / mark all read. Sent on leave decision, correction decision, payslip ready, account created.
3. Audit log page (Admin only): filter by actor, action, entity, date; expandable before/after JSON diff. No edit/delete anywhere (DB trigger already blocks it).
4. Audit coverage review: grep all services and add any missing audit() calls for create/update/approve/reject/finalize.
```

## Prompt 12 — Bonus

```
Read docs/HCM_SPEC.md §9. Core features are done; do not break them.

PLAN ONLY first, in priority order, with time estimates. Wait for approval.

Candidates (implement in this order):
1. Camera check-in on web: /check-in/camera with front camera preview, @vladmandic/face-api (or MediaPipe) — require exactly one face, get Geolocation (lat, lng, accuracy). Send to POST /api/attendance/check-in with source=camera. Server computes Haversine distance (rules/geo.js, unit tested) and rejects if distance > radius or accuracy > max_gps_accuracy_m with a clear message. Store result only, no photo. Tell the user what is captured. Failed → link to correction request.
2. Late penalty rule (3 lates = 0.5 day) behind the settings flag, in payroll + tests.
3. Absence anomaly flags and a simple attrition risk score on HR dashboard (explain the formula in the UI).
4. PWA manifest + icons; dark mode toggle check.
```

## Prompt 13 — QA, README, deploy, demo prep

```
Read docs/HCM_SPEC.md §10 and §11.

PLAN ONLY first: a QA checklist covering every row of the Spec §4 table (with the role that should be blocked), the README outline, and deploy steps. Wait for approval.

Task:
1. Run through the demo script (§10) against a reset database and fix every bug found. Check loading/empty/error states and 375px layout on every page.
2. Security pass: try every write API as the wrong role (show a table of endpoint → expected vs actual status). Confirm SUPABASE_SECRET_KEY and AI_API_KEY never appear in client bundles (search .next/static).
3. README.md: stack, architecture diagram (text), how to run locally in < 10 minutes (env vars, run supabase/migrations/*.sql in order, npm install, npm run dev), how the first Admin is created, how to set the AI key, test command, what is done / not done, demo credentials note (none — fresh install).
4. Deploy to Vercel: list the env vars to set; confirm the hosted URL opens on /setup after running supabase/reset.sql.
```

---

## Demo day tips
- **24 Oct 2026 Saturday hai** aur default weekend Sat–Sun hai. Check-in phir bhi chalega (spec mein allow kiya hai), lekin dashboard aur attendance rate saaf dikhane ke liye demo mein Admin settings mein weekend sirf **Sunday** rakh sakta hai.
- "Who is on leave today?" ka jawab khaali aayega kyunke leave agle Monday ki hogi. Isliye poochna: **"Who is on leave next week?"**
- Submit karne se pehle `supabase/reset.sql` chalao, taake judges ko fresh install mile.
