import "server-only";
import { getDb } from "@/server/db";
import { AppError } from "@/server/errors";
import { audit } from "@/server/audit";
import { requireRole } from "@/server/auth/guard";
import { companyToday } from "@/server/companyToday";
import { findEmployee, queryEmployees, toEmployee } from "./employeeQuery";

// Salary structures (Spec §4 row 14: HR manages, Admin views; §5).
// hra, medical and gross are generated columns: the app only ever writes basic.

const SALARY_COLUMNS = "id, employee_id, basic, hra, medical, gross, effective_from, created_at";

export function toSalary(row) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    basic: Number(row.basic),
    hra: Number(row.hra),
    medical: Number(row.medical),
    gross: Number(row.gross),
    effectiveFrom: row.effective_from,
    createdAt: row.created_at,
  };
}

// rows sorted by effective_from desc. Current = latest effective on or before today;
// scheduled = a later row that hasn't started yet.
export function pickCurrent(rows, today) {
  const current = rows.find((r) => r.effectiveFrom <= today) ?? null;
  const scheduled = rows.find((r) => r.effectiveFrom > today && (!current || r.effectiveFrom > current.effectiveFrom));
  return { current, scheduled: scheduled ?? null };
}

// employeeIds null = every employee (CSV export; avoids a huge in() list in the URL).
async function salaryRows(employeeIds) {
  if (employeeIds?.length === 0) return [];
  let query = getDb().from("salary_structures").select(SALARY_COLUMNS).order("effective_from", { ascending: false });
  if (employeeIds) query = query.in("employee_id", employeeIds);
  const { data, error } = await query;
  if (error) throw error;
  return data.map(toSalary);
}

function currentByEmployee(rows, employeeIds, today) {
  return new Map(employeeIds.map((id) => [id, pickCurrent(rows.filter((r) => r.employeeId === id), today)]));
}

// For callers that already checked scope (Employee 360, CSV export).
export async function salaryHistoryOf(employeeId) {
  return salaryRows([employeeId]);
}

export async function currentSalariesOf(employeeIds, today) {
  return currentByEmployee(await salaryRows(employeeIds), employeeIds, today);
}

export async function allCurrentSalaries(today) {
  const rows = await salaryRows(null);
  return currentByEmployee(rows, [...new Set(rows.map((r) => r.employeeId))], today);
}

export async function getSalaryHistory(actor, employeeId) {
  requireRole(actor, "admin", "hr");
  await findEmployee(employeeId);
  return salaryHistoryOf(employeeId);
}

// Salary page: the directory query plus each employee's current structure.
export async function listCurrentSalaries(actor, query) {
  requireRole(actor, "admin", "hr");
  const [result, today] = await Promise.all([queryEmployees(query), companyToday()]);
  const salaries = await currentSalariesOf(result.rows.map((r) => r.id), today);
  return {
    ...result,
    today,
    rows: result.rows.map((r) => ({ ...toEmployee(r), ...salaries.get(r.id) })),
  };
}

// Same effective_from again replaces that row (unique per employee + date).
export async function setSalary(actor, employeeId, { basic, effectiveFrom }) {
  requireRole(actor, "hr");
  if (actor.employeeId && actor.employeeId === employeeId) {
    throw new AppError(422, "SELF_ACTION", "You can't change your own salary. Ask another HR user.");
  }
  const employee = await findEmployee(employeeId);
  if (effectiveFrom < employee.join_date) {
    throw new AppError(422, "BEFORE_JOIN_DATE", "The salary can't start before the employee's join date.", {
      fieldErrors: { effectiveFrom: [`Use ${employee.join_date} or later`] },
    });
  }
  if (employee.exit_date && effectiveFrom > employee.exit_date) {
    throw new AppError(422, "AFTER_EXIT_DATE", "The salary can't start after the employee's exit date.", {
      fieldErrors: { effectiveFrom: [`Use ${employee.exit_date} or earlier`] },
    });
  }

  const db = getDb();
  const { data: existing, error: findError } = await db
    .from("salary_structures")
    .select("basic")
    .eq("employee_id", employeeId)
    .eq("effective_from", effectiveFrom)
    .maybeSingle();
  if (findError) throw findError;

  const { data, error } = await db
    .from("salary_structures")
    .upsert(
      { employee_id: employeeId, basic, effective_from: effectiveFrom, created_by: actor.userId },
      { onConflict: "employee_id,effective_from" }
    )
    .select(SALARY_COLUMNS)
    .single();
  if (error) throw error;

  const salary = toSalary(data);
  await audit(actor, existing ? "update" : "create", "salary_structures", salary.id,
    existing ? { basic: Number(existing.basic), effective_from: effectiveFrom } : null,
    { employee_id: employeeId, basic: salary.basic, gross: salary.gross, effective_from: effectiveFrom });
  return salary;
}
