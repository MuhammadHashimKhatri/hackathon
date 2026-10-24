import "server-only";
import { z } from "zod";
import { getDb } from "@/server/db";
import { AppError, conflict, forbidden, notFound } from "@/server/errors";
import { audit } from "@/server/audit";
import { notify } from "@/server/notify";
import { requireRole } from "@/server/auth/guard";
import { computePayslip } from "@/server/rules/payroll";
import { formatMonth } from "@/lib/format";
import { currentSalariesOf } from "./salary";
import { loadSettings } from "./settings";

// Payroll Lite (Spec §4 rows 14–17, §6 Payroll). HR creates and regenerates the
// monthly draft; Admin finalizes, which locks it (also enforced by DB triggers).

const RUN_COLUMNS = "id, month, status, total_gross, total_net, created_at, finalized_at";
const SLIP_COLUMNS =
  "id, run_id, employee_id, working_days, eligible_days, absent_days, unpaid_leave_days, half_days, late_count, " +
  "basic, hra, medical, gross, prorated_gross, per_day, deduction, monthly_tax, net, " +
  "employee:employees(full_name, employee_code, user_id, department:departments(name), designation:designations(title)), " +
  "run:payroll_runs!inner(id, month, status)";

const num = (v) => (v === null || v === undefined ? null : Number(v));
const monthEnd = (first) => {
  const d = new Date(`${first}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
};

function toRun(row) {
  return {
    id: row.id,
    month: row.month,
    status: row.status,
    totalGross: num(row.total_gross),
    totalNet: num(row.total_net),
    createdAt: row.created_at,
    finalizedAt: row.finalized_at,
  };
}

export function toPayslip(row) {
  return {
    id: row.id,
    runId: row.run_id,
    month: row.run?.month ?? null,
    runStatus: row.run?.status ?? null,
    employeeId: row.employee_id,
    employeeName: row.employee?.full_name ?? null,
    employeeCode: row.employee?.employee_code ?? null,
    departmentName: row.employee?.department?.name ?? null,
    designationTitle: row.employee?.designation?.title ?? null,
    workingDays: row.working_days,
    eligibleDays: row.eligible_days,
    absentDays: num(row.absent_days),
    unpaidLeaveDays: num(row.unpaid_leave_days),
    halfDays: row.half_days,
    lateCount: row.late_count,
    basic: num(row.basic),
    hra: num(row.hra),
    medical: num(row.medical),
    gross: num(row.gross),
    proratedGross: num(row.prorated_gross),
    perDay: num(row.per_day),
    deduction: num(row.deduction),
    monthlyTax: num(row.monthly_tax),
    net: num(row.net),
  };
}

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

async function runByMonth(first) {
  const { data, error } = await getDb().from("payroll_runs").select(RUN_COLUMNS).eq("month", first).maybeSingle();
  if (error) throw error;
  return data;
}

async function runById(id) {
  if (!z.uuid().safeParse(id).success) return null;
  const { data, error } = await getDb().from("payroll_runs").select(RUN_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

async function slipsOf(runId) {
  const { data, error } = await getDb().from("payslips").select(SLIP_COLUMNS).eq("run_id", runId);
  if (error) throw error;
  return data.map(toPayslip).sort((a, b) => (a.employeeName ?? "").localeCompare(b.employeeName ?? ""));
}

const lockedError = () =>
  new AppError(422, "PAYROLL_FINALIZED", "This month's payroll is finalized and locked. It can't be changed.");

// HR: build (or rebuild) the draft for a month from attendance, leave and salaries.
export async function generateDraft(actor, month) {
  requireRole(actor, "hr");
  if (!monthSchema.safeParse(month).success) {
    throw new AppError(422, "INVALID_MONTH", "Use a month like 2026-10", { fieldErrors: { month: ["Use a month like 2026-10"] } });
  }
  const first = `${month}-01`;
  const db = getDb();
  const [existing, settings] = await Promise.all([runByMonth(first), loadSettings()]);
  if (existing?.status === "finalized") throw lockedError();

  const { data: counts, error: countError } = await db.rpc("fn_payroll_counts", { p_month: first });
  if (countError) throw countError;
  const salaries = await currentSalariesOf(counts.map((c) => c.employee_id), monthEnd(first));

  const skipped = [];
  const rows = [];
  for (const c of counts) {
    const salary = salaries.get(c.employee_id)?.current;
    if (!salary) {
      skipped.push(c.employee_id);
      continue;
    }
    const p = computePayslip({
      basic: salary.basic,
      workingDays: c.working_days,
      eligibleDays: c.eligible_days,
      absent: c.absent_days,
      unpaid: c.unpaid_days,
      halfDays: c.half_days,
      lates: c.late_count,
      latePenaltyEnabled: settings.late_penalty_enabled,
    });
    rows.push({
      employee_id: c.employee_id,
      working_days: c.working_days,
      eligible_days: c.eligible_days,
      absent_days: c.absent_days,
      unpaid_leave_days: c.unpaid_days,
      half_days: c.half_days,
      late_count: c.late_count,
      basic: p.basic,
      hra: p.hra,
      medical: p.medical,
      gross: p.gross,
      prorated_gross: p.proratedGross,
      per_day: p.perDay,
      deduction: p.deduction,
      monthly_tax: p.monthlyTax,
      net: p.net,
    });
  }
  const totalGross = Math.round(rows.reduce((s, r) => s + r.prorated_gross, 0) * 100) / 100;
  const totalNet = Math.round(rows.reduce((s, r) => s + r.net, 0) * 100) / 100;

  let run = existing;
  if (!run) {
    const { data, error } = await db
      .from("payroll_runs")
      .insert({ month: first, status: "draft", created_by: actor.userId })
      .select(RUN_COLUMNS)
      .single();
    if (error?.code === "23505") throw conflict("Someone else is generating this month right now. Try again.");
    if (error) throw error;
    run = data;
  }

  const finalizedByTrigger = (error) => error?.code === "P0001" && /payroll_finalized/.test(error.message ?? "");
  const { error: deleteError } = await db.from("payslips").delete().eq("run_id", run.id);
  if (finalizedByTrigger(deleteError)) throw lockedError();
  if (deleteError) throw deleteError;
  if (rows.length > 0) {
    const { error: insertError } = await db.from("payslips").insert(rows.map((r) => ({ ...r, run_id: run.id })));
    if (finalizedByTrigger(insertError)) throw lockedError();
    if (insertError) throw insertError;
  }
  const { data: updated, error: updateError } = await db
    .from("payroll_runs")
    .update({ total_gross: totalGross, total_net: totalNet })
    .eq("id", run.id)
    .select(RUN_COLUMNS)
    .single();
  if (finalizedByTrigger(updateError)) throw lockedError();
  if (updateError) throw updateError;

  await audit(
    actor,
    existing ? "update" : "create",
    "payroll_runs",
    run.id,
    existing ? { total_gross: num(existing.total_gross), total_net: num(existing.total_net) } : null,
    { month: first, employees: rows.length, total_gross: totalGross, total_net: totalNet, skipped_without_salary: skipped.length }
  );
  return { run: toRun(updated), payslips: await slipsOf(run.id), skipped: skipped.length };
}

export async function listRuns(actor) {
  requireRole(actor, "admin", "hr");
  const { data, error } = await getDb().from("payroll_runs").select(RUN_COLUMNS).order("month", { ascending: false }).limit(24);
  if (error) throw error;
  return data.map(toRun);
}

// A month's run with its payslips; null when the month has no run yet.
export async function getRunForMonth(actor, month) {
  requireRole(actor, "admin", "hr");
  if (!monthSchema.safeParse(month).success) return null;
  const run = await runByMonth(`${month}-01`);
  if (!run) return null;
  return { run: toRun(run), payslips: await slipsOf(run.id) };
}

export async function getRun(actor, id) {
  requireRole(actor, "admin", "hr");
  const run = await runById(id);
  if (!run) throw notFound("Payroll run not found.");
  return { run: toRun(run), payslips: await slipsOf(run.id) };
}

// Admin only: draft → finalized. Locked from then on; every employee is told.
export async function finalizeRun(actor, id) {
  requireRole(actor, "admin");
  const run = await runById(id);
  if (!run) throw notFound("Payroll run not found.");
  if (run.status === "finalized") throw conflict("This payroll is already finalized.");
  const slips = await slipsOf(run.id);
  if (slips.length === 0) throw new AppError(422, "EMPTY_RUN", "This draft has no payslips. Ask HR to generate it first.");

  const finalizedAt = new Date().toISOString();
  const { data, error } = await getDb()
    .from("payroll_runs")
    .update({ status: "finalized", finalized_by: actor.userId, finalized_at: finalizedAt })
    .eq("id", run.id)
    .eq("status", "draft")
    .select(RUN_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw conflict("This payroll is already finalized.");

  await audit(actor, "finalize", "payroll_runs", run.id, { status: "draft" }, {
    status: "finalized",
    employees: slips.length,
    total_gross: num(run.total_gross),
    total_net: num(run.total_net),
  });

  const { data: users, error: userError } = await getDb()
    .from("employees")
    .select("id, user_id")
    .in("id", slips.map((s) => s.employeeId));
  if (userError) throw userError;
  const label = formatMonth(run.month);
  await Promise.all(
    users.filter((u) => u.user_id).map((u) => notify(u.user_id, "payslip", `Your payslip for ${label} is ready`, null, "/payslips"))
  );
  return { run: toRun(data), payslips: slips };
}

// Admin/HR: every payslip (draft and finalized). Employee: own, finalized only.
export async function listPayslips(actor) {
  requireRole(actor, "admin", "hr", "employee");
  let query = getDb().from("payslips").select(SLIP_COLUMNS);
  if (actor.role === "employee") {
    if (!actor.employeeId) return [];
    query = query.eq("employee_id", actor.employeeId).eq("run.status", "finalized");
  }
  const { data, error } = await query.limit(500);
  if (error) throw error;
  return data
    .map(toPayslip)
    .sort((a, b) => (b.month ?? "").localeCompare(a.month ?? "") || (a.employeeName ?? "").localeCompare(b.employeeName ?? ""));
}

export async function getPayslip(actor, id) {
  requireRole(actor, "admin", "hr", "employee");
  if (!z.uuid().safeParse(id).success) throw notFound("Payslip not found.");
  const { data, error } = await getDb().from("payslips").select(SLIP_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw notFound("Payslip not found.");
  if (actor.role === "employee") {
    if (data.employee_id !== actor.employeeId) throw forbidden("You can only download your own payslips.");
    if (data.run?.status !== "finalized") throw notFound("Payslip not found.");
  }
  return toPayslip(data);
}
