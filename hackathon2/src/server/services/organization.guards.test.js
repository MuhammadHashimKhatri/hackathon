import { describe, expect, test, vi } from "vitest";

// Any database call fails the test: the role guard must reject first.
vi.mock("@/server/db", () => ({
  getDb: () => {
    throw new Error("database touched before the role check");
  },
}));
vi.mock("@/server/audit", () => ({ audit: vi.fn() }));

const settings = await import("./settings");
const organization = await import("./organization");
const leaveTypes = await import("./leaveTypes");
const holidays = await import("./holidays");

const hr = { userId: "u-hr", role: "hr" };
const employee = { userId: "u-emp", role: "employee", employeeId: "e-1" };
const id = "33333333-3333-4333-8333-333333333333";

const writes = {
  "settings.updateSettings": () => settings.updateSettings(hr, { grace_minutes: 5 }),
  "organization.createDepartment": () => organization.createDepartment(hr, { name: "X" }),
  "organization.renameDepartment": () => organization.renameDepartment(hr, id, { name: "X" }),
  "organization.deleteDepartment": () => organization.deleteDepartment(hr, id),
  "organization.createDesignation": () => organization.createDesignation(hr, { title: "X", departmentId: null }),
  "organization.updateDesignation": () => organization.updateDesignation(hr, id, { title: "X", departmentId: null }),
  "organization.deleteDesignation": () => organization.deleteDesignation(hr, id),
  "leaveTypes.createLeaveType": () => leaveTypes.createLeaveType(hr, { code: "sick", name: "S", yearlyQuota: 8, isPaid: true }),
  "leaveTypes.updateLeaveType": () => leaveTypes.updateLeaveType(hr, id, { name: "S", yearlyQuota: 8, isPaid: true }),
  "leaveTypes.deleteLeaveType": () => leaveTypes.deleteLeaveType(hr, id),
  "leaveTypes.addStandardLeaveTypes": () => leaveTypes.addStandardLeaveTypes(hr),
  "holidays.createHoliday": () => holidays.createHoliday(hr, { date: "2026-12-25", name: "X" }),
  "holidays.updateHoliday": () => holidays.updateHoliday(hr, id, { date: "2026-12-25", name: "X" }),
  "holidays.deleteHoliday": () => holidays.deleteHoliday(hr, id),
};

describe("HR gets 403 on every organization write", () => {
  for (const [name, call] of Object.entries(writes)) {
    test(name, async () => {
      await expect(call()).rejects.toMatchObject({ status: 403 });
    });
  }
});

describe("employees can't even read organization setup", () => {
  const reads = {
    getSettings: () => settings.getSettings(employee),
    listOrganization: () => organization.listOrganization(employee),
    listLeaveTypes: () => leaveTypes.listLeaveTypes(employee),
    listHolidays: () => holidays.listHolidays(employee, { year: 2026 }),
  };
  for (const [name, call] of Object.entries(reads)) {
    test(name, async () => {
      await expect(call()).rejects.toMatchObject({ status: 403 });
    });
  }
});
