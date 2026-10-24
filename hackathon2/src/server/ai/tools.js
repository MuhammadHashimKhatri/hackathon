import "server-only";
import { AppError } from "@/server/errors";
import { getCalendar } from "@/server/services/attendance";
import { getMetrics } from "@/server/services/analytics";
import { listEmployees } from "@/server/services/employees";
import { getMyBalances, whoIsOnLeave } from "@/server/services/leave";
import { listDepartments } from "@/server/services/organization";
import { getRunForMonth, listPayslips } from "@/server/services/payroll";

// AI tools (Spec §8). Each one calls the same services as the REST API with the
// same actor, so role and data-scope checks are identical. Employees only get
// self-scoped tools, so there is no tool that could return a colleague's data.

const dateProp = (what) => ({ type: "string", description: `${what} as YYYY-MM-DD` });
const deptProp = { type: "string", description: "Department name, optional (all departments when omitted)" };

const DEFS = {
  get_headcount: {
    description: "Active + probation headcount, attrition and headcount by department.",
    parameters: { type: "object", properties: { department: deptProp, date: dateProp("Date to count on (default today)") } },
  },
  get_attendance_summary: {
    description: "Attendance counts and rates (attendance rate %, late %, absenteeism %) for a date range, plus today's present/late/on-leave counts. Same numbers as the dashboard.",
    parameters: { type: "object", properties: { from: dateProp("Start date (default first day of this month)"), to: dateProp("End date (default today)"), department: deptProp } },
  },
  get_late_comers: {
    description: "Top 5 employees who checked in late most often in a date range.",
    parameters: { type: "object", properties: { from: dateProp("Start date (default first day of this month)"), to: dateProp("End date (default today)"), department: deptProp } },
  },
  get_leave_summary: {
    description: "Who is on approved leave in a date range (names, types, dates) and approved leave days by type this year.",
    parameters: { type: "object", properties: { from: dateProp("Start date"), to: dateProp("End date"), department: deptProp }, required: ["from", "to"] },
  },
  get_payroll_summary: {
    description: "Payroll totals for a month (status, employees, gross, net, tax) and per-employee net pay.",
    parameters: { type: "object", properties: { month: { type: "string", description: "Month as YYYY-MM (default this month)" } } },
  },
  search_employees: {
    description: "Search the employee directory by name, code or email. Returns job details, no salaries.",
    parameters: { type: "object", properties: { query: { type: "string" }, department: deptProp }, required: ["query"] },
  },
  get_my_leave_balance: {
    description: "The current user's own leave balances (quota, taken, pending, remaining) for a year.",
    parameters: { type: "object", properties: { year: { type: "integer", description: "Year (default this year)" } } },
  },
  get_my_attendance: {
    description: "The current user's own attendance counts for a month (present, late, half day, absent, on leave).",
    parameters: { type: "object", properties: { month: { type: "string", description: "Month as YYYY-MM (default this month)" } } },
  },
  get_my_payslip: {
    description: "The current user's own latest finalized payslips (gross, deductions, tax, net).",
    parameters: { type: "object", properties: {} },
  },
};

const ROLE_TOOLS = {
  admin: ["get_headcount", "get_attendance_summary", "get_late_comers", "get_leave_summary", "get_payroll_summary", "search_employees"],
  hr: ["get_headcount", "get_attendance_summary", "get_late_comers", "get_leave_summary", "get_payroll_summary", "search_employees", "get_my_leave_balance", "get_my_attendance", "get_my_payslip"],
  employee: ["get_my_leave_balance", "get_my_attendance", "get_my_payslip"],
};

export const toolNamesFor = (role) => ROLE_TOOLS[role] ?? [];

export function toolsFor(role) {
  return toolNamesFor(role).map((name) => ({ type: "function", function: { name, ...DEFS[name] } }));
}

async function departmentId(actor, name) {
  if (!name) return null;
  const departments = await listDepartments(actor);
  const wanted = name.trim().toLowerCase();
  const match = departments.find((d) => d.name.toLowerCase() === wanted) ?? departments.find((d) => d.name.toLowerCase().includes(wanted));
  if (!match) throw new AppError(404, "UNKNOWN_DEPARTMENT", `No department called "${name}". Departments: ${departments.map((d) => d.name).join(", ") || "none yet"}.`);
  return match.id;
}

