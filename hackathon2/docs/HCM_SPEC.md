# HCM Lite — Refined Build Spec

Source: Saylani Hackathon "HCM Lite" challenge brief (24 Oct 2026). This file is the single source of truth for the coding agent. Where the brief was vague, a **Decision** is written down so every prompt builds the same thing.

---

## 1. Goal in one paragraph

A web HR system with three roles (Admin, HR, Employee). It starts **empty** — no seed or dummy data. Admin sets up the company, HR registers employees (which creates their logins), employees check in and apply for leave, HR runs payroll, Admin finalizes it. Dashboards and an AI assistant read the **same server services**, so their numbers always match. Judges start from a fresh install and verify everything live.

## 2. Stack (fixed)

| Layer | Choice |
|---|---|
| Framework | Next.js 16 App Router, JavaScript (no TS), Tailwind v4. Read `node_modules/next/dist/docs/` before writing code. `cacheComponents: true` is on → anything reading cookies/headers/searchParams must sit inside `<Suspense>`. Middleware is called **`src/proxy.js`** in v16. `params` / `searchParams` are Promises. |
| Database | Supabase Postgres |
| Auth | Supabase Auth (JWT sessions, bcrypt-hashed passwords) via `@supabase/ssr` cookies |
| Server data access | Supabase client with **secret key** (`SUPABASE_SECRET_KEY`), used only inside `src/server/**` files that import `server-only`. All tables have RLS **enabled with no policies** → the browser can never read/write the DB directly with the publishable key. |
| Validation | `zod` |
| Charts | `recharts` |
| PDF | `@react-pdf/renderer` (server-side `renderToBuffer`) |
| CSV | `papaparse` |
| AI | Any OpenAI-compatible tool-calling API through the `openai` npm package with `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` (e.g. Google Gemini free tier OpenAI-compatible endpoint, or Groq). |
| Tests | `vitest` for pure business-rule functions |
| Hosting | Vercel (app) + Supabase (DB) |

### Env vars (`.env.example` committed, `.env.local` never)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=            # server only
AI_BASE_URL=
AI_API_KEY=                     # server only
AI_MODEL=
ADMIN_EMAIL=                    # optional: first-run admin from env
ADMIN_PASSWORD=
```

## 3. Architecture

```
src/
  app/                    # pages (UI) + route handlers under app/api/**
  components/             # UI kit + feature components
  server/
    db.js                 # secret-key Supabase client (server-only)
    auth/session.js       # getActor(): { userId, role, employeeId, mustChangePassword }
    auth/guard.js         # requireRole(actor, ...roles), scope helpers
    errors.js             # AppError(status, code, message, details)
    audit.js              # audit(actor, action, entity, entityId, before, after)
    notify.js             # notify(userId, type, title, body, link)
    services/             # ALL business rules live here, one file per module
    rules/                # pure functions (tax, payroll, working days, status, haversine) — unit tested
    ai/                   # LLM client, tools, prompts
  proxy.js                # session refresh + redirect unauthenticated / must-change-password
