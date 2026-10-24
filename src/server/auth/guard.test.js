import { describe, expect, test } from "vitest";
import { AppError } from "@/server/errors";
import { assertOwnEmployee, requireRole } from "./guard";

const admin = { userId: "u-admin", role: "admin", employeeId: null };
const hr = { userId: "u-hr", role: "hr", employeeId: "e-hr" };
const employee = { userId: "u-emp", role: "employee", employeeId: "e-1" };

function statusOf(fn) {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    return err.status;
  }
  return "no error";
}

describe("requireRole", () => {
  test("employee cannot pass requireRole('hr')", () => {
    expect(statusOf(() => requireRole(employee, "hr"))).toBe(403);
  });

  test("signed-out actor gets 401", () => {
    expect(statusOf(() => requireRole(null, "hr", "admin"))).toBe(401);
  });

  test("HR passes when HR is one of the allowed roles", () => {
    expect(requireRole(hr, "hr", "admin")).toBe(hr);
  });

  test("admin is not implicitly allowed everywhere", () => {
    expect(statusOf(() => requireRole(admin, "employee"))).toBe(403);
  });
});

describe("assertOwnEmployee", () => {
  test("own record passes", () => {
    expect(assertOwnEmployee(employee, "e-1")).toBe(employee);
  });

  test("someone else's record is 403", () => {
    expect(statusOf(() => assertOwnEmployee(employee, "e-2"))).toBe(403);
  });

  test("no linked employee record is 403", () => {
    expect(statusOf(() => assertOwnEmployee(admin, "e-1"))).toBe(403);
  });

  test("signed out is 401", () => {
    expect(statusOf(() => assertOwnEmployee(null, "e-1"))).toBe(401);
  });
});
