import "server-only";
import { z } from "zod";
import { getDb } from "@/server/db";
import { AppError, conflict, forbidden, notFound } from "@/server/errors";
import { audit } from "@/server/audit";
import { notify } from "@/server/notify";
import { requireRole } from "@/server/auth/guard";
import { countLeaveDays } from "@/server/rules/leaveDays";
import { addDays, localDateTime } from "@/server/rules/companyTime";
import { formatDate } from "@/lib/format";
import { getLeaveBalances } from "./leaveBalance";
import { loadSettings } from "./settings";

// Leave (Spec §4 rows 12–13, §6 Leave). Employees (and HR with an employee
// record) apply for themselves; HR decides; Admin views. The DB backs the
// overlap rule with an exclusion constraint (23P01).

const COLUMNS =
  "id, employee_id, leave_type_id, start_date, end_date, days, reason, status, source, review_comment, reviewed_at, created_at, " +
  "employee:employees!inner(full_name, employee_code, user_id, department_id, department:departments(name)), " +
  "type:leave_types(code, name, yearly_quota, is_paid)";

const invalid = (code, message, field) =>
  new AppError(422, code, message, field ? { fieldErrors: { [field]: [message] } } : undefined);

const noEmployee = () => forbidden("No employee record linked to your account.");

const range = (start, end) => (start === end ? formatDate(start) : `${formatDate(start)} to ${formatDate(end)}`);

const dayWord = (n) => `${n} ${n === 1 ? "day" : "days"}`;

function toLeave(row, today, balance) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee?.full_name ?? null,
    employeeCode: row.employee?.employee_code ?? null,
    departmentName: row.employee?.department?.name ?? null,
    leaveTypeId: row.leave_type_id,
    typeCode: row.type?.code ?? null,
    typeName: row.type?.name ?? null,
    startDate: row.start_date,
    endDate: row.end_date,
    days: Number(row.days),
    reason: row.reason,
    status: row.status,
    source: row.source,
    reviewComment: row.review_comment,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    canCancel: row.status === "pending" || (row.status === "approved" && row.start_date > today),
    ...(balance === undefined ? {} : { balance }),
  };
}

async function holidayDates(start, end) {
  const { data, error } = await getDb().from("holidays").select("date").gte("date", start).lte("date", end);
  if (error) throw error;
  return data.map((h) => h.date);
}

async function companyDate() {
  const settings = await loadSettings();
  return { settings, today: localDateTime(new Date(), settings.timezone).date };
}

