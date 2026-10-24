# 06 — Attendance (M4)

Source: docs/PROMPTS.md Prompt 6; HCM_SPEC.md §4 rows 09–11, §5 (attendance, attendance_corrections), §6 Working days + Attendance. Stack and conventions: HCM_SPEC.md §2–§3 and AGENTS.md.

## Context
Employees and salaries exist (Prompt 5), but `/check-in`, `/attendance`, `/attendance/me` and `/attendance/corrections` are placeholders, and the rule stubs in `src/server/rules/{attendanceStatus,workingDays,geo}.js` throw "Not implemented". This module lets employees (and HR with an employee record) check in and out, shows each person's month with the derived statuses, gives Admin/HR a daily board, and lets HR approve correction requests. Payroll (Prompt 8) and dashboards (Prompt 9) count these rows, so the rules must match §6 exactly.

## Objective / acceptance criteria
- **Check-in** (Employee, HR; own only; `actor.employeeId` required, otherwise "No employee record linked"): the server stamps the time; work_date = local date in `company_settings.timezone`. One row per day: a second check-in → **409**. Allowed on weekends/holidays (§6 Decision). Status `late` if local hh:mm > office_start + grace (**minute precision, approved**: 09:15:xx present, 09:16 late), else `present`. Exited employees can't check in (403).
- **Location (approved: record only):** if the browser shares lat/lng/accuracy they are stored with `distance_m` to the office (Haversine) when an office location is set. No rejection; geofence enforcement comes with camera check-in (Prompt 12).
- **Check-out:** no check-in today → **422**; already checked out → **409**; worked < half_day_hours → `half_day` (overrides late), else status unchanged.
- **My calendar** (self): any month; each day shows present / late / half_day / missing_checkout / absent / on_leave from `fn_attendance_days`, check-in/out times, weekend and holiday markers, and a pending-correction marker. "Request correction" on past or today's days.
- **Daily board** (Admin, HR): any date + department + status filter + name search; every employee employed that day with effective status (or "Not checked in yet" today / "Off day" on non-working days), check-in/out times, late/half-day badges, summary counts.
- **Corrections:** Employee requests for own day ≤ today with requested check-in and/or check-out (local times) + reason (required); a missing check-in is only allowed when that day already has one. One pending request per day (**409**). HR lists pending + recent decisions, approves (optional comment) or rejects (comment required). Approve → upsert attendance with `source = correction`, status recomputed with the same rules → audit + notification to the employee. New request → notification to HR logins. Admin: view only.
- **HR menu gets "Check-in"** (approved). Employee dashboard's "Today" card becomes the live check-in widget.
- **Tests:** 09:15 → present, 09:16 → late, 4h59m → half_day, 5h00m keeps status, second check-in → 409.

## Plan

### Pure rules (unit tested, no I/O)
- `src/server/rules/companyTime.js` (new):
  - `localDateTime(instant: Date, timeZone) → { date: "YYYY-MM-DD", minutes: 0–1439 }` via `Intl.DateTimeFormat`.
  - `zonedToUtc(date: "YYYY-MM-DD", time: "HH:MM", timeZone) → Date` (corrections: local time typed by the user → timestamptz; DST-safe two-pass offset).
- `src/server/rules/attendanceStatus.js`:
  - `statusAtCheckIn(checkInAt: Date, { timezone, office_start, grace_minutes }) → "present" | "late"`.
  - `statusAtCheckOut(currentStatus, checkInAt, checkOutAt, { half_day_hours }) → status` (`half_day` when worked ms < hours × 3.6e6).
  - `recomputeStatus(checkInAt, checkOutAt | null, settings)` = the two above in order (used by corrections).
