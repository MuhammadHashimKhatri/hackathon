import "server-only";
import { getDb } from "@/server/db";
import { requireRole } from "@/server/auth/guard";
import { addDays, localDateTime } from "@/server/rules/companyTime";
import { weekdayOf } from "@/server/rules/workingDays";
import { getLeaveBalances } from "./leaveBalance";
import { listAnnouncements } from "./announcements";
import { listAudit } from "./auditLog";
import { listPayslips } from "./payroll";
import { loadSettings } from "./settings";

// Dashboards (Spec §7). Every company number comes from fn_dashboard (DB
// aggregation); the AI summary and the assistant tools reuse this JSON.

async function today() {
  const settings = await loadSettings();
  return localDateTime(new Date(), settings.timezone).date;
}

// Default range: the current month up to today.
export async function resolveFilters({ from, to, dept } = {}) {
  const t = await today();
  const end = to ?? t;
  const start = from ?? `${end.slice(0, 7)}-01`;
  return start <= end ? { from: start, to: end, dept: dept ?? null } : { from: end, to: start, dept: dept ?? null };
}

export async function getMetrics(actor, filters) {
  requireRole(actor, "admin", "hr");
  const f = await resolveFilters(filters);
  const { data, error } = await getDb().rpc("fn_dashboard", { p_from: f.from, p_to: f.to, p_dept: f.dept });
  if (error) throw error;
  return data;
}

export async function getHrDashboard(actor, filters) {
  requireRole(actor, "hr");
  const [metrics, announcements] = await Promise.all([getMetrics(actor, filters), listAnnouncements(actor, { limit: 3 })]);
  return { metrics, announcements };
}

export async function getAdminDashboard(actor, filters) {
  requireRole(actor, "admin");
  const [metrics, announcements, audit] = await Promise.all([
    getMetrics(actor, filters),
    listAnnouncements(actor, { limit: 3 }),
    listAudit(actor, { pageSize: 8 }),
  ]);
  return { metrics, announcements, recentActivity: audit.rows };
}

const hoursBetween = (a, b) => Math.max(0, (new Date(b) - new Date(a)) / 3_600_000);

// Own numbers only: hours this week (Mon–Sun), late this month, balances, last payslip.
export async function getEmployeeDashboard(actor) {
  requireRole(actor, "employee", "hr");
  const announcements = await listAnnouncements(actor, { limit: 3 });
  if (!actor.employeeId) return { linked: false, announcements };

  const t = await today();
  const monday = addDays(t, -((weekdayOf(t) + 6) % 7));
  const monthStart = `${t.slice(0, 7)}-01`;
  const db = getDb();
  const [week, lates, balances, payslips] = await Promise.all([
    db.from("attendance").select("work_date, check_in_at, check_out_at").eq("employee_id", actor.employeeId).gte("work_date", monday).lte("work_date", addDays(monday, 6)),
    db.from("attendance").select("id", { count: "exact", head: true }).eq("employee_id", actor.employeeId).eq("status", "late").gte("work_date", monthStart).lte("work_date", t),
    getLeaveBalances(actor.employeeId, Number(t.slice(0, 4))),
    listPayslips({ ...actor, role: "employee" }),
  ]);
  if (week.error) throw week.error;
  if (lates.error) throw lates.error;

  const now = new Date().toISOString();
  const hours = week.data.reduce((sum, r) => {
    if (!r.check_in_at) return sum;
    // An open check-in today counts up to now; an older one with no check-out counts 0.
    const end = r.check_out_at ?? (r.work_date === t ? now : r.check_in_at);
    return sum + hoursBetween(r.check_in_at, end);
  }, 0);

  return {
    linked: true,
    today: t,
    week: { from: monday, to: addDays(monday, 6), hours: Math.round(hours * 10) / 10, target: 40 },
    lateThisMonth: lates.count ?? 0,
    balances,
    lastPayslip: payslips[0] ?? null,
    announcements,
  };
}
