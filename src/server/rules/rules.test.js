import { describe, expect, test } from "vitest";
import * as tax from "./tax";
import * as payroll from "./payroll";
import * as workingDays from "./workingDays";
import * as attendanceStatus from "./attendanceStatus";
import * as leaveDays from "./leaveDays";
import * as geo from "./geo";

const modules = {
  tax: [tax, ["annualTax", "monthlyTax"]],
  payroll: [payroll, ["salaryBreakdown", "computePayslip"]],
  workingDays: [workingDays, ["isWorkingDay", "countWorkingDays"]],
  attendanceStatus: [attendanceStatus, ["statusAtCheckIn", "statusAtCheckOut"]],
  leaveDays: [leaveDays, ["countLeaveDays"]],
  geo: [geo, ["haversineMeters", "isWithinRadius"]],
};

describe("rules smoke test", () => {
  for (const [name, [mod, exports]] of Object.entries(modules)) {
    test(`${name} exports ${exports.join(", ")}`, () => {
      for (const fn of exports) expect(typeof mod[fn]).toBe("function");
    });
  }
});