- `src/server/rules/workingDays.js`: `isWorkingDay(date, { weekendDays, holidays })`, `countWorkingDays(start, end, { weekendDays, holidays })` (dates as `YYYY-MM-DD`, weekday from UTC so no zone drift; holidays = array or Set). Used for calendar/board markers; SQL `fn_working_days` stays the source for metrics.
- `src/server/rules/geo.js`: `haversineMeters(a, b)`, `isWithinRadius(point, office, radiusM)` (distance now, enforcement in Prompt 12).
- Test cases (`src/server/rules/attendance.test.js`): Asia/Karachi 09:15:00 / 09:15:59 → present, 09:16 → late; grace 0 → 09:01 late; another timezone (UTC check-in 04:16Z = 09:16 PKT → late); local date flips at midnight PKT (19:30Z = next day); 4h59m → half_day, 5h00m → keeps late; half_day overrides late; weekend `{0,6}` + holiday; count across a month = 22 for Oct 2026 with no holidays; haversine known pair (≈ value) and radius boundary; `zonedToUtc("2026-10-24","09:00","Asia/Karachi")` = 04:00Z.

### Validation `src/lib/validation/attendance.js`
- `checkInSchema` = `{ source: "web" (camera reserved for Prompt 12), lat?, lng?, accuracy? }` strict; lat/lng together.
- `monthQuery` = `YYYY-MM` (default current month). `boardQuery` = `date` (isoDate, default today), `department` uuid?, `status` enum?, `q`?.
- `correctionRequestSchema` = `{ workDate, checkIn: "HH:MM" | null, checkOut: "HH:MM" | null, reason 3–500 }`, at least one time, out > in when both.
- `correctionDecisionSchema` = `{ decision: "approve" | "reject", comment ≤ 500 }`, comment required for reject.

### Services
- `src/server/services/settings.js`: `loadSettings()` exported (no role check) for services that need the rules.
- `src/server/services/attendance.js`:
  - `getAttendanceSettings()` (internal: timezone, office_start, grace, half_day_hours, weekend_days, office lat/lng) — reuses `company_settings` read pattern from `services/settings.js`.
  - `getToday(actor)` → `{ serverNow, today, record | null, isWorkingDay, holidayName }` for the widget.
  - `checkIn(actor, input)`: `requireRole(hr, employee)`, linked + not exited employee; `now = new Date()`; insert; `23505` on `attendance_employee_day_key` → 409 "You've already checked in today".
  - `checkOut(actor)`: read today's row → 422 / 409; `update … where check_out_at is null` (race-safe; 0 rows → 409).
  - `getCalendar(actor, { month }, employeeId = actor.employeeId)` (also feeds the Employee 360 attendance tab): Employee only self (403 otherwise, before any read); Admin/HR any. `fn_attendance_days(monthStart, monthEnd).eq(employee_id)` + holidays in month + pending corrections → one entry per calendar day.
  - `dailyBoard(actor, { date, department, status, q })`: Admin/HR. Employees employed on `date` (join ≤ date, exit null or ≥ date) + `fn_attendance_days(date, date, department)`; unrecorded → `not_in_yet` (today, working day) or `off_day`; counts per status.
- `src/server/services/corrections.js`: `requestCorrection(actor, input)` (Employee, own), `listCorrections(actor, { status })` (HR, Admin view), `listMyCorrections(actor)`, `decideCorrection(actor, id, input)` (HR): flip `pending → approved/rejected` with `.eq("status","pending")` (double approve → 409), then upsert attendance (`onConflict: employee_id,work_date`, source correction, `recomputeStatus`); if the upsert fails the request is put back to pending. `audit()` + `notify()` (existing helpers).

### API (`withApi` + `parse` + `requireActor`)
| Method & path | Who |
|---|---|
| `POST /api/attendance/check-in` | Employee, HR (own) → 201 / 409 |
| `POST /api/attendance/check-out` | Employee, HR (own) → 200 / 409 / 422 |
| `GET /api/attendance/me?month=YYYY-MM` | own calendar |
| `GET /api/attendance/board?date=&department=&status=&q=` | Admin, HR |
| `GET /api/employees/[id]/attendance?month=` | Admin, HR (any); Employee self only (403) |
| `GET /api/attendance/corrections?status=pending` (or `decided`) / `POST /api/attendance/corrections` | list: HR, Admin (Admin reaches the page from the Attendance item) · request: Employee |
| `POST /api/attendance/corrections/[id]/decision` | HR |

