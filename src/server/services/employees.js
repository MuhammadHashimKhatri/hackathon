import "server-only";
import { getDb } from "@/server/db";
import { AppError, conflict, forbidden } from "@/server/errors";
import { audit } from "@/server/audit";
import { assertOwnEmployee, requireRole } from "@/server/auth/guard";
import { createAuthUser, deleteAuthUser, setAuthBanned } from "@/server/auth/authAdmin";
import { generateTempPassword } from "@/server/auth/tempPassword";
import { companyToday } from "@/server/companyToday";
import { parse } from "@/server/validate";
import {
  exitEmployeeSchema,
  registerEmployeeSchema,
  SELF_EDITABLE,
  selfUpdateSchema,
  updateEmployeeSchema,
} from "@/lib/validation/employees";
import { findEmployee, queryEmployees, toEmployee } from "./employeeQuery";
import { getCalendar } from "./attendance";
import { getLeaveBalances } from "./leaveBalance";
import { pickCurrent, salaryHistoryOf } from "./salary";

// Employees (Spec §4 rows 06–07): HR registers and edits, Admin views,
// an Employee sees only their own record and edits only phone & address.

const COLUMN_OF = {
  fullName: "full_name",
  email: "email",
  phone: "phone",
  address: "address",
  gender: "gender",
  dateOfBirth: "date_of_birth",
  departmentId: "department_id",
  designationId: "designation_id",
  joinDate: "join_date",
  status: "status",
};

// Only the keys present in `input` (a partial update stays partial).
function toColumns(input) {
  return Object.fromEntries(
    Object.entries(input)
      .filter(([key]) => key in COLUMN_OF)
      .map(([key, value]) => [COLUMN_OF[key], value ?? null])
  );
}

const invalid = (code, message, fieldErrors) => new AppError(422, code, message, { fieldErrors });

