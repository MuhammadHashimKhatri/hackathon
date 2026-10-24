import "server-only";
import { z } from "zod";
import { getDb } from "@/server/db";
import { notFound } from "@/server/errors";
import { PAGE_SIZE } from "@/lib/validation/employees";

// Employee reads shared by employees.js, salary.js and employeeCsv.js.
// No role checks here: every exported service checks role + scope first.

export const EMPLOYEE_SELECT =
  "id, employee_code, user_id, full_name, email, phone, address, gender, date_of_birth, " +
  "department_id, designation_id, join_date, exit_date, status, created_at, " +
  "department:departments(id, name), designation:designations(id, title)";

export function toEmployee(row) {
  return {
    id: row.id,
    employeeCode: row.employee_code,
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    gender: row.gender,
    dateOfBirth: row.date_of_birth,
    departmentId: row.department_id,
    departmentName: row.department?.name ?? null,
    designationId: row.designation_id,
    designationTitle: row.designation?.title ?? null,
    joinDate: row.join_date,
    exitDate: row.exit_date,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function assertEmployeeId(id) {
  if (!z.uuid().safeParse(id).success) throw notFound("Employee not found.");
}

export async function findEmployee(id) {
  assertEmployeeId(id);
  const { data, error } = await getDb().from("employees").select(EMPLOYEE_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw notFound("Employee not found.");
  return data;
}

// PostgREST's or() syntax treats , ( ) as separators and * as a wildcard, and
// ilike treats % _ as wildcards; none of them are useful in a name/code/email search.
export const searchTerm = (q) => q.replace(/[,()"'\\%_*:]/g, " ").trim();

const ORDER = {
  name: "full_name",
  code: "employee_code",
  join_date: "join_date",
  department: "department(name)",
};

export async function queryEmployees({ q, department, designation, status, page = 1, sort = "name", dir = "asc" } = {}) {
  const build = (head) => {
    let query = getDb().from("employees").select(EMPLOYEE_SELECT, { count: "exact", head });
    const term = q ? searchTerm(q) : "";
    if (term) query = query.or(`full_name.ilike.%${term}%,employee_code.ilike.%${term}%,email.ilike.%${term}%`);
    if (department) query = query.eq("department_id", department);
    if (designation) query = query.eq("designation_id", designation);
    if (status) query = query.eq("status", status);
    return query;
  };

  const from = (page - 1) * PAGE_SIZE;
  const ascending = dir !== "desc";
  const { data, count, error } = await build(false)
    .order(ORDER[sort] ?? ORDER.name, { ascending })
    .order("full_name", { ascending: true })
    .order("id")
    .range(from, from + PAGE_SIZE - 1);

  // A page past the end (e.g. after a filter narrowed the list): empty page, real total.
  if (error?.code === "PGRST103") {
    const head = await build(true);
    if (head.error) throw head.error;
    return { rows: [], total: head.count ?? 0, page, pageSize: PAGE_SIZE };
  }
  if (error) throw error;
  return { rows: data, total: count ?? 0, page, pageSize: PAGE_SIZE };
}