### Pages (frontend-design: reuse the Prompt 1 system and `STATUS` badge tones; loading / empty / error; 375 px; dark mode)
- `src/components/attendance/CheckInWidget.js` (client): large clock showing **server** time in company timezone (client ticks from a server-time offset, never its own date), today's status badge, check-in/out times and worked hours; one big button: Check in → Check out → disabled "Done for today". Asks for location when pressed; works if denied ("Location not shared"). Used on `/check-in` and the Employee dashboard "Today" card.
- `src/components/attendance/MonthCalendar.js`: 7-column month grid (Mon-first, weekday headers, leading blanks), each day tinted by status with time range, weekend/holiday muted, pending-correction dot; prev/next month in URL (`?month=`); list view under `sm`. Day click → details + "Request correction" dialog (`CorrectionDialog`).
- `/attendance/me` (Employee): month summary counts + `MonthCalendar` + "My correction requests" list.
- `/attendance` (Admin, HR): daily board — date picker (default today), department, status chips with counts, search; table (employee, status, in, out, hours, source) with mobile cards; row links to Employee 360.
- `/attendance/corrections` (HR): tabs Pending / Decided; each request shows employee, day, current vs requested times, reason; Approve / Reject dialog with comment.
- Employee 360 Attendance tab switches to `MonthCalendar` with month navigation (data via `/api/employees/[id]/attendance`).
- Navigation: HR gets `{ label: "Check-in", href: "/check-in" }` (approved).

### Risks
- Time zones: every "today" comes from `localDateTime(new Date(), settings.timezone)` on the server after the session check (`getActor` already awaits `connection()`), never from the browser.
- Approve is two writes (request + attendance) without a DB transaction → guarded flip + compensating revert; double-click → 409.
- Check-out after local midnight finds no row for "today" → 422 with a hint to request a correction.

## Tasks
- [x] Task: Rules + tests
  - Acceptance: all rule functions implemented; listed cases pass; rules smoke test still passes
  - Verify: `npm test`
  - Files: src/server/rules/{companyTime,attendanceStatus,workingDays,geo}.js, src/server/rules/attendance.test.js
- [x] Task: Validation + attendance service + routes
  - Acceptance: 201 / 409 / 422 / 403 per spec; server stamps time; weekend check-in allowed
  - Verify: `npm test` (`attendance.test.js` service tests with `test/fakeDb.js`: second check-in → 409, check-out without check-in → 422, employee board → 403)
  - Files: src/lib/validation/attendance.js, src/server/services/attendance.js (+ test), src/app/api/attendance/**, src/app/api/employees/[id]/attendance/route.js
- [x] Task: Corrections service + routes
  - Acceptance: one pending per day; approve upserts with source correction + recomputed status; audit + notify; reject needs a comment
  - Verify: `npm test` (`corrections.test.js`)
  - Files: src/server/services/corrections.js (+ test), src/app/api/attendance/corrections/**
- [x] Task: Check-in widget, /check-in, Employee dashboard card, HR nav
  - Acceptance: server time shown; button states; works without location
  - Verify: browser
  - Files: src/components/attendance/CheckInWidget.js, src/app/(app)/check-in/page.js, src/components/dashboard/EmployeeDashboard.js, src/config/navigation.js (+ test)
- [x] Task: My Attendance calendar + correction requests; 360 attendance tab
  - Acceptance: month navigation; colored statuses; request dialog
  - Verify: browser at 375 px + dark mode
  - Files: src/components/attendance/{MonthCalendar,CorrectionDialog}.js, src/app/(app)/attendance/me/*, src/components/employees/Employee360.js
- [x] Task: HR daily board + corrections inbox
  - Acceptance: filters in URL; counts; approve/reject updates the day
  - Verify: browser
  - Files: src/app/(app)/attendance/page.js (+ client), src/app/(app)/attendance/corrections/*
- [x] Task: End-to-end
  - Acceptance: employee checks in (status shown), second check-in 409, checks out; requests a correction; HR approves → day shows `source correction`; employee gets 403 on the board and on another employee's calendar; `npm test`, `npm run lint`, `npm run build` green
  - Verify: one headless Edge run (needs test data; reset.sql afterwards)
  - Files: —

## Decisions (approved)
1. Web check-in records location only; no geofence rejection until Prompt 12.
2. Late is decided at minute precision.
3. HR gets a Check-in menu item; HR does not request corrections (approves them).
4. Self check-in/check-out are not audited (the attendance row is the record); correction approvals/rejections are.
