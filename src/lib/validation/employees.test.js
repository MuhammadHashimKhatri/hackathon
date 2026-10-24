import { describe, expect, test } from "vitest";
import {
  listEmployeesQuery,
  registerEmployeeSchema,
  salaryBreakdown,
  salarySchema,
  selfUpdateSchema,
  updateEmployeeSchema,
} from "./employees";

const ok = (schema, value) => schema.safeParse(value).success;
const dept = "44444444-4444-4444-8444-444444444444";

const valid = {
  fullName: "Ayesha Khan",
  email: " Ayesha@Acme.test ",
  departmentId: dept,
  joinDate: "2026-10-01",
  basic: 50000,
};

describe("registerEmployeeSchema", () => {
  test("accepts the required fields and lower-cases the email", () => {
    const result = registerEmployeeSchema.parse(valid);
    expect(result.email).toBe("ayesha@acme.test");
  });

  test("blank optional text becomes null", () => {
    expect(registerEmployeeSchema.parse({ ...valid, phone: "  ", address: "" })).toMatchObject({ phone: null, address: null });
  });

  test("rejects missing department, bad salary and unknown fields", () => {
    expect(ok(registerEmployeeSchema, { ...valid, departmentId: undefined })).toBe(false);
    expect(ok(registerEmployeeSchema, { ...valid, basic: 0 })).toBe(false);
    expect(ok(registerEmployeeSchema, { ...valid, basic: 100.123 })).toBe(false);
    expect(ok(registerEmployeeSchema, { ...valid, role: "admin" })).toBe(false);
  });

  test("date of birth must be before the join date; status can't be exited", () => {
    expect(ok(registerEmployeeSchema, { ...valid, dateOfBirth: "2026-10-01" })).toBe(false);
    expect(ok(registerEmployeeSchema, { ...valid, dateOfBirth: "1995-02-30" })).toBe(false);
    expect(ok(registerEmployeeSchema, { ...valid, dateOfBirth: "1995-02-28" })).toBe(true);
    expect(ok(registerEmployeeSchema, { ...valid, status: "exited" })).toBe(false);
  });
});

describe("update schemas", () => {
  test("HR update is partial but never changes the email", () => {
    expect(ok(updateEmployeeSchema, { phone: "+92 300 1234567" })).toBe(true);
    expect(ok(updateEmployeeSchema, { email: "x@acme.test" })).toBe(false);
    expect(ok(updateEmployeeSchema, {})).toBe(false);
  });

  test("an employee may only send phone and address", () => {
    expect(ok(selfUpdateSchema, { phone: "0300-1234567", address: "Karachi" })).toBe(true);
    expect(ok(selfUpdateSchema, { fullName: "New Name" })).toBe(false);
    expect(ok(selfUpdateSchema, { phone: "call me" })).toBe(false);
  });
});

test("salary breakdown: HRA 40%, medical 10%, gross 1.5 x basic", () => {
  expect(salaryBreakdown(50000)).toEqual({ basic: 50000, hra: 20000, medical: 5000, gross: 75000 });
  expect(ok(salarySchema, { basic: 50000, effectiveFrom: "2026-11-01" })).toBe(true);
  expect(ok(salarySchema, { basic: -1, effectiveFrom: "2026-11-01" })).toBe(false);
});

test("list query falls back to defaults on junk URL params", () => {
  expect(listEmployeesQuery.parse({ page: "abc", sort: "salary", status: "gone", department: "x" })).toEqual({
    page: 1,
    sort: "name",
    dir: "asc",
  });
  expect(listEmployeesQuery.parse({ page: "3", sort: "code", dir: "desc", status: "active" })).toMatchObject({
    page: 3,
    sort: "code",
    dir: "desc",
    status: "active",
  });
});
