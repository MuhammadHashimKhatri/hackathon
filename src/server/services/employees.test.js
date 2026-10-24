import { beforeEach, describe, expect, test, vi } from "vitest";
import { fakeDb } from "../../../test/fakeDb";

let db;
vi.mock("@/server/db", () => ({ getDb: () => db }));
const { audit, authAdmin } = vi.hoisted(() => ({
  audit: vi.fn(async () => {}),
  authAdmin: {
    createAuthUser: vi.fn(async () => ({ id: "auth-new" })),
    deleteAuthUser: vi.fn(async () => {}),
    setAuthBanned: vi.fn(async () => {}),
  },
}));
vi.mock("@/server/audit", () => ({ audit }));
vi.mock("@/server/auth/authAdmin", () => authAdmin);

const { exitEmployee, getEmployee360, registerEmployee, updateEmployee } = await import("./employees");
const { setSalary } = await import("./salary");

const DEPT = "44444444-4444-4444-8444-444444444444";
const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

const hr = { userId: "u-hr", role: "hr", employeeId: null };
const admin = { userId: "u-admin", role: "admin", employeeId: null };
const employee = { userId: "u-emp", role: "employee", employeeId: ME };

// fakeDb + rpc(): an rpc call is recorded as table "rpc:<name>".
function withRpc(respond) {
  const base = fakeDb(respond);
  return { ...base, rpc: (name) => base.from(`rpc:${name}`) };
}

const employeeRow = (id, extra = {}) => ({
  id,
  employee_code: "EMP-0001",
  user_id: "u-emp",
  full_name: "Ayesha Khan",
  email: "ayesha@acme.test",
  department_id: DEPT,
  designation_id: null,
  join_date: "2026-01-05",
  exit_date: null,
  status: "active",
  department: { id: DEPT, name: "Engineering" },
  ...extra,
});

// A database that never answers: proves a guard rejected before any read.
const untouchable = () => {
  db = withRpc(() => {
    throw new Error("database touched before the scope check");
  });
};

beforeEach(() => {
  audit.mockClear();
  Object.values(authAdmin).forEach((fn) => fn.mockClear());
});

describe("registerEmployee", () => {
  const input = { fullName: "Ayesha Khan", email: "ayesha@acme.test", departmentId: DEPT, joinDate: "2026-01-05", basic: 50000 };

  test("deletes the new auth user when the database step fails", async () => {
    db = withRpc((table) => {
      if (table === "departments") return { data: { id: DEPT }, error: null };
      if (table === "rpc:fn_register_employees") return { data: null, error: { code: "23505", message: "employees_email_key" } };
      return { data: null, error: null }; // no existing employee / login with that email
    });
    await expect(registerEmployee(hr, input)).rejects.toMatchObject({ status: 409 });
    expect(authAdmin.createAuthUser).toHaveBeenCalledOnce();
    expect(authAdmin.deleteAuthUser).toHaveBeenCalledWith("auth-new");
    expect(audit).not.toHaveBeenCalled();
  });

  // The lookup by id after the insert (the email-uniqueness lookup finds nothing).
  const byId = (ops) => ops.some(([op, col]) => op === "eq" && col === "id");

  test("returns the temp password once and never audits it", async () => {
    db = withRpc((table, ops) => {
      if (table === "departments") return { data: { id: DEPT }, error: null };
      if (table === "rpc:fn_register_employees") return { data: [{ id: ME, employee_code: "EMP-0001", email: input.email }], error: null };
      if (table === "employees" && byId(ops)) return { data: employeeRow(ME), error: null };
      return { data: null, error: null };
    });
    const result = await registerEmployee(hr, input);
    expect(result.tempPassword).toMatch(/^\S{14}$/);
    expect(result.linked).toBe(false);
    expect(JSON.stringify(audit.mock.calls)).not.toContain(result.tempPassword);
    expect(authAdmin.deleteAuthUser).not.toHaveBeenCalled();
  });

  test("links an existing HR login instead of creating one", async () => {
    let payload;
    db = withRpc((table, ops) => {
      if (table === "departments") return { data: { id: DEPT }, error: null };
      if (table === "app_users") return { data: { id: "u-hr2", role: "hr", employee_id: null }, error: null };
      if (table === "rpc:fn_register_employees") {
        payload = ops;
        return { data: [{ id: ME, employee_code: "EMP-0001", email: input.email }], error: null };
      }
      if (table === "employees" && byId(ops)) return { data: employeeRow(ME), error: null };
      return { data: null, error: null };
    });
    const result = await registerEmployee(hr, input);
    expect(result).toMatchObject({ tempPassword: null, linked: true });
    expect(authAdmin.createAuthUser).not.toHaveBeenCalled();
    expect(payload).toBeDefined();
  });

  test("409 when an employee login already uses the email", async () => {
    db = withRpc((table) => {
      if (table === "departments") return { data: { id: DEPT }, error: null };
      if (table === "app_users") return { data: { id: "u-x", role: "employee", employee_id: OTHER }, error: null };
      return { data: null, error: null };
    });
    await expect(registerEmployee(hr, input)).rejects.toMatchObject({ status: 409 });
    expect(authAdmin.createAuthUser).not.toHaveBeenCalled();
  });

  test("Admin and Employee get 403", async () => {
    untouchable();
    await expect(registerEmployee(admin, input)).rejects.toMatchObject({ status: 403 });
    await expect(registerEmployee(employee, input)).rejects.toMatchObject({ status: 403 });
  });
});