async function requestById(id) {
  if (!z.uuid().safeParse(id).success) return null;
  const { data, error } = await getDb().from("leave_requests").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

async function notifyHr(except, title, body) {
  const { data, error } = await getDb().from("app_users").select("id").eq("role", "hr").eq("is_active", true);
  if (error) throw error;
  await Promise.all(data.filter((u) => u.id !== except).map((u) => notify(u.id, "leave", title, body, "/leave")));
}

const balanceFor = (balances, leaveTypeId) => balances.find((b) => b.leaveTypeId === leaveTypeId);

export async function applyLeave(actor, { leaveTypeId, startDate, endDate, reason, source = "form" }) {
  requireRole(actor, "employee", "hr");
  if (!actor.employeeId) throw noEmployee();
  const db = getDb();
  const [{ data: employee, error }, { data: type, error: typeError }, { settings, today }, holidays] = await Promise.all([
    db.from("employees").select("id, full_name, status, join_date, exit_date").eq("id", actor.employeeId).maybeSingle(),
    db.from("leave_types").select("id, code, name, yearly_quota, is_paid").eq("id", leaveTypeId).maybeSingle(),
    companyDate(),
    holidayDates(startDate, endDate),
  ]);
  if (error) throw error;
  if (typeError) throw typeError;
  if (!employee) throw noEmployee();
  if (employee.status === "exited") throw forbidden("Your employment has ended, so you can't apply for leave.");
  if (!type) throw invalid("UNKNOWN_LEAVE_TYPE", "Choose a leave type", "leaveTypeId");
  if (startDate < employee.join_date) {
    throw invalid("NOT_EMPLOYED", `You joined on ${formatDate(employee.join_date)}, so leave can't start earlier.`, "startDate");
  }
  if (employee.exit_date && endDate > employee.exit_date) {
    throw invalid("NOT_EMPLOYED", `Your last day is ${formatDate(employee.exit_date)}, so leave can't end later.`, "endDate");
  }

  const days = countLeaveDays(startDate, endDate, { weekendDays: settings.weekend_days, holidays });
  if (days === 0) throw invalid("NO_WORKING_DAYS", "Those dates are all weekends or holidays, so no leave is needed.", "startDate");

  const { data: overlapping, error: overlapError } = await db
    .from("leave_requests")
    .select("start_date, end_date, status")
    .eq("employee_id", employee.id)
    .in("status", ["pending", "approved"])
    .lte("start_date", endDate)
    .gte("end_date", startDate)
    .limit(1);
  if (overlapError) throw overlapError;
  const overlapMessage = (o) => `This overlaps your ${o.status} leave on ${range(o.start_date, o.end_date)}.`;
  if (overlapping.length > 0) throw invalid("OVERLAP", overlapMessage(overlapping[0]), "startDate");

  if (type.yearly_quota !== null) {
    const balance = balanceFor(await getLeaveBalances(employee.id, Number(startDate.slice(0, 4))), type.id);
    const available = balance?.available ?? type.yearly_quota;
    if (days > available) {
      throw invalid(
        "OVER_BALANCE",
        `You have ${dayWord(Math.max(available, 0))} of ${type.name} left for ${startDate.slice(0, 4)}, and this request needs ${dayWord(days)}.`,
        "leaveTypeId"
      );
    }
  }

  const { data, error: insertError } = await db
    .from("leave_requests")
    .insert({ employee_id: employee.id, leave_type_id: type.id, start_date: startDate, end_date: endDate, days, reason, source })
    .select(COLUMNS)
    .single();
  if (insertError?.code === "23P01") throw invalid("OVERLAP", "This overlaps another leave request of yours.", "startDate");
  if (insertError) throw insertError;

  await audit(actor, "create", "leave_requests", data.id, null, {
    leave_type: type.code,
    start_date: startDate,
    end_date: endDate,
    days,
    source,
  });
  await notifyHr(actor.userId, `${employee.full_name} asked for ${type.name}`, `${range(startDate, endDate)} (${dayWord(days)}): ${reason}`);
  return toLeave(data, today);
}

export async function cancelLeave(actor, id) {
  requireRole(actor, "employee", "hr");
  if (!actor.employeeId) throw noEmployee();
  const [request, { today }] = await Promise.all([requestById(id), companyDate()]);
  // Someone else's request looks the same as a missing one.
  if (!request || request.employee_id !== actor.employeeId) throw notFound("Leave request not found.");
  if (!toLeave(request, today).canCancel) {
    throw invalid(
      "NOT_CANCELLABLE",
      request.status === "approved" ? "This leave has already started, so ask HR to change it." : `A ${request.status} request can't be cancelled.`
    );
  }

  const { data: flipped, error } = await getDb()
    .from("leave_requests")
    .update({ status: "cancelled" })
    .eq("id", request.id)
    .eq("status", request.status)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!flipped) throw conflict("This request changed in the meantime. Reload and try again.");

  await audit(actor, "update", "leave_requests", request.id, { status: request.status }, { status: "cancelled" });
  if (request.status === "approved") {
    await notifyHr(actor.userId, `${request.employee.full_name} cancelled approved ${request.type?.name ?? "leave"}`, range(request.start_date, request.end_date));
  }
  return toLeave({ ...request, status: "cancelled" }, today);
}

export async function listMyLeave(actor, { year } = {}) {
  requireRole(actor, "employee", "hr");
  if (!actor.employeeId) return [];
  const { today } = await companyDate();
  let query = getDb().from("leave_requests").select(COLUMNS).eq("employee_id", actor.employeeId);
  if (year) query = query.gte("start_date", `${year}-01-01`).lte("start_date", `${year}-12-31`);
  const { data, error } = await query.order("start_date", { ascending: false }).limit(100);
  if (error) throw error;
  return data.map((r) => toLeave(r, today));
}

export async function getMyBalances(actor, year) {
  requireRole(actor, "employee", "hr");
  if (!actor.employeeId) return [];
  const resolved = year ?? Number((await companyDate()).today.slice(0, 4));
  return getLeaveBalances(actor.employeeId, resolved);
}