// Department must exist; designation (optional) must belong to it or to no department.
export async function checkOrgRefs(departmentId, designationId) {
  const db = getDb();
  const [dept, desig] = await Promise.all([
    db.from("departments").select("id").eq("id", departmentId).maybeSingle(),
    designationId
      ? db.from("designations").select("id, department_id").eq("id", designationId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (dept.error) throw dept.error;
  if (desig.error) throw desig.error;
  if (!dept.data) throw invalid("UNKNOWN_DEPARTMENT", "That department no longer exists.", { departmentId: ["Choose a department"] });
  if (designationId && (!desig.data || (desig.data.department_id && desig.data.department_id !== departmentId))) {
    throw invalid("UNKNOWN_DESIGNATION", "Choose a designation from this department.", {
      designationId: ["Choose a designation from this department"],
    });
  }
}

// New login, or link an existing HR/Admin login that has no employee record yet.
async function loginFor(email) {
  const db = getDb();
  const [employee, user] = await Promise.all([
    db.from("employees").select("employee_code").eq("email", email).maybeSingle(),
    db.from("app_users").select("id, role, employee_id").eq("email", email).maybeSingle(),
  ]);
  if (employee.error) throw employee.error;
  if (user.error) throw user.error;
  if (employee.data) throw conflict(`${employee.data.employee_code} already uses this email.`);
  if (!user.data) return { link: false };
  if (user.data.role !== "employee" && !user.data.employee_id) return { link: true, userId: user.data.id };
  throw conflict("A login with this email already exists.");
}

function registerError(err) {
  if (err?.code === "23505") {
    const text = `${err.message} ${err.details ?? ""}`;
    if (text.includes("employee_code")) return conflict("That employee code is already taken.");
    if (text.includes("employees_email_key")) return conflict("An employee with this email already exists.");
    return conflict("A login with this email already exists.");
  }
  if (err?.code === "23503") return new AppError(422, "IN_USE", "A department or designation was removed. Reload and try again.");
  if (err?.message === "login_not_linkable") return conflict("That login already has an employee record.");
  return err;
}

// Shared by registerEmployee and the CSV import. rows: [{ input, employeeCode?, login }]
// Auth users are created first; if any later step fails, every auth user made
// here is deleted again and the database function has rolled back its rows.
export async function createEmployees(actor, rows) {
  const createdAuthIds = [];
  try {
    const payload = [];
    const passwords = [];
    for (const { input, employeeCode, login } of rows) {
      let userId = login.userId;
      let tempPassword = null;
      if (!login.link) {
        tempPassword = generateTempPassword();
        const authUser = await createAuthUser({ email: input.email, password: tempPassword });
        createdAuthIds.push(authUser.id);
        userId = authUser.id;
      }
      passwords.push(tempPassword);
      payload.push({
        ...toColumns(input),
        employee_code: employeeCode ?? null,
        user_id: userId,
        link: login.link,
        basic: input.basic,
      });
    }

    const { data, error } = await getDb().rpc("fn_register_employees", { p_rows: payload, p_actor: actor.userId });
    if (error) throw registerError(error);
    return data.map((r, i) => ({ ...r, tempPassword: passwords[i], linked: rows[i].login.link }));
  } catch (err) {
    await Promise.all(
      createdAuthIds.map((id) => deleteAuthUser(id).catch((e) => console.error("register rollback failed", id, e)))
    );
    throw err;
  }
}

export async function registerEmployee(actor, input) {
  requireRole(actor, "hr");
  const data = parse(registerEmployeeSchema, input);
  await checkOrgRefs(data.departmentId, data.designationId ?? null);
  const login = await loginFor(data.email);

  const [created] = await createEmployees(actor, [{ input: data, login }]);
  const employee = toEmployee(await findEmployee(created.id));
  await audit(actor, "create", "employees", employee.id, null, {
    employee_code: employee.employeeCode,
    full_name: employee.fullName,
    email: employee.email,
    department_id: employee.departmentId,
    basic: data.basic,
    linked_existing_login: created.linked,
  });
  return { employee, tempPassword: created.tempPassword, linked: created.linked };
}

export async function listEmployees(actor, query) {
  requireRole(actor, "admin", "hr");
  const result = await queryEmployees(query);
  return { ...result, rows: result.rows.map(toEmployee) };
}

const CHECK_FIELDS = {
  employees_dob_before_join: ["dateOfBirth", "Date of birth must be before the join date"],
  employees_exit_after_join: ["joinDate", "The join date must be on or before the exit date"],
};

export async function updateEmployee(actor, id, input) {
  requireRole(actor, "hr", "employee");
  const self = actor.role === "employee";
  if (self) {
    assertOwnEmployee(actor, id);
    const other = Object.keys(input ?? {}).filter((key) => !SELF_EDITABLE.includes(key));
    if (other.length) throw forbidden("You can only change your phone and address.");
  }
  const changes = parse(self ? selfUpdateSchema : updateEmployeeSchema, input);
  const before = await findEmployee(id);

  if (!self) {
    if (before.status === "exited" && "status" in changes) {
      throw invalid("EMPLOYEE_EXITED", "This employee has exited; their status can't change.", { status: ["Employee has exited"] });
    }
    if ("departmentId" in changes || "designationId" in changes) {
      const departmentId = changes.departmentId ?? before.department_id;
      const designationId = "designationId" in changes ? changes.designationId : before.designation_id;
      await checkOrgRefs(departmentId, designationId ?? null);
    }
  }

  const columns = toColumns(changes);
  const changed = Object.keys(columns).filter((c) => (before[c] ?? null) !== columns[c]);
  if (changed.length === 0) return toEmployee(before);
  const update = Object.fromEntries(changed.map((c) => [c, columns[c]]));

  const { error } = await getDb().from("employees").update(update).eq("id", id);
  if (error?.code === "23514") {
    const [field, message] = Object.entries(CHECK_FIELDS).find(([name]) => error.message.includes(name))?.[1] ?? [];
    throw invalid("INVALID_DATES", message ?? "Those dates don't fit together.", field ? { [field]: [message] } : undefined);
  }
  if (error) throw error;

  await audit(actor, "update", "employees", id,
    Object.fromEntries(changed.map((c) => [c, before[c] ?? null])), update);
  return toEmployee(await findEmployee(id));
}

// Exit: exit_date + status exited + the employee login deactivated. A linked
// HR/Admin login is left alone (Admin manages those on the Users page).
export async function exitEmployee(actor, id, input) {
  requireRole(actor, "hr");
  const { exitDate } = parse(exitEmployeeSchema, input);
  if (actor.employeeId && actor.employeeId === id) {
    throw new AppError(422, "SELF_ACTION", "You can't exit your own employee record. Ask another HR user.");
  }
  const before = await findEmployee(id);
  if (before.status === "exited") throw new AppError(422, "EMPLOYEE_EXITED", "This employee has already exited.");
  if (exitDate < before.join_date) {
    throw invalid("BEFORE_JOIN_DATE", "The exit date can't be before the join date.", { exitDate: [`Use ${before.join_date} or later`] });
  }

  const db = getDb();
  const { error } = await db.from("employees").update({ exit_date: exitDate, status: "exited" }).eq("id", id);
  if (error) throw error;

  let loginDeactivated = false;
  if (before.user_id) {
    const { data: login, error: loginError } = await db.from("app_users").select("id, role, is_active").eq("id", before.user_id).maybeSingle();
    if (loginError) throw loginError;
    if (login?.role === "employee" && login.is_active) {
      const { error: deactivateError } = await db.from("app_users").update({ is_active: false }).eq("id", login.id);
      if (deactivateError) throw deactivateError;
      await setAuthBanned(login.id, true);
      loginDeactivated = true;
    }
  }

  await audit(actor, "exit", "employees", id,
    { status: before.status, exit_date: before.exit_date },
    { status: "exited", exit_date: exitDate, login_deactivated: loginDeactivated });
  return { employee: toEmployee(await findEmployee(id)), loginDeactivated };
}

// Everything about one employee. Salary and login details are Admin/HR only;
// an Employee may only ask for their own id (403 otherwise, before any read).
export async function getEmployee360(actor, id) {
  requireRole(actor, "admin", "hr", "employee");
  if (actor.role === "employee") assertOwnEmployee(actor, id);
  const staff = actor.role !== "employee";

  const [row, today] = await Promise.all([findEmployee(id), companyToday()]);
  const db = getDb();

  let payslipQuery = db
    .from("payslips")
    .select("id, gross, prorated_gross, deduction, monthly_tax, net, payroll_runs!inner(id, month, status)")
    .eq("employee_id", id);
  if (!staff) payslipQuery = payslipQuery.eq("payroll_runs.status", "finalized");

  const [attendance, leaveBalances, recentLeave, payslips, salaryHistory, login] = await Promise.all([
    getCalendar(actor, {}, id),
    getLeaveBalances(id, Number(today.slice(0, 4))),
    db
      .from("leave_requests")
      .select("id, start_date, end_date, days, status, reason, created_at, leave_type:leave_types(code, name)")
      .eq("employee_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    payslipQuery,
    staff ? salaryHistoryOf(id) : null,
    staff && row.user_id
      ? db.from("app_users").select("role, is_active, must_change_password").eq("id", row.user_id).maybeSingle()
      : { data: null, error: null },
  ]);
  for (const result of [recentLeave, payslips, login]) if (result.error) throw result.error;

  return {
    employee: toEmployee(row),
    today,
    attendance,
    leaveBalances,
    recentLeave: recentLeave.data.map((r) => ({
      id: r.id,
      startDate: r.start_date,
      endDate: r.end_date,
      days: Number(r.days),
      status: r.status,
      reason: r.reason,
      leaveType: r.leave_type?.name ?? null,
    })),
    payslips: payslips.data
      .map((p) => ({
        id: p.id,
        runId: p.payroll_runs.id,
        month: p.payroll_runs.month,
        runStatus: p.payroll_runs.status,
        gross: Number(p.gross),
        deduction: Number(p.deduction),
        monthlyTax: Number(p.monthly_tax),
        net: Number(p.net),
      }))
      .sort((a, b) => b.month.localeCompare(a.month))
      .slice(0, 12),
    ...(staff
      ? {
          salary: { history: salaryHistory, ...pickCurrent(salaryHistory, today) },
          login: login.data
            ? { role: login.data.role, isActive: login.data.is_active, mustChangePassword: login.data.must_change_password }
            : null,
        }
      : {}),
  };
}
