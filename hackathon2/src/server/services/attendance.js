import "server-only";
import { getDb } from "@/server/db";
import { AppError, conflict, forbidden } from "@/server/errors";
import { assertOwnEmployee, requireRole } from "@/server/auth/guard";
import { statusAtCheckIn, statusAtCheckOut } from "@/server/rules/attendanceStatus";
import { addDays, localDateTime, localTime, monthRange, shiftMonth } from "@/server/rules/companyTime";
import { isWorkingDay } from "@/server/rules/workingDays";
import { haversineMeters } from "@/server/rules/geo";
import { loadSettings } from "./settings";
import { findEmployee, searchTerm } from "./employeeQuery";

// Attendance (Spec §4 rows 09–10, §6). The server stamps every time; dates
// are local dates in company_settings.timezone.

const COLUMNS = "id, employee_id, work_date, check_in_at, check_out_at, status, source, lat, lng, accuracy_m, distance_m";

export const ATTENDANCE_STATUSES = ["present", "late", "half_day", "missing_checkout", "absent", "on_leave"];

export function toAttendance(row, timeZone) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    workDate: row.work_date,
    checkInAt: row.check_in_at,
    checkOutAt: row.check_out_at,
    checkIn: row.check_in_at ? localTime(row.check_in_at, timeZone) : null,
    checkOut: row.check_out_at ? localTime(row.check_out_at, timeZone) : null,
    status: row.status,
    source: row.source,
    accuracyM: row.accuracy_m === null ? null : Number(row.accuracy_m),
    distanceM: row.distance_m === null ? null : Number(row.distance_m),
  };
}

const noEmployee = () => forbidden("No employee record linked to your account.");