// Admin and HR. Pending: oldest first, each with the employee's balance for that type.
export async function listLeave(actor, { status = "pending", employee, department, from, to } = {}) {
  requireRole(actor, "admin", "hr");
  const { today } = await companyDate();
  let query = getDb().from("leave_requests").select(COLUMNS);
  if (employee) query = query.eq("employee_id", employee);
  if (department) query = query.eq("employee.department_id", department);
  if (to) query = query.lte("start_date", to);
  if (from) query = query.gte("end_date", from);
  if (status === "pending") query = query.eq("status", "pending").order("created_at", { ascending: true });
  else if (status === "decided") query = query.in("status", ["approved", "rejected", "cancelled"]).order("updated_at", { ascending: false }).limit(100);
  else query = query.order("start_date", { ascending: false }).limit(100);
  const { data, error } = await query;
  if (error) throw error;
  if (status !== "pending") return data.map((r) => toLeave(r, today));

  const keys = [...new Set(data.map((r) => `${r.employee_id}|${r.start_date.slice(0, 4)}`))];
  const balances = new Map(
    await Promise.all(keys.map(async (k) => {
      const [employeeId, year] = k.split("|");
      return [k, await getLeaveBalances(employeeId, Number(year))];
    }))
  );
  return data.map((r) => {
    const b = balanceFor(balances.get(`${r.employee_id}|${r.start_date.slice(0, 4)}`) ?? [], r.leave_type_id);
    return toLeave(r, today, b ? { quota: b.quota, approved: b.approved, pending: b.pending, available: b.available } : null);
  });
}

export async function decideLeave(actor, id, { decision, comment }) {
  requireRole(actor, "hr");
  const [request, { today }] = await Promise.all([requestById(id), companyDate()]);
  if (!request) throw notFound("Leave request not found.");
  if (actor.employeeId && request.employee_id === actor.employeeId) {
    throw forbidden("Another HR user must decide your own leave.");
  }
  if (request.status !== "pending") throw conflict("This request has already been decided.");

  const status = decision === "approve" ? "approved" : "rejected";
  if (status === "approved" && request.type?.yearly_quota !== null && request.type?.yearly_quota !== undefined) {
    // Admin may have lowered the quota since the request was made.
    const balance = balanceFor(await getLeaveBalances(request.employee_id, Number(request.start_date.slice(0, 4))), request.leave_type_id);
    const days = Number(request.days);
    if (balance && balance.approved + days > balance.quota) {
      throw invalid(
        "OVER_BALANCE",
        `Approving would go over the ${request.type.name} quota: ${dayWord(balance.quota - balance.approved)} left, request is ${dayWord(days)}.`
      );
    }
  }

  const reviewedAt = new Date().toISOString();
  const { data: flipped, error } = await getDb()
    .from("leave_requests")
    .update({ status, reviewed_by: actor.userId, review_comment: comment || null, reviewed_at: reviewedAt })
    .eq("id", request.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!flipped) throw conflict("This request has already been decided.");

  await audit(actor, decision, "leave_requests", request.id, { status: "pending" }, { status, comment: comment || null });
  if (request.employee?.user_id) {
    const what = `${request.type?.name ?? "Leave"} on ${range(request.start_date, request.end_date)}`;
    await notify(
      request.employee.user_id,
      "leave",
      status === "approved" ? `Your ${what} was approved` : `Your ${what} was rejected`,
      comment || null,
      "/leave/me"
    );
  }
  return toLeave({ ...request, status, review_comment: comment || null, reviewed_at: reviewedAt }, today);
}

// What the apply form needs for its live "X working days" preview.
export async function getLeaveFormContext(actor) {
  requireRole(actor, "employee", "hr");
  const { settings, today } = await companyDate();
  const year = Number(today.slice(0, 4));
  const holidays = await holidayDates(`${year}-01-01`, `${year + 1}-12-31`);
  return { today, year, weekendDays: settings.weekend_days, holidays };
}

// Approved leave from today through the next `days` days (leave page panel).
export async function upcomingLeave(actor, days = 7) {
  requireRole(actor, "admin", "hr");
  const { today } = await companyDate();
  const to = addDays(today, days - 1);
  return { from: today, to, requests: await whoIsOnLeave(actor, { from: today, to }) };
}

// Approved leave overlapping [from, to]. Used by the leave page, dashboards and the AI.
export async function whoIsOnLeave(actor, { from, to, department } = {}) {
  requireRole(actor, "admin", "hr");
  const { today } = await companyDate();
  let query = getDb()
    .from("leave_requests")
    .select(COLUMNS)
    .eq("status", "approved")
    .lte("start_date", to)
    .gte("end_date", from);
  if (department) query = query.eq("employee.department_id", department);
  const { data, error } = await query.order("start_date", { ascending: true });
  if (error) throw error;
  return data.map((r) => toLeave(r, today));
}
