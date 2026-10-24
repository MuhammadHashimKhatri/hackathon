# 07 — Leave (M5)

Source: docs/PROMPTS.md Prompt 7; HCM_SPEC.md §4 rows 12–13, §5 (leave_types, leave_requests), §6 Working days + Leave. Stack and conventions: HCM_SPEC.md §2–§3 and AGENTS.md.

## Context
Leave types exist (Prompt 4) and `fn_attendance_days` already turns approved leave into `on_leave`, but `/leave` and `/leave/me` were placeholders and `countLeaveDays` threw "Not implemented". This module lets an employee (or HR with an employee record) apply, see balances and cancel; HR decides; Admin views. Payroll (unpaid days), dashboards (on leave today, leave by type) and the AI tools (`get_my_leave_balance`, `get_leave_summary`) read this data.

## Objective / acceptance criteria
- **Apply** (Employee, HR; own only, `actor.employeeId` required): type + start + end + reason (3–500). `days` = working days in the range (weekends and holidays skipped). 422 when: end < start, the range spans two years, days = 0, outside join/exit dates, overlaps own pending/approved request (pre-check + DB exclusion 23P01), or days > available (quota − approved − pending) for a quota type. Unpaid / no-quota types are unlimited. Past dates allowed (e.g. sick leave). HR logins are notified.
- **Cancel** (owner): pending, or approved that hasn't started (start > company today); otherwise 422. Someone else's request → 404. Cancelling approved leave notifies HR.
- **Balances**: per type quota, taken (approved), pending, remaining; unlimited types show "No limit".
- **Decide** (HR only): approve (optional comment) or reject (comment required). **Decision (user):** HR can't decide their own request (403). Already decided → 409. Approve re-checks the quota (Admin may have lowered it) → 422. Audit + notification to the employee.
- **Admin**: sees the same inbox read-only (decision API → 403).
- **Who is on leave** (Admin, HR): approved leave overlapping a date range, optional department filter; the leave page shows the next 7 days.
- **Tests:** overlap → 422, over-balance → 422, Fri–Mon counts 2 days with a Sat–Sun weekend, holiday skipped.

## Plan
- Rule: `src/lib/leaveDays.js` `countLeaveDays(start, end, { weekendDays, holidays })` — pure, in `src/lib` so the client preview uses it without importing `src/server`; `src/server/rules/leaveDays.js` re-exports it.
- Validation `src/lib/validation/leave.js`: `leaveApplySchema` (strict: the body can't name an employee), `leaveDecisionSchema`, `leaveListQuery`, `yearQuery`, `onLeaveQuery`.
- Service `src/server/services/leave.js`: `applyLeave`, `cancelLeave`, `listMyLeave`, `getMyBalances`, `listLeave` (pending tab carries each request's balance), `decideLeave`, `whoIsOnLeave`, `upcomingLeave`, `getLeaveFormContext`. Balances reuse `getLeaveBalances` (`leaveBalance.js`, also used by Employee 360). Status flips use `where status = <current>` so races return 409.
- Routes: `GET|POST /api/leave`, `POST /api/leave/[id]/cancel`, `POST /api/leave/[id]/decision`, `GET /api/leave/balances`, `GET /api/leave/on-leave`.
- Pages: `/leave/me` (balance cards, apply form with live working-day preview, history with cancel) and `/leave` (Waiting / Decided tabs, approve/reject dialog, "On leave in the next 7 days" panel). Data reads sit inside Suspense (RoleGate), so no clock reads at prerender.

## Tasks
- [x] Task: `countLeaveDays` + rule tests — Files: src/lib/leaveDays.js, src/server/rules/leaveDays.js, src/server/rules/leave.test.js
- [x] Task: Validation schemas — Files: src/lib/validation/leave.js
- [x] Task: Leave service + service tests (19 cases) — Files: src/server/services/leave.js, src/server/services/leave.test.js
- [x] Task: API routes — Files: src/app/api/leave/**
- [x] Task: My Leave page — Files: src/app/(app)/leave/me/page.js, MyLeave.js
- [x] Task: Approvals page — Files: src/app/(app)/leave/page.js, LeaveInbox.js
- [x] Task: Verify — `npm test` (150), lint, build clean; API end-to-end against Supabase: 21/21 checks (apply 2 days, overlap 422, over-balance 422, employee/admin decision 403, signed out 401, reject without comment 422, approve, second decision 409, balance 8 left, notification, audit create+approve, who-is-on-leave, pages render); `fn_attendance_days` shows both days as `on_leave`.