```

Rules:
- **routes → service → data.** Route handlers and server actions only parse input (zod), call `getActor()`, call a service, and map `AppError` to an HTTP status. No business logic in pages or route handlers.
- Every service function takes `actor` as the first argument and enforces **role + data scope itself**. An Employee can only touch rows where `employee_id = actor.employeeId`. Hiding a button is never the protection.
- Mutations are REST route handlers under `/api/**` returning JSON. Required status codes: `401` not logged in, `403` wrong role/scope, `404`, `409` duplicate check-in, `422` validation/business-rule failure (overlap, over-balance, bad CSV).
- AI tools call the **same service functions** with the same `actor`.

## 4. Roles & permissions

| # | Functionality | Admin | HR | Employee |
|---|---|---|---|---|
| 01 | First-run setup (company + Admin account) | Manage | — | — |
| 02 | Login, logout, change password, role menus & dashboards | Own | Own | Own |
| 03 | Company settings (hours, grace, weekend, office location/radius) | Manage | View | — |
| 04 | Departments, designations, leave types & quotas, holidays | Manage | View | — |
| 05 | Create HR logins; deactivate/reset any login | Manage | — | — |
| 06 | Register employee (creates login) & edit details | View | Manage | Own phone & address |
| 07 | Directory + search/filters; Employee 360 | All | All | Own |
| 08 | CSV import (dry run) / export | — | Manage | — |
| 09 | Web check-in / check-out | — | Own | Own |
| 10 | Attendance calendar & daily board | All | All | Own |
| 11 | Attendance correction | View | Approve | Request |
| 12 | Apply / cancel leave, balance, history | — | Own | Own |
| 13 | Approve / reject leave with comment | View | Approve | — |
| 14 | Salary structure | View | Manage | — |
| 15 | Monthly payroll draft | View | Manage | — |
| 16 | Finalize payroll (locks month) | Manage | — | — |
| 17 | Payslip PDF | All | All | Own |
| 18 | Dashboards with filters | Company | HR | Personal |
| 19 | AI chat on real data | All data | HR data | Own data |
| 20 | AI dashboard summary | Yes | Yes | — |
| 21 | Smart leave | — | Own | Own |
| 22 | Policy Q&A | Yes | Yes | Yes |
| 23 | Announcements | Post | Post | Read |
| 24 | In-app notifications | Own | Own | Own |
| 25 | Audit log | View | — | — |

Hard "cannot" rules: nobody edits a finalized payroll; nobody edits/deletes audit entries; HR cannot change settings, create Admins, finalize payroll or view audit log; Employee cannot see others' data/salary, approve anything, or edit own salary/role/attendance.

**Decision:** HR and Admin also have an employee record only if HR registers them as one. Check-in / leave pages show "No employee record linked" when `actor.employeeId` is null.

## 5. Data model (Postgres)

All tables: `id uuid default gen_random_uuid()` (unless noted), `created_at timestamptz default now()`, RLS enabled, no policies.

- **company_settings** (single row, `id int = 1`): company_name, timezone default `'Asia/Karachi'`, office_start time `09:00`, grace_minutes `15`, half_day_hours numeric `5`, weekend_days int[] `{0,6}` (0=Sun, 6=Sat), office_lat, office_lng, office_radius_m `150`, max_gps_accuracy_m `100`, late_penalty_enabled bool `false`, setup_completed bool `false`, updated_at.
- **app_users**: id = `auth.users.id` (PK, FK cascade), email, role enum `admin|hr|employee`, is_active bool, must_change_password bool, employee_id FK nullable unique.
- **departments**: name unique.
- **designations**: title, department_id FK nullable; unique(title, department_id).
- **leave_types**: code unique (`annual|sick|casual|unpaid`), name, yearly_quota int nullable (null = unlimited), is_paid bool. **Decision:** created by Admin in setup; the setup wizard offers one click "add standard types" (annual 14, sick 8, casual 10, unpaid ∞) — this is configuration entered by Admin, not dummy data.
- **holidays**: date unique, name.
- **employees**: employee_code unique (auto `EMP-0001`), user_id FK unique, full_name, email unique, phone, address, gender enum `male|female|other`, date_of_birth, department_id, designation_id, join_date, exit_date nullable, status enum `probation|active|exited`, face_descriptor jsonb nullable (bonus).
- **salary_structures**: employee_id, basic numeric > 0, hra (= 0.40 × basic), medical (= 0.10 × basic), gross generated (= basic + hra + medical = 1.5 × basic), effective_from date. Latest effective row wins.
- **attendance**: employee_id, work_date date, check_in_at timestamptz, check_out_at timestamptz, status enum `present|late|half_day`, source enum `web|camera|correction`, lat, lng, accuracy_m, distance_m, **unique(employee_id, work_date)**.
- **attendance_corrections**: employee_id, work_date, requested_check_in, requested_check_out, reason, status `pending|approved|rejected`, reviewed_by, review_comment, reviewed_at.
- **leave_requests**: employee_id, leave_type_id, start_date, end_date, days numeric, reason, status `pending|approved|rejected|cancelled`, source `form|ai`, reviewed_by, review_comment, reviewed_at.
- **payroll_runs**: month date (first day) unique, status `draft|finalized`, created_by, finalized_by, finalized_at, total_gross, total_net.
- **payslips**: run_id, employee_id, working_days, eligible_days, absent_days, unpaid_leave_days, half_days, late_count, basic, hra, medical, gross, prorated_gross, per_day, deduction, monthly_tax, net; unique(run_id, employee_id).
- **announcements**: title, body, author_id.
- **notifications**: user_id, type, title, body, link, read_at.
- **audit_logs**: actor_id, actor_role, action (`create|update|delete|approve|reject|finalize|login|...`), entity, entity_id, before jsonb, after jsonb. **Trigger blocks UPDATE and DELETE.**
- **ai_logs**: user_id, role, feature (`chat|summary|smart_leave`), input, tool_calls jsonb, output, latency_ms, success bool, error.

DB-level guards: trigger that raises on UPDATE/DELETE of `payroll_runs` / `payslips` when the run is `finalized`; trigger that makes `audit_logs` append-only.

## 6. Business rules (exact)

All dates/times are evaluated in `company_settings.timezone`. The **server** stamps time; the client never sends a timestamp.

### Working days
A date is a working day if its weekday ∉ `weekend_days` and it is not in `holidays`.

### Attendance (M4)
- Check-in: inserts today's row. Second check-in same day → **409**. Check-out without check-in → 422; second check-out → 409.
- Status at check-in: `late` if local check-in time > office_start + grace (09:15), else `present`.
- At check-out: if worked hours < half_day_hours (5 h) → `half_day` (overrides late).
- Derived (computed in queries, not stored): `missing_checkout` = row exists, no check-out, and date < today; `absent` = working day, no row, no approved leave, date ≥ join_date and < today (today counts as absent only after the day ends); `on_leave` = approved leave covers the date.
- **Decision:** check-in is **allowed on non-working days** (judging day 24 Oct 2026 is a Saturday). Such rows are stored and shown, and count toward the attendance numerator and denominator for that day.
- Correction approved → upsert that day's attendance with `source = correction`, recompute status, audit it.

### Leave (M5)
- days = number of working days in [start, end]. 0 days → 422. start > end → 422. **Decision:** start and end must be in the same calendar year.
- Overlap with the employee's own `pending` or `approved` request → **422**.
- Balance(type, year) = quota − approved days. Available for a new request = quota − approved − pending. Request days > available → **422**. Unpaid = unlimited.
- Employee can cancel own `pending` (or future `approved`) request. HR approves/rejects with a comment → notification to employee + audit.

### Payroll (M6)
For month M, for each employee employed during M:
- working_days = working days in M.
- eligible_days = working days in M between max(join_date, first day) and min(exit_date, last day).
- gross = 1.5 × basic (basic + 40% HRA + 10% medical).
- prorated_gross = gross × eligible_days ÷ working_days.
- per_day = gross ÷ working_days.
- deduction = per_day × (absent_days + unpaid_leave_days + 0.5 × half_days) [+ 0.5 day per 3 lates if `late_penalty_enabled`].
- Tax: annual = gross × 12 →
  - ≤ 600,000 → 0
  - ≤ 1,200,000 → 5% of amount over 600,000
  - ≤ 2,400,000 → 30,000 + 15% over 1,200,000
  - ≤ 3,600,000 → 210,000 + 25% over 2,400,000
  - above → 510,000 + 35% over 3,600,000
  - monthly_tax = annual tax ÷ 12
- net = prorated_gross − deduction − monthly_tax (never below 0). Round money to 2 decimals.
- HR creates/regenerates the **draft**; Admin **finalizes** → locked forever, payslip notifications sent.

**Worked example (use as a unit test):** basic 50,000 → HRA 20,000, medical 5,000, gross 75,000. Annual 900,000 → tax 15,000/yr = 1,250/month. Month has 22 working days, full month employed, 1 absent + 1 half day → per_day 3,409.09, deduction 5,113.64, net = 75,000 − 5,113.64 − 1,250 = **68,636.36**.

### Metrics (M7) — computed in SQL (Postgres functions called via `rpc`), filterable by date range + department
- Headcount = employees with status `active|probation`, join_date ≤ end, exit_date null or > end.
- Attrition % = exits in period ÷ ((headcount at start + headcount at end) ÷ 2) × 100.
- Attendance rate = (present + late + missing_checkout + 0.5 × half_day) ÷ (expected employee-working-day records − on_leave).
- Late % = late ÷ (present + late). Absenteeism = absent days ÷ expected working days, per department.
- Leave utilization = approved days ÷ quota, per leave type and department.
- Payroll cost = sum gross & net by month and department; avg salary = mean gross by department/designation.

## 7. Dashboards

- **Admin:** KPIs headcount, attrition YTD, payroll cost, avg salary · headcount by dept · payroll cost by dept · gender & tenure split · audit feed · announcements · AI Summarize.
- **HR:** KPIs headcount, present today, on leave today, late today, pending approvals · attendance trend · absenteeism by dept · leave by type · top 5 late-comers · announcements · AI Summarize.
- **Employee:** check-in widget · hours this week vs 40 h · late count this month · leave balances · last payslip · announcements · "Ask my assistant".

Every page has loading, empty and error states and works at 375 px width.

## 8. AI assistant (M8)

- `POST /api/ai/chat` — model gets the tools allowed for the actor's role; backend executes the tool with the actor's scope; model writes the answer. Tools: `get_headcount`, `get_attendance_summary`, `get_late_comers`, `get_leave_summary` (incl. who is on leave for a date range), `get_my_leave_balance`, `get_payroll_summary`, `search_employees`. Employees only get `get_my_*`-style tools scoped to themselves → asking a colleague's salary is politely refused.
- `POST /api/ai/summary` (Admin/HR) — server recomputes KPI JSON for the given filters, model returns 3–5 bullets using only those numbers.
- `POST /api/ai/smart-leave` (Employee/HR) — sentence → JSON `{type, start, end, reason}`; prompt includes today's date + weekday + timezone; validated with zod; retry once; on failure return `fallback: true` so the UI shows the normal empty form. **The AI never saves** — the user confirms the pre-filled form, which calls the normal leave API.
- Policy Q&A: Section 6 rules are embedded in the system prompt; answer only from them or say "I don't know".
- Guardrails: key only on the server; 15 s timeout with friendly fallback; max 20 AI requests per user per rolling hour (count in `ai_logs`, return 429); every call logged in `ai_logs`; every answer shows an "AI-generated" label; reply in the user's language including Roman Urdu (bonus).

## 9. Bonus (+10)

Camera check-in (face detected exactly once via `@vladmandic/face-api` or MediaPipe + Geolocation; server checks Haversine distance ≤ radius and accuracy ≤ 100 m; store result, not photo) · face match with enrolled descriptor + blink liveness · late penalty rule · attrition risk score · absence anomaly flags · Roman Urdu AI · dark mode / PWA.

## 10. Demo script (must work end to end, from an empty DB)

1. Fresh install → `/setup`: company name, Admin account. Admin sets office hours + location, adds a department, standard leave types, creates an HR login.
2. HR registers 2–3 employees (temp password shown once). One employee logs in, is forced to change password, checks in.
3. Employee types "Need next Monday and Tuesday off for my sister's wedding" → pre-filled casual leave → confirms. HR approves.
4. HR dashboard → Summarize; asks assistant who is on leave next week; runs payroll for the month; Admin finalizes.
5. Employee downloads payslip PDF; asks a colleague's salary → refused. Admin shows audit log.

## 11. Scoring reminder

Core HR flows 25 · Data & analytics 20 · AI 15 · Code quality 15 · UI/UX 10 · Security & RBAC 10 · Demo & docs 5 · Bonus 10.
Submit on lms.saylaniit.com: public Git repo (README: stack, run steps, first Admin, AI key, done / not done) + hosted link that opens on first-run setup.
