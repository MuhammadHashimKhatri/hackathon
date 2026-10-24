import { expect, test } from "vitest";
import { activeHref, NAV, rolesFor } from "./navigation";

test("page access comes from the role menus", () => {
  expect(rolesFor("/users")).toEqual(["admin"]);
  expect(rolesFor("/payslips")).toEqual(["admin", "hr", "employee"]);
  expect(rolesFor("/attendance/corrections")).toEqual(["hr"]);
  expect(rolesFor("/leave/me")).toEqual(["hr", "employee"]);
  expect(rolesFor("/not-a-page")).toEqual([]);
});

test("HR's Company Setup item covers the three settings pages, nothing else", () => {
  for (const page of ["/settings/company", "/settings/organization", "/settings/leave"]) {
    expect(rolesFor(page)).toEqual(["admin", "hr"]);
  }
  // A parent item never grants pages it doesn't list.
  expect(rolesFor("/attendance/me")).toEqual(["employee"]);
  expect(rolesFor("/employees/import")).toEqual(["hr"]);
});

test("employees: Admin views, only HR registers, both see salaries", () => {
  expect(rolesFor("/employees")).toEqual(["admin", "hr"]);
  expect(rolesFor("/employees/new")).toEqual(["hr"]);
  expect(rolesFor("/salary")).toEqual(["admin", "hr"]);
  expect(rolesFor("/profile")).toEqual(["employee"]);
  expect(activeHref(NAV.hr, "/employees/new")).toBe("/employees");
  expect(activeHref(NAV.hr, "/employees/import")).toBe("/employees/import");
});

test("the most specific menu item is active", () => {
  expect(activeHref(NAV.hr, "/attendance/corrections")).toBe("/attendance/corrections");
  expect(activeHref(NAV.hr, "/attendance")).toBe("/attendance");
  expect(activeHref(NAV.hr, "/settings/leave")).toBe("/settings");
  expect(activeHref(NAV.admin, "/settings/leave")).toBe("/settings/leave");
});
