import "server-only";
import Papa from "papaparse";
import { getDb } from "@/server/db";
import { AppError } from "@/server/errors";
import { audit } from "@/server/audit";
import { requireRole } from "@/server/auth/guard";
import { companyToday } from "@/server/companyToday";
import { registerEmployeeSchema } from "@/lib/validation/employees";
import { CSV_COLUMNS, MAX_ROWS, REQUIRED_COLUMNS } from "@/lib/validation/employeeCsv";
import { createEmployees } from "./employees";
import { EMPLOYEE_SELECT } from "./employeeQuery";
import { allCurrentSalaries } from "./salary";

// CSV import (dry run first) and export. Spec §4 row 08: HR only.

export { MAX_BYTES } from "@/lib/validation/employeeCsv";

const COLUMN_OF = {
  fullName: "full_name",
  email: "email",
  phone: "phone",
  address: "address",
  gender: "gender",
  dateOfBirth: "date_of_birth",
  joinDate: "join_date",
  status: "status",
  basic: "basic_salary",
};
const DATE_COLUMNS = new Set(["date_of_birth", "join_date"]);
// Stands in for the department id while zod checks the other fields; an
// unknown department name is reported separately.
const ANY_DEPARTMENT = "00000000-0000-4000-8000-000000000000";

// Spreadsheet apps run cells starting with = + - @ as formulas. Export prefixes
// them with ' and import strips that prefix again, so files round-trip.
export const escapeCell = (value) => {
  const s = value === null || value === undefined ? "" : String(value);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
};
const unescapeCell = (s) => s.replace(/^'(?=[=+\-@\t\r])/, "");

// Rows keep their spreadsheet line number (header = 1) so errors point at the right line.
export function parseCsv(text) {
  const result = Papa.parse(text, {
    header: true,
    delimiter: ",",
    skipEmptyLines: false,
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  const errors = result.errors
    .filter((e) => e.code === "TooManyFields")
    .map((e) => ({ row: e.row + 2, field: null, reason: "This row has more values than the header" }));
  const rows = result.data
    .map((raw, i) => ({
      line: i + 2,
      values: Object.fromEntries(
        Object.entries(raw)
          .filter(([key]) => key !== "__parsed_extra")
          .map(([key, value]) => [key, unescapeCell(String(value ?? "").trim())])
      ),
    }))
    .filter((r) => Object.values(r.values).some(Boolean));
  return { fields: (result.meta.fields ?? []).filter(Boolean), rows, errors };
}

function reasonFor(column, message) {
  if (DATE_COLUMNS.has(column) && message === "Use a valid date") return "Use a date like 2026-10-24 (YYYY-MM-DD)";
  return message;
}

// Pure: parsed CSV + current database lookups -> { errors: [{row, field, reason}], valid }.
// lookups: { departments: [{id, name}], designations: [{id, title, department_id}],
//            employees: [{email, employee_code}], logins: [{id, email, role, employee_id}] }
export function validateImportRows(parsed, lookups) {
  const errors = [...parsed.errors];
  const unknown = parsed.fields.filter((f) => !CSV_COLUMNS.includes(f));
  const missing = REQUIRED_COLUMNS.filter((c) => !parsed.fields.includes(c));
  for (const f of unknown) errors.push({ row: 1, field: f, reason: `Unknown column. Columns are: ${CSV_COLUMNS.join(", ")}` });
  for (const c of missing) errors.push({ row: 1, field: c, reason: "Required column is missing" });
  if (unknown.length || missing.length) return { errors, valid: [] };

  const lower = (s) => s.toLowerCase();
  const deptByName = new Map(lookups.departments.map((d) => [lower(d.name), d]));
  const employeeByEmail = new Map(lookups.employees.map((e) => [lower(e.email), e.employee_code]));
  const takenCodes = new Set(lookups.employees.map((e) => e.employee_code.toUpperCase()));
  const loginByEmail = new Map(lookups.logins.map((l) => [lower(l.email), l]));
  const emailRow = new Map();
  const codeRow = new Map();
  const valid = [];

  for (const { line, values: v } of parsed.rows) {
    const rowErrors = [];
    const add = (field, reason) => {
      if (!rowErrors.some((e) => e.field === field)) rowErrors.push({ row: line, field, reason });
    };

    for (const c of REQUIRED_COLUMNS) if (!v[c]) add(c, "Required");

    const dept = v.department ? deptByName.get(lower(v.department)) : null;
    if (v.department && !dept) add("department", `Unknown department "${v.department}"`);

    let designationId = null;
    if (v.designation && dept) {
      const matches = lookups.designations.filter(
        (d) => lower(d.title) === lower(v.designation) && (d.department_id === dept.id || d.department_id === null)
      );
      const pick = matches.find((d) => d.department_id === dept.id) ?? matches[0];
      if (pick) designationId = pick.id;
      else add("designation", `No designation "${v.designation}" in ${dept.name}`);
    }

    let basic;
    if (v.basic_salary) {
      basic = Number(v.basic_salary.replace(/,/g, ""));
      if (!Number.isFinite(basic)) add("basic_salary", "Use a number like 50000");
    }

    const email = v.email ? lower(v.email) : "";
    let login = { link: false };
    if (email) {
      if (emailRow.has(email)) add("email", `Same email as row ${emailRow.get(email)}`);
      else {
        emailRow.set(email, line);
        const existing = loginByEmail.get(email);
        if (employeeByEmail.has(email)) add("email", `Already used by ${employeeByEmail.get(email)}`);
        else if (existing && existing.role !== "employee" && !existing.employee_id) login = { link: true, userId: existing.id };
        else if (existing) add("email", "A login with this email already exists");
      }
    }

    let employeeCode = null;
    if (v.employee_code) {
      employeeCode = v.employee_code.toUpperCase();
      if (!/^EMP-\d{4,}$/.test(employeeCode)) add("employee_code", "Use EMP- and at least 4 digits, like EMP-0042");
      else if (codeRow.has(employeeCode)) add("employee_code", `Same code as row ${codeRow.get(employeeCode)}`);
      else if (takenCodes.has(employeeCode)) add("employee_code", "Already used by another employee");
      if (!codeRow.has(employeeCode)) codeRow.set(employeeCode, line);
    }

    const candidate = registerEmployeeSchema.safeParse({
      fullName: v.full_name ?? "",
      email: v.email ?? "",
      phone: v.phone || null,
      address: v.address || null,
      gender: v.gender ? lower(v.gender) : null,
      dateOfBirth: v.date_of_birth || null,
      departmentId: dept?.id ?? ANY_DEPARTMENT,
      designationId,
      joinDate: v.join_date ?? "",
      status: v.status ? lower(v.status) : undefined,
      basic: Number.isFinite(basic) ? basic : undefined,
    });
    if (!candidate.success) {
      for (const issue of candidate.error.issues) {
        const column = COLUMN_OF[issue.path[0]];
        if (column) add(column, reasonFor(column, issue.message));
      }
    }

    rowErrors.sort((a, b) => CSV_COLUMNS.indexOf(a.field) - CSV_COLUMNS.indexOf(b.field));
    errors.push(...rowErrors);
    if (rowErrors.length === 0) valid.push({ line, input: candidate.data, employeeCode, login });
  }

  errors.sort((a, b) => a.row - b.row);
  return { errors, valid };
}

async function loadLookups() {
  const db = getDb();
  const [departments, designations, employees, logins] = await Promise.all([
    db.from("departments").select("id, name"),
    db.from("designations").select("id, title, department_id"),
    db.from("employees").select("email, employee_code"),
    db.from("app_users").select("id, email, role, employee_id"),
  ]);
  for (const r of [departments, designations, employees, logins]) if (r.error) throw r.error;
  return { departments: departments.data, designations: designations.data, employees: employees.data, logins: logins.data };
}

// dryRun: report only. Otherwise creates every row, or nothing when any row has a problem.
export async function importEmployees(actor, text, { dryRun }) {
  requireRole(actor, "hr");
  const parsed = parseCsv(text);
  if (parsed.rows.length === 0) throw new AppError(422, "CSV_EMPTY", "The file has no employee rows under the header.");
  if (parsed.rows.length > MAX_ROWS) {
    throw new AppError(422, "CSV_TOO_LARGE", `Import up to ${MAX_ROWS} employees at a time; this file has ${parsed.rows.length}.`);
  }

  const { errors, valid } = validateImportRows(parsed, await loadLookups());
  const summary = {
    totalRows: parsed.rows.length,
    validRows: valid.length,
    linkedRows: valid.filter((r) => r.login.link).length,
    errors,
  };
  if (dryRun) return { dryRun: true, ...summary };
  if (errors.length) {
    throw new AppError(422, "CSV_INVALID",
      `${errors.length} problem${errors.length === 1 ? "" : "s"} found. Nothing was imported; fix the file and run the dry run again.`,
      { errors });
  }

  const created = await createEmployees(actor, valid);
  const linked = created.filter((c) => c.linked).length;
  await audit(actor, "import", "employees", null, null, {
    created: created.length,
    linked_existing_logins: linked,
    employee_codes: created.map((c) => c.employee_code),
  });

  const credentialsCsv = Papa.unparse({
    fields: ["employee_code", "full_name", "email", "temp_password"],
    data: created.map((c, i) => [
      c.employee_code,
      escapeCell(valid[i].input.fullName),
      c.email,
      c.tempPassword ?? "(uses their existing login)",
    ]),
  });
  return { dryRun: false, created: created.length, linked, credentialsCsv };
}

export async function exportEmployeesCsv(actor) {
  requireRole(actor, "hr");
  const [employees, today] = await Promise.all([
    getDb().from("employees").select(EMPLOYEE_SELECT).order("employee_code"),
    companyToday(),
  ]);
  if (employees.error) throw employees.error;
  const salaries = await allCurrentSalaries(today);

  const csv = Papa.unparse({
    fields: [...CSV_COLUMNS, "exit_date"],
    data: employees.data.map((e) =>
      [
        e.employee_code,
        e.full_name,
        e.email,
        e.phone,
        e.address,
        e.gender,
        e.date_of_birth,
        e.department?.name,
        e.designation?.title,
        e.join_date,
        e.status,
        salaries.get(e.id)?.current?.basic,
        e.exit_date,
      ].map(escapeCell)
    ),
  });
  return { filename: `employees-${today}.csv`, csv };
}