const metricsFor = async (actor, { from, to, department }) => getMetrics(actor, { from, to, dept: (await departmentId(actor, department)) ?? undefined });

const RUN = {
  async get_headcount(actor, { department, date }) {
    const m = await metricsFor(actor, { from: date, to: date, department });
    return { as_of: m.filters.to, department: department ?? "all", headcount: m.headcount, by_department: m.by_department, attrition_pct: m.attrition_pct };
  },
  async get_attendance_summary(actor, args) {
    const m = await metricsFor(actor, args);
    return { range: { from: m.filters.from, to: m.filters.to }, department: args.department ?? "all", attendance: m.attendance, today: m.today };
  },
  async get_late_comers(actor, args) {
    const m = await metricsFor(actor, args);
    return { range: { from: m.filters.from, to: m.filters.to }, top_late: m.top_late };
  },
  async get_leave_summary(actor, { from, to, department }) {
    const dept = await departmentId(actor, department);
    const [onLeave, m] = await Promise.all([
      whoIsOnLeave(actor, { from, to, department: dept ?? undefined }),
      getMetrics(actor, { from, to, dept: dept ?? undefined }),
    ]);
    return {
      range: { from, to },
      on_leave: onLeave.map((r) => ({ name: r.employeeName, code: r.employeeCode, type: r.typeName, from: r.startDate, to: r.endDate, days: r.days })),
      approved_days_this_year_by_type: m.leave_by_type.map((l) => ({ type: l.name, approved_days: Number(l.approved_ytd) })),
      pending_requests: m.pending_leave,
    };
  },
  async get_payroll_summary(actor, { month }) {
    const m = month ?? (await getMetrics(actor, {})).filters.to.slice(0, 7);
    const data = await getRunForMonth(actor, m);
    if (!data) return { month: m, status: "not generated yet" };
    return {
      month: m,
      status: data.run.status,
      employees: data.payslips.length,
      total_gross: data.run.totalGross,
      total_net: data.run.totalNet,
      total_tax: Math.round(data.payslips.reduce((s, p) => s + p.monthlyTax, 0) * 100) / 100,
      payslips: data.payslips.map((p) => ({ name: p.employeeName, code: p.employeeCode, net: p.net, deductions: p.deduction })),
    };
  },
  async search_employees(actor, { query, department }) {
    const dept = await departmentId(actor, department);
    const result = await listEmployees(actor, { q: query, department: dept ?? undefined, page: 1 });
    return {
      total: result.total,
      employees: result.rows.slice(0, 10).map((e) => ({
        name: e.fullName, code: e.employeeCode, email: e.email, department: e.departmentName, designation: e.designationTitle, status: e.status, join_date: e.joinDate,
      })),
    };
  },
  async get_my_leave_balance(actor, { year }) {
    if (!actor.employeeId) return { error: "This login has no employee record, so it has no leave balance." };
    const balances = await getMyBalances(actor, year);
    return { balances: balances.map((b) => ({ type: b.name, quota: b.quota ?? "unlimited", taken: b.approved, pending: b.pending, remaining: b.balance ?? "unlimited", available_to_request: b.available ?? "unlimited" })) };
  },
  async get_my_attendance(actor, { month }) {
    if (!actor.employeeId) return { error: "This login has no employee record, so it has no attendance." };
    const calendar = await getCalendar(actor, month ? { month } : {});
    return { month: calendar.month, counts: calendar.counts };
  },
  async get_my_payslip(actor) {
    if (!actor.employeeId) return { error: "This login has no employee record, so it has no payslips." };
    const slips = await listPayslips({ ...actor, role: "employee" });
    return { payslips: slips.slice(0, 3).map((p) => ({ month: p.month.slice(0, 7), gross: p.proratedGross, deductions: p.deduction, tax: p.monthlyTax, net: p.net })) };
  },
};

// Runs a tool the model asked for. Unknown or not-allowed tools and service
// errors (403, 404, 422) come back as { error } for the model to explain.
export async function runTool(actor, name, rawArgs) {
  if (!toolNamesFor(actor.role).includes(name)) return { error: "That information isn't available to your role." };
  let args = {};
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return { error: "The tool arguments were not valid JSON." };
  }
  try {
    return await RUN[name](actor, args ?? {});
  } catch (err) {
    if (err instanceof AppError) return { error: err.message };
    throw err;
  }
}
