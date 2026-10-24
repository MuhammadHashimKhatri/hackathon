import "server-only";
import { z } from "zod";
import { getDb } from "@/server/db";
import { AppError, conflict, forbidden, notFound } from "@/server/errors";
import { audit } from "@/server/audit";
import { notify } from "@/server/notify";
import { requireRole } from "@/server/auth/guard";
import { recomputeStatus } from "@/server/rules/attendanceStatus";
import { localDateTime, localTime, zonedToUtc } from "@/server/rules/companyTime";
import { formatDate } from "@/lib/format";
import { loadSettings } from "./settings";

// Attendance corrections (Spec §4 row 11): Employee requests, HR approves, Admin views.
// Approving rewrites that day's attendance with source = correction and the
// status recomputed by the same rules as a live check-in/check-out.

const COLUMNS =
  "id, employee_id, work_date, requested_check_in, requested_check_out, reason, status, review_comment, reviewed_at, created_at, " +
  "employee:employees(full_name, employee_code, user_id)";

const invalid = (code, message, field) =>
  new AppError(422, code, message, field ? { fieldErrors: { [field]: [message] } } : undefined);

function toCorrection(row, timeZone, current = null) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee?.full_name ?? null,
    employeeCode: row.employee?.employee_code ?? null,
    workDate: row.work_date,
    requestedCheckIn: row.requested_check_in ? localTime(row.requested_check_in, timeZone) : null,
    requestedCheckOut: row.requested_check_out ? localTime(row.requested_check_out, timeZone) : null,
    currentCheckIn: current?.check_in_at ? localTime(current.check_in_at, timeZone) : null,
    currentCheckOut: current?.check_out_at ? localTime(current.check_out_at, timeZone) : null,
    currentStatus: current?.status ?? null,
    reason: row.reason,
    status: row.status,
    reviewComment: row.review_comment,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