describe("Employee 360 scope", () => {
  test("an employee gets 403 for anyone else, before any read", async () => {
    untouchable();
    await expect(getEmployee360(employee, OTHER)).rejects.toMatchObject({ status: 403 });
  });

  test("an employee's own 360 has no salary or login details", async () => {
    db = withRpc((table) => {
      if (table === "rpc:fn_company_today") return { data: "2026-10-24", error: null };
      if (table === "employees") return { data: employeeRow(ME), error: null };
      if (table === "rpc:fn_attendance_days") {
        return { data: [{ work_date: "2026-10-01", effective_status: "present" }, { work_date: "2026-10-02", effective_status: "late" }], error: null };
      }
      return { data: [], error: null };
    });
    const view = await getEmployee360(employee, ME);
    expect(view.salary).toBeUndefined();
    expect(view.login).toBeUndefined();
    expect(view.attendance.counts).toMatchObject({ present: 1, late: 1, absent: 0 });
    expect(db.calls.some((c) => c.table === "salary_structures")).toBe(false);
    // Employees only see payslips of finalized runs.
    const payslips = db.calls.find((c) => c.table === "payslips");
    expect(payslips.ops).toContainEqual(["eq", "payroll_runs.status", "finalized"]);
  });
});

describe("updateEmployee", () => {
  test("an employee may only change their own phone and address", async () => {
    untouchable();
    await expect(updateEmployee(employee, ME, { fullName: "New" })).rejects.toMatchObject({ status: 403 });
    await expect(updateEmployee(employee, OTHER, { phone: "0300" })).rejects.toMatchObject({ status: 403 });
    await expect(updateEmployee(admin, ME, { phone: "0300" })).rejects.toMatchObject({ status: 403 });
  });

  test("audits only the fields that changed", async () => {
    db = withRpc((table, ops) => {
      if (ops.some(([op]) => op === "update")) return { error: null };
      return { data: employeeRow(ME, { phone: "111", address: "Old" }), error: null };
    });
    await updateEmployee(employee, ME, { phone: "222", address: "Old" });
    expect(audit).toHaveBeenCalledWith(employee, "update", "employees", ME, { phone: "111" }, { phone: "222" });
  });
});

describe("exit and salary guards", () => {
  test("HR can't exit or change the salary of their own record; Admin can't at all", async () => {
    untouchable();
    const hrSelf = { ...hr, employeeId: ME };
    await expect(exitEmployee(hrSelf, ME, { exitDate: "2026-10-31" })).rejects.toMatchObject({ status: 422, code: "SELF_ACTION" });
    await expect(setSalary(hrSelf, ME, { basic: 1, effectiveFrom: "2026-11-01" })).rejects.toMatchObject({ status: 422 });
    await expect(exitEmployee(admin, ME, { exitDate: "2026-10-31" })).rejects.toMatchObject({ status: 403 });
    await expect(setSalary(admin, ME, { basic: 1, effectiveFrom: "2026-11-01" })).rejects.toMatchObject({ status: 403 });
  });

  test("exit deactivates an employee login", async () => {
    db = withRpc((table, ops) => {
      if (ops.some(([op]) => op === "update")) return { error: null };
      if (table === "app_users") return { data: { id: "u-emp", role: "employee", is_active: true }, error: null };
      return { data: employeeRow(ME), error: null };
    });
    const result = await exitEmployee(hr, ME, { exitDate: "2026-10-31" });
    expect(result.loginDeactivated).toBe(true);
    expect(authAdmin.setAuthBanned).toHaveBeenCalledWith("u-emp", true);
  });

  test("salary can't start before the join date", async () => {
    db = withRpc(() => ({ data: employeeRow(ME), error: null }));
    await expect(setSalary(hr, ME, { basic: 1000, effectiveFrom: "2025-12-31" })).rejects.toMatchObject({ status: 422 });
  });
});
