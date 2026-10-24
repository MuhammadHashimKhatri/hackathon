# HCM Lite

AI-assisted Human Capital Management for Admin, HR and Employees, built for the Saylani Hackathon (24 Oct 2026).
The app starts empty: Admin sets up the company, HR registers employees, and every number on the dashboards and in the AI answers comes from what people do in the app.

## Stack

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router, JavaScript), Tailwind CSS v4, recharts |
| Database | Supabase Postgres (RLS on every table, no client access) |
| Auth | Supabase Auth: JWT sessions in cookies, bcrypt-hashed passwords |
| Server | Route handlers under `src/app/api/**` → services in `src/server/services` (all business rules) → database |
| PDF | `@react-pdf/renderer` (payslips) |
| AI | Any OpenAI-compatible API with tool calling (Groq or Gemini free tier) via the `openai` SDK, server-side only |
| Tests | Vitest (`npm test`) |

```
Browser ──REST/JSON──> /api/* route handlers ──> src/server/services (role + scope checks, rules) ──> Supabase Postgres
                         │                                   ▲
                         └── /api/ai/* ──> LLM (tool calls) ─┘  (tools call the same services as the API)
```

Security: every service checks the role and data scope itself (an Employee only reads their own `employee_id`). The database is reachable only with the server-side secret key; the browser key is refused by RLS. The audit log is append-only and a finalized payroll month is locked by database triggers.

## Run it locally (under 10 minutes)

1. **Supabase project**: create one at supabase.com.
   - Authentication → Sign In / Providers → turn **off** "Allow new users to sign up".
   - SQL Editor → run these files **in order**, each pasted into a new query:
     `supabase/migrations/001_schema.sql`, `002_auth.sql`, `003_employees.sql`, `004_payroll_analytics.sql`.
2. **Env vars**: copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (Project Settings → API Keys).
   - `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` (see below).
3. **Start**:
   ```bash
   npm install
   npm run dev
   ```
   Open http://localhost:3000. Optional check: `npm run db:check`.

## First Admin

A fresh install opens on **/setup**: enter the company name and the Admin email and password. That creates the Admin account (setup works only once). If `ADMIN_EMAIL` / `ADMIN_PASSWORD` are set, the form is pre-filled.

Then:
1. Admin → Company Settings (office hours, grace time, weekend, office location), Departments & Designations, Leave Types & Holidays ("Add standard leave types"), Users → **Create HR login** (temporary password shown once).
2. HR logs in, changes the password, then Employees → **Register employee** (this creates the employee's login with a temporary password).
3. The employee logs in, changes the password, checks in, applies for leave.

## AI key

The key is only read on the server (`AI_API_KEY`); the browser never calls the provider.

- **Groq (free, fast)**: create a key at https://console.groq.com/keys, then
  `AI_BASE_URL=https://api.groq.com/openai/v1`, `AI_MODEL=llama-3.3-70b-versatile`.
- **Google Gemini (free)**: create a key at https://aistudio.google.com/apikey, then
  `AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/`, `AI_MODEL=gemini-2.5-flash`.

Restart `npm run dev` after changing env vars. Without a key the app still works and the AI features show a friendly "not connected" message.

AI features: chat assistant with tools (`/assistant` or the panel), dashboard **Summarize** (Admin/HR), **smart leave** on My Leave ("Need next Monday and Tuesday off for my sister's wedding" → pre-filled form), policy Q&A. Guardrails: 15 s timeout, 20 requests per user per hour, every call logged in `ai_logs`, "AI-generated" label, JSON validated with one retry.

## Tests

```bash
npm test        # unit tests: tax slabs, payroll worked example (net 68,636.36), attendance/leave rules, RBAC
npm run lint
npm run build
```

## Deploy (Vercel)

1. Push the repo to GitHub, import it in Vercel.
2. Add the env vars from `.env.example` in Vercel → Settings → Environment Variables.
3. Before judging, run `supabase/reset.sql` in the SQL Editor (deletes all data and users, keeps the schema) so the hosted app opens on /setup.

## Done / not done

Done: all 25 functionalities in the brief — first-run setup, 3 roles with server-side guards, company settings, departments/designations/leave types/holidays, HR logins, employee registration + directory + Employee 360 + CSV import (dry run) / export, web check-in/out with status rules, attendance calendar/board/corrections, leave apply/cancel/balance/approval, salary structures, monthly payroll draft → finalize (locked) → payslip PDF, Admin/HR/Employee dashboards with filters, AI chat/summary/smart leave/policy Q&A, announcements, notifications, audit log. Bonus: late penalty rule (setting), dark mode, AI understands Roman Urdu.

Not done: mobile app and camera/face check-in (location is recorded on web check-in but not enforced), attrition risk score, absence anomaly flags, PWA.
