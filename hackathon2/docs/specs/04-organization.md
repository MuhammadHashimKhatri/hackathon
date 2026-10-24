# 04 — Organization setup (M2)

Source: docs/PROMPTS.md Prompt 4; HCM_SPEC.md §4 rows 03–04, §5, §6. Stack and conventions: HCM_SPEC.md §2–§3 and AGENTS.md.

## Objective
Let Admin configure everything attendance, leave and payroll depend on — company settings, office location, departments, designations, leave types and holidays — from an empty database, with HR able to view but never change it.

## Acceptance criteria
- Settings: Admin reads/updates company_name, timezone, office_start, grace_minutes, half_day_hours, weekend_days, office_lat/lng/radius, max_gps_accuracy_m, late_penalty_enabled. HR reads. Changes apply to new records only. Every change audited with before/after of the changed fields.
- Departments, designations (linked to a department or none), leave types (code, name, quota or unlimited, paid), holidays (date + name): list, create, update, delete. "Add standard leave types" adds annual 14 / sick 8 / casual 10 / unpaid unlimited only where missing.
- Deleting a department with employees → 422 (also 422 while it still has designations). Duplicates → 409.
- Office location: lat/lng inputs, "Use my current location" (Geolocation) with accuracy, radius.
- HR: menu item "Company Setup" opens the same pages read-only (no edit controls). Every write endpoint returns 403 for HR, even via curl.

## Plan
- Access: `NAV.hr` adds `/settings`; `rolesFor` matches by path prefix; `/settings` redirects to `/settings/company`; `SettingsTabs` on all three pages.
- Validation: `src/lib/validation/organization.js` (shared by forms and routes).
- Services: `settings.js`, `organization.js`, `leaveTypes.js`, `holidays.js`; reads `admin|hr`, writes `admin` + `audit()`. DB error mapping in `src/server/dbErrors.js`.
- Routes: `/api/settings`, `/api/departments[/id]`, `/api/designations[/id]`, `/api/leave-types[/id|/standard]`, `/api/holidays[/id]`.
- UI: `CompanySettingsForm` + `LocationPicker`, `OrganizationManager`, `LeaveSetup` (tabs: leave types, holidays). Same pattern as `/users`: server page in `RoleGate` → client manager → API → `router.refresh()`.
- No migration needed (Prompt 2 schema covers it).

## Tasks
- [x] Task: Access model + navigation
  - Acceptance: HR reaches /settings/* read-only; admin unchanged
  - Verify: navigation tests
  - Files: src/config/navigation.js, src/app/(app)/settings/page.js, src/components/settings/SettingsTabs.js
- [x] Task: Schemas, services, routes
  - Acceptance: status codes per plan; audit on every write
  - Verify: validation + guard + service tests
  - Files: src/lib/validation/organization.js, src/server/services/*, src/server/dbErrors.js, src/app/api/**
- [x] Task: Company settings page + LocationPicker
  - Acceptance: saves only changed fields; geolocation errors handled; HR read-only
  - Verify: E2E with geolocation override
  - Files: src/app/(app)/settings/company/*, src/components/settings/LocationPicker.js
- [x] Task: Departments & designations page
  - Acceptance: CRUD, 409 duplicates, 422 delete rules
  - Verify: E2E
  - Files: src/app/(app)/settings/organization/*
- [x] Task: Leave types & holidays page
  - Acceptance: standard types button idempotent; holidays by year
  - Verify: E2E
  - Files: src/app/(app)/settings/leave/*
- [x] Task: End-to-end
  - Acceptance: admin configures from empty DB; HR 403 on every write via curl, 200 on reads
  - Verify: headless Edge + fetch with HR cookies, then reset.sql
  - Files: —
