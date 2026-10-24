// Verifies the Supabase database after running supabase/migrations/001_schema.sql.
// Read-only: it never writes rows. Run with:  npm run db:check
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !secretKey || !publishableKey) {
  console.error(
    "Missing env. Add NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY to .env.local."
  );
  process.exit(1);
}

const TABLES = [
  "company_settings", "departments", "designations", "leave_types", "holidays", "employees",
  "app_users", "salary_structures", "attendance", "attendance_corrections", "leave_requests",
  "payroll_runs", "payslips", "announcements", "notifications", "audit_logs", "ai_logs",
];

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const server = createClient(url, secretKey, options);
const browser = createClient(url, publishableKey, options);

let failures = 0;
function report(ok, name, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

const pad = (n) => String(n).padStart(2, "0");
const now = new Date();
const monthStart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
const monthEnd = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(lastDay)}`;

// 1. Every table is reachable with the secret key.
for (const table of TABLES) {
  const { count, error } = await server.from(table).select("*", { count: "exact", head: true });
  report(!error, `table ${table}`, error ? error.message : `${count} rows`);
}

// 2. Helper functions respond.
{
  const { data: today, error } = await server.rpc("fn_company_today");
  report(!error && /^\d{4}-\d{2}-\d{2}$/.test(today ?? ""), "fn_company_today", error?.message ?? today);

  const working = await server.rpc("fn_is_working_day", { d: today ?? monthStart });
  report(!working.error && typeof working.data === "boolean", "fn_is_working_day", working.error?.message ?? String(working.data));

  const days = await server.rpc("fn_working_days", { p_from: monthStart, p_to: monthEnd });
  report(!days.error && Number.isInteger(days.data), "fn_working_days (this month)", days.error?.message ?? String(days.data));

  const rows = await server.rpc("fn_attendance_days", { p_from: monthStart, p_to: monthEnd });
  report(!rows.error && Array.isArray(rows.data), "fn_attendance_days (this month)", rows.error?.message ?? `${rows.data.length} rows`);
}

// 2b. Auth functions from 002_auth.sql (read-only call; fn_complete_setup is only checked for privileges).
{
  const { data, error } = await server.rpc("fn_proxy_state", { p_user: null });
  report(!error && typeof data?.setup_completed === "boolean", "fn_proxy_state (002_auth.sql)",
    error?.message ?? `setup_completed=${data.setup_completed}`);
}

// 3. Lock-down: RLS, triggers, no anon privileges.
{
  const { data: health, error } = await server.rpc("fn_schema_health");
  if (error) {
    report(false, "fn_schema_health", error.message);
  } else {
    const missing = health.tables.filter((t) => !t.exists).map((t) => t.table);
    const noRls = health.tables.filter((t) => !t.rls).map((t) => t.table);
    const anonTables = health.tables.filter((t) => t.anon_access).map((t) => t.table);
    report(missing.length === 0, "all 17 tables exist", missing.join(", "));
    report(noRls.length === 0, "RLS enabled on every table", noRls.join(", "));
    report(anonTables.length === 0, "anon/authenticated have no table privileges", anonTables.join(", "));
    report(health.anon_can_execute.length === 0, "anon/authenticated cannot execute functions", health.anon_can_execute.join(", "));
    const t = health.triggers;
    report(Number(t.trg_touch_updated_at) === 12, "updated_at triggers on 12 tables", String(t.trg_touch_updated_at));
    report(
      Number(t.trg_audit_logs_append_only) === 1 && Number(t.trg_payroll_runs_lock) === 1 && Number(t.trg_payslips_lock) === 1,
      "audit and payroll lock triggers"
    );
  }
}

// 4. The browser (publishable key) is refused.
{
  const { data, error } = await browser.from("employees").select("id").limit(1);
  report(Boolean(error), "publishable key cannot read tables", error ? error.code ?? error.message : `got ${data?.length ?? 0} rows`);

  const rpc = await browser.rpc("fn_working_days", { p_from: monthStart, p_to: monthEnd });
  report(Boolean(rpc.error), "publishable key cannot call functions", rpc.error ? rpc.error.code ?? rpc.error.message : `got ${rpc.data}`);
}

console.log(failures ? `\n${failures} check(s) failed.` : "\nAll database checks passed.");
process.exit(failures ? 1 : 0);