// The caller's own employee row (check-in / check-out are always "own").
async function ownEmployee(actor) {
  requireRole(actor, "hr", "employee");
  if (!actor.employeeId) throw noEmployee();
  const { data, error } = await getDb()
    .from("employees")
    .select("id, status, join_date, exit_date")
    .eq("id", actor.employeeId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw noEmployee();
  if (data.status === "exited") throw forbidden("Your employment has ended, so check-in is closed.");
  return data;
}

async function holidaysBetween(start, end) {
  const { data, error } = await getDb().from("holidays").select("date, name").gte("date", start).lte("date", end);
  if (error) throw error;
  return new Map(data.map((h) => [h.date, h.name]));
}

async function rowOn(employeeId, date) {
  const { data, error } = await getDb()
    .from("attendance")
    .select(COLUMNS)
    .eq("employee_id", employeeId)
    .eq("work_date", date)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Everything the check-in widget shows. Never throws for a missing employee record.
export async function getToday(actor) {
  requireRole(actor, "hr", "employee");
  const settings = await loadSettings();
  const now = new Date();
  const { date } = localDateTime(now, settings.timezone);
  const base = { serverNow: now.toISOString(), timezone: settings.timezone, today: date, officeStart: settings.office_start };
  if (!actor.employeeId) return { ...base, linked: false };

  const [row, holidays] = await Promise.all([rowOn(actor.employeeId, date), holidaysBetween(date, date)]);
  return {
    ...base,
    linked: true,
    record: row ? toAttendance(row, settings.timezone) : null,
    isWorkingDay: isWorkingDay(date, { weekendDays: settings.weekend_days, holidays: [...holidays.keys()] }),
    holidayName: holidays.get(date) ?? null,
  };
}

// One row per day (DB unique key). Allowed on weekends and holidays (Spec §6 Decision).
export async function checkIn(actor, { lat, lng, accuracy }) {
  const employee = await ownEmployee(actor);
  const settings = await loadSettings();
  const now = new Date();
  const { date } = localDateTime(now, settings.timezone);
  if (date < employee.join_date) throw new AppError(422, "BEFORE_JOIN_DATE", `You can check in from your join date, ${employee.join_date}.`);

  const located = lat !== undefined && lng !== undefined;
  const office = settings.office_lat !== null && settings.office_lng !== null ? { lat: settings.office_lat, lng: settings.office_lng } : null;
  const { data, error } = await getDb()
    .from("attendance")
    .insert({
      employee_id: employee.id,
      work_date: date,
      check_in_at: now.toISOString(),
      status: statusAtCheckIn(now, settings),
      source: "web",
      lat: located ? lat : null,
      lng: located ? lng : null,
      accuracy_m: located && accuracy !== undefined ? Math.round(accuracy * 100) / 100 : null,
      distance_m: located && office ? Math.round(haversineMeters({ lat, lng }, office) * 100) / 100 : null,
    })
    .select(COLUMNS)
    .single();
  if (error?.code === "23505") throw conflict("You've already checked in today.");
  if (error) throw error;
  return toAttendance(data, settings.timezone);
}

export async function checkOut(actor) {
  const employee = await ownEmployee(actor);
  const settings = await loadSettings();
  const now = new Date();
  const { date } = localDateTime(now, settings.timezone);

  const row = await rowOn(employee.id, date);
  if (!row) {
    throw new AppError(422, "NOT_CHECKED_IN",
      "You haven't checked in today. If you forgot to check out yesterday, request a correction from My Attendance.");
  }
  if (row.check_out_at) throw conflict("You've already checked out today.");

  const status = statusAtCheckOut(row.status, new Date(row.check_in_at), now, settings);
  const { data, error } = await getDb()
    .from("attendance")
    .update({ check_out_at: now.toISOString(), status })
    .eq("id", row.id)
    .is("check_out_at", null) // a parallel check-out loses instead of overwriting
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw conflict("You've already checked out today.");
  return toAttendance(data, settings.timezone);
}

// One entry per calendar day of `month` for one employee. Employees may only
// ask for themselves (403 before any read); Admin/HR for anyone.
export async function getCalendar(actor, { month } = {}, employeeId = actor?.employeeId) {
  requireRole(actor, "admin", "hr", "employee");
  if (actor.role === "employee") assertOwnEmployee(actor, employeeId);
  if (!employeeId) throw noEmployee();

  const [employee, settings] = await Promise.all([findEmployee(employeeId), loadSettings()]);
  const today = localDateTime(new Date(), settings.timezone).date;
  const m = month ?? today.slice(0, 7);
  const { start, end } = monthRange(m);
  const db = getDb();

  const [derived, rows, holidays, corrections] = await Promise.all([
    db.rpc("fn_attendance_days", { p_from: start, p_to: end }).eq("employee_id", employeeId),
    db.from("attendance").select(COLUMNS).eq("employee_id", employeeId).gte("work_date", start).lte("work_date", end),
    holidaysBetween(start, end),
    db
      .from("attendance_corrections")
      .select("work_date")
      .eq("employee_id", employeeId)
      .eq("status", "pending")
      .gte("work_date", start)
      .lte("work_date", end),
  ]);
  for (const r of [derived, rows, corrections]) if (r.error) throw r.error;

  const statusOn = new Map(derived.data.map((d) => [d.work_date, d.effective_status]));
  const rowOnDay = new Map(rows.data.map((r) => [r.work_date, toAttendance(r, settings.timezone)]));
  const pending = new Set(corrections.data.map((c) => c.work_date));
  const holidayDates = [...holidays.keys()];

  const days = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const record = rowOnDay.get(d) ?? null;
    days.push({
      date: d,
      status: statusOn.get(d) ?? null,
      checkIn: record?.checkIn ?? null,
      checkOut: record?.checkOut ?? null,
      source: record?.source ?? null,
      isWorkingDay: isWorkingDay(d, { weekendDays: settings.weekend_days, holidays: holidayDates }),
      holidayName: holidays.get(d) ?? null,
      employed: d >= employee.join_date && (!employee.exit_date || d <= employee.exit_date),
      isFuture: d > today,
      pendingCorrection: pending.has(d),
    });
  }

  const counts = Object.fromEntries(ATTENDANCE_STATUSES.map((s) => [s, 0]));
  for (const day of days) if (day.status) counts[day.status] += 1;

  return {
    month: m,
    prevMonth: shiftMonth(m, -1),
    nextMonth: shiftMonth(m, 1),
    today,
    timezone: settings.timezone,
    weekendDays: settings.weekend_days,
    employee: { id: employee.id, fullName: employee.full_name, employeeCode: employee.employee_code, joinDate: employee.join_date },
    days,
    counts,
  };
}

// Admin/HR: every employee employed on `date` with that day's effective status.
// Nothing recorded yet -> not_in_yet (a working day) or off_day (weekend/holiday).
export async function dailyBoard(actor, { date, department, status, q } = {}) {
  requireRole(actor, "admin", "hr");
  const settings = await loadSettings();
  const today = localDateTime(new Date(), settings.timezone).date;
  const day = date ?? today;
  if (day > today) throw new AppError(422, "FUTURE_DATE", "Pick today or an earlier date.");
  const db = getDb();

  let employeeQuery = db
    .from("employees")
    .select("id, employee_code, full_name, department_id, department:departments(name), designation:designations(title)")
    .lte("join_date", day)
    .or(`exit_date.is.null,exit_date.gte.${day}`)
    .order("full_name");
  if (department) employeeQuery = employeeQuery.eq("department_id", department);

  const [employees, derived, rows, holidays] = await Promise.all([
    employeeQuery,
    db.rpc("fn_attendance_days", { p_from: day, p_to: day, p_dept: department ?? null }),
    db.from("attendance").select(COLUMNS).eq("work_date", day),
    holidaysBetween(day, day),
  ]);
  for (const r of [employees, derived, rows]) if (r.error) throw r.error;

  const working = isWorkingDay(day, { weekendDays: settings.weekend_days, holidays: [...holidays.keys()] });
  const statusOf = new Map(derived.data.map((d) => [d.employee_id, d.effective_status]));
  const recordOf = new Map(rows.data.map((r) => [r.employee_id, toAttendance(r, settings.timezone)]));
  const term = q ? searchTerm(q).toLowerCase() : "";

  const all = employees.data
    .filter((e) => !term || e.full_name.toLowerCase().includes(term) || e.employee_code.toLowerCase().includes(term))
    .map((e) => {
      const record = recordOf.get(e.id) ?? null;
      return {
        employeeId: e.id,
        employeeCode: e.employee_code,
        fullName: e.full_name,
        departmentName: e.department?.name ?? null,
        designationTitle: e.designation?.title ?? null,
        status: statusOf.get(e.id) ?? (working ? "not_in_yet" : "off_day"),
        checkIn: record?.checkIn ?? null,
        checkOut: record?.checkOut ?? null,
        workedMinutes: record?.checkOutAt ? Math.round((new Date(record.checkOutAt) - new Date(record.checkInAt)) / 60000) : null,
        source: record?.source ?? null,
        distanceM: record?.distanceM ?? null,
      };
    });

  const counts = {};
  for (const row of all) counts[row.status] = (counts[row.status] ?? 0) + 1;

  return {
    date: day,
    today,
    isWorkingDay: working,
    holidayName: holidays.get(day) ?? null,
    total: all.length,
    counts,
    rows: status ? all.filter((r) => r.status === status) : all,
  };
}
