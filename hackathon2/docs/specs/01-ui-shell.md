# 01 — UI shell & design system

Source: docs/PROMPTS.md Prompt 1; HCM_SPEC.md §4 (roles), §7 (dashboards). Stack, commands and structure: HCM_SPEC.md §2–§3 and AGENTS.md.

## Objective
Give every later module a finished frame to plug into: design tokens, a UI kit, a role-aware app shell, the public auth pages and a placeholder for every menu route. No backend exists yet, so every page shows an honest empty state — never sample data.

## Acceptance criteria
- Tokens live in `src/app/globals.css`; light, dark and system themes; a toggle persists the choice without a flash on load.
- UI kit in `src/components/ui/`: Button, Input, Select, Textarea, DatePicker, Checkbox, Card, StatCard, Table (cards below `md`), Badge (all statuses from §5/§6), Dialog, Drawer, Tabs, Toast, EmptyState, ErrorState, Skeleton, Pagination, SearchBar, FilterBar, PageHeader, AIBadge, Spinner.
- `(app)` layout: sidebar + topbar (company name, notifications placeholder, user menu with logout); menus come from one config keyed by role (§4 menus listed in Prompt 1); mobile uses a drawer.
- Role comes from a temporary preview cookie (`hcm_preview_role`) with a switcher; Prompt 3 replaces it with `getActor()`.
- Public pages `/login` (no signup), `/change-password`, `/setup` (2-step wizard) with inline validation states; no fake success.
- Every menu route renders `PageHeader` + `EmptyState`; `loading.js` and `error.js` per route group.
- Role dashboards follow the §7 layouts, all in empty state.
- AI chat panel (slide-over + inline) with message list, input, loading dots, AIBadge on answers; disabled until Prompt 10.
- Anything reading cookies or searchParams sits inside `<Suspense>`.
- `npm run build` passes; every route renders at 375px and 1280px in light and dark.

## Plan
Design system (frontend-design pass — reuse it, don't reinvent per page):
- Palette: canvas `#F5F6F8`/`#0E1014`, surface `#FFFFFF`/`#171A20`, ink `#171A1F`/`#E7E9ED`, muted `#5A6170`/`#9BA2AE`, line `#E2E5EA`/`#2A2F38`, single accent `#2B50C8`/`#86A0FF`. Status tones (success, warning, caution, danger, info, neutral) are only for status and always pair colour with a text label.
- Type: Public Sans for everything, `tabular-nums` for figures, sentence case, no all-caps labels.
- Layout: 248px sidebar ≥1024px, drawer below; 56px topbar; content max 1200px, 16px gutter on mobile.
- Principles: numbers are the hero; accent only for the primary action and active nav; motion only in response to an action; empty/error copy says what will appear and what to do next.

Structure:
- `src/config/navigation.js` — `NAV[role]` is the only menu source.
- `src/server/auth/previewRole.js` + `src/app/actions/preview.js` — TEMP role stub (delete in Prompt 3).
- `src/components/shell/` — ShellFrame (client: drawer + assistant state), RoleNav/NavLinks, UserMenu, NotificationsBell, ThemeToggle, ThemeScript.
- `src/components/dashboard/` — Admin/Hr/Employee dashboards, ChartPanel.
- `src/components/ai/AIChatPanel.js`.
- `src/lib/validation/auth.js` — zod schemas shared by the forms now and the API in Prompt 3.
- Route groups `(public)` and `(app)`; `/` redirects to `/dashboard`.

Routes: `/dashboard`, `/settings/company`, `/settings/organization`, `/settings/leave`, `/users`, `/employees`, `/employees/import`, `/attendance`, `/attendance/corrections`, `/attendance/me`, `/check-in`, `/leave`, `/leave/me`, `/salary`, `/payroll`, `/payslips`, `/profile`, `/announcements`, `/audit`, `/assistant`; public `/login`, `/change-password`, `/setup`.

## Tasks
- [x] Task: Tokens, font, theme script and toggle
  - Acceptance: three theme modes, no flash, tokens exposed as Tailwind utilities
  - Verify: build; screenshots light/dark
  - Files: globals.css, layout.js, shell/ThemeScript.js, shell/ThemeToggle.js
- [x] Task: UI kit
  - Acceptance: every component listed above exists and builds
  - Verify: build + lint
  - Files: src/components/ui/*
- [x] Task: Navigation config, preview role stub, shell
  - Acceptance: menus match Prompt 1 per role; drawer on mobile
  - Verify: screenshots per role at 375/1280
  - Files: config/navigation.js, server/auth/previewRole.js, actions/preview.js, components/shell/*
- [x] Task: `(app)` group pages, loading, error
  - Acceptance: 20 routes render PageHeader + EmptyState
  - Verify: HTTP 200 for every route
  - Files: src/app/(app)/**
- [x] Task: Role dashboards (empty)
  - Acceptance: §7 sections present, no numbers
  - Verify: screenshots per role
  - Files: components/dashboard/*, (app)/dashboard/page.js
- [x] Task: Public pages with validation
  - Acceptance: inline field errors; endpoints that don't exist yet show a form-level error
  - Verify: manual submit; build
  - Files: src/app/(public)/**, actions/auth.js, lib/validation/auth.js, lib/api.js
- [x] Task: AI chat panel
  - Acceptance: opens from the topbar and the employee dashboard; inline on /assistant; disabled state
  - Verify: screenshots
  - Files: components/ai/AIChatPanel.js
- [x] Task: Verification
  - Acceptance: build, lint, test pass; every route 200; screenshots reviewed
  - Verify: see report
  - Files: —