async function attendanceOn(employeeId, workDate) {
  const { data, error } = await getDb()
    .from("attendance")
    .select("id, check_in_at, check_out_at, status")
    .eq("employee_id", employeeId)
    .eq("work_date", workDate)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// The current attendance rows for a list of corrections, keyed "employeeId|date".
async function currentRows(corrections) {
  if (corrections.length === 0) return new Map();
  const { data, error } = await getDb()
    .from("attendance")
    .select("employee_id, work_date, check_in_at, check_out_at, status")
    .in("employee_id", [...new Set(corrections.map((c) => c.employee_id))])
    .in("work_date", [...new Set(corrections.map((c) => c.work_date))]);
  if (error) throw error;
  return new Map(data.map((r) => [`${r.employee_id}|${r.work_date}`, r]));
}

export async function requestCorrection(actor, { workDate, checkIn, checkOut, reason }) {
  requireRole(actor, "employee");
  if (!actor.employeeId) throw forbidden("No employee record linked to your account.");
  const db = getDb();
  const [{ data: employee, error }, settings] = await Promise.all([
    db.from("employees").select("id, full_name, join_date, exit_date").eq("id", actor.employeeId).maybeSingle(),
    loadSettings(),
  ]);
  if (error) throw error;
  if (!employee) throw forbidden("No employee record linked to your account.");

  const now = new Date();
  const today = localDateTime(now, settings.timezone).date;
  if (workDate > today) throw invalid("FUTURE_DATE", "You can only correct today or an earlier day.", "workDate");
  if (workDate < employee.join_date || (employee.exit_date && workDate > employee.exit_date)) {
    throw invalid("NOT_EMPLOYED", "You weren't employed on that day.", "workDate");
  }

  const existing = await attendanceOn(employee.id, workDate);
  if (!checkIn && !existing?.check_in_at) {
    throw invalid("CHECK_IN_REQUIRED", "There's no check-in on that day, so add the check-in time too.", "checkIn");
  }
  const requestedIn = checkIn ? zonedToUtc(workDate, checkIn, settings.timezone) : null;
  const requestedOut = checkOut ? zonedToUtc(workDate, checkOut, settings.timezone) : null;
  if ((requestedIn && requestedIn > now) || (requestedOut && requestedOut > now)) {
    throw invalid("FUTURE_TIME", "That time hasn't happened yet.", requestedOut > now ? "checkOut" : "checkIn");
  }
  const finalIn = requestedIn ?? new Date(existing.check_in_at);
  const finalOut = requestedOut ?? (existing?.check_out_at ? new Date(existing.check_out_at) : null);
  if (finalOut && finalOut <= finalIn) {
    throw invalid("OUT_BEFORE_IN", "Check-out must be after check-in.", "checkOut");
  }

  const { data, error: insertError } = await db
    .from("attendance_corrections")
    .insert({
      employee_id: employee.id,
      work_date: workDate,
      requested_check_in: requestedIn?.toISOString() ?? null,
      requested_check_out: requestedOut?.toISOString() ?? null,
      reason,
    })
    .select(COLUMNS)
    .single();
  if (insertError?.code === "23505") throw conflict("You already have a pending request for that day.");
  if (insertError) throw insertError;

  await audit(actor, "create", "attendance_corrections", data.id, null, {
    work_date: workDate,
    requested_check_in: checkIn ?? null,
    requested_check_out: checkOut ?? null,
  });

  const { data: hrUsers, error: hrError } = await db.from("app_users").select("id").eq("role", "hr").eq("is_active", true);
  if (hrError) throw hrError;
  await Promise.all(
    hrUsers.map((u) =>
      notify(u.id, "attendance_correction", `${employee.full_name} asked to correct ${formatDate(workDate)}`, reason, "/attendance/corrections")
    )
  );
  return toCorrection(data, settings.timezone, existing);
}

// HR and Admin: pending (oldest first) or the latest 50 decisions.
export async function listCorrections(actor, { status = "pending" } = {}) {
  requireRole(actor, "admin", "hr");
  const settings = await loadSettings();
  let query = getDb().from("attendance_corrections").select(COLUMNS);
  query =
    status === "pending"
      ? query.eq("status", "pending").order("created_at", { ascending: true })
      : query.in("status", ["approved", "rejected"]).order("reviewed_at", { ascending: false }).limit(50);
  const { data, error } = await query;
  if (error) throw error;
  const current = await currentRows(data);
  return data.map((c) => toCorrection(c, settings.timezone, current.get(`${c.employee_id}|${c.work_date}`)));
}

export async function listMyCorrections(actor) {
  requireRole(actor, "employee");
  if (!actor.employeeId) return [];
  const settings = await loadSettings();
  const { data, error } = await getDb()
    .from("attendance_corrections")
    .select(COLUMNS)
    .eq("employee_id", actor.employeeId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data.map((c) => toCorrection(c, settings.timezone));
}

export async function decideCorrection(actor, id, { decision, comment }) {
  requireRole(actor, "hr");
  if (!z.uuid().safeParse(id).success) throw notFound("Correction request not found.");
  const db = getDb();
  const [{ data: request, error }, settings] = await Promise.all([
    db.from("attendance_corrections").select(COLUMNS).eq("id", id).maybeSingle(),
    loadSettings(),
  ]);
  if (error) throw error;
  if (!request) throw notFound("Correction request not found.");
  if (request.status !== "pending") throw conflict("This request has already been decided.");

  const status = decision === "approve" ? "approved" : "rejected";
  const reviewedAt = new Date().toISOString();
  // Only a still-pending request flips, so a double click or a second HR user gets 409.
  const { data: flipped, error: flipError } = await db
    .from("attendance_corrections")
    .update({ status, reviewed_by: actor.userId, review_comment: comment || null, reviewed_at: reviewedAt })
    .eq("id", id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (flipError) throw flipError;
  if (!flipped) throw conflict("This request has already been decided.");

  let attendance = null;
  const before = await attendanceOn(request.employee_id, request.work_date);
  if (status === "approved") {
    try {
      const checkInAt = request.requested_check_in ?? before?.check_in_at;
      const checkOutAt = request.requested_check_out ?? before?.check_out_at ?? null;
      if (!checkInAt) throw invalid("CHECK_IN_REQUIRED", "This day has no check-in time to keep.");
      if (checkOutAt && new Date(checkOutAt) <= new Date(checkInAt)) {
        throw invalid("OUT_BEFORE_IN", "With this change check-out would be before check-in. Reject it and ask for a new request.");
      }
      const { data, error: upsertError } = await db
        .from("attendance")
        .upsert(
          {
            employee_id: request.employee_id,
            work_date: request.work_date,
            check_in_at: checkInAt,
            check_out_at: checkOutAt,
            status: recomputeStatus(new Date(checkInAt), checkOutAt ? new Date(checkOutAt) : null, settings),
            source: "correction",
          },
          { onConflict: "employee_id,work_date" }
        )
        .select("id, check_in_at, check_out_at, status")
        .single();
      if (upsertError) throw upsertError;
      attendance = data;
    } catch (err) {
      // Put the request back so it can be decided again.
      await db
        .from("attendance_corrections")
        .update({ status: "pending", reviewed_by: null, review_comment: null, reviewed_at: null })
        .eq("id", id)
        .then(({ error: revertError }) => revertError && console.error("correction revert failed", id, revertError));
      throw err;
    }
  }

  const pick = (r) => (r ? { check_in_at: r.check_in_at, check_out_at: r.check_out_at, status: r.status } : null);
  await audit(actor, decision, "attendance_corrections", id,
    { status: "pending", attendance: pick(before) },
    { status, comment: comment || null, attendance: pick(attendance) ?? pick(before) });

  if (request.employee?.user_id) {
    const day = formatDate(request.work_date);
    await notify(
      request.employee.user_id,
      "attendance_correction",
      status === "approved" ? `Your correction for ${day} was approved` : `Your correction for ${day} was rejected`,
      comment || null,
      "/attendance/me"
    );
  }

  return toCorrection({ ...request, status, review_comment: comment || null, reviewed_at: reviewedAt }, settings.timezone, attendance ?? before);
}
