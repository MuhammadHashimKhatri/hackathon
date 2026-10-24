import { expect, test } from "vitest";
import { activeHref, NAV, rolesFor } from "./navigation";

test("page access comes from the role menus", () => {
  expect(rolesFor("/users")).toEqual(["admin"]);
  expect(rolesFor("/payslips")).toEqual(["admin", "hr", "employee"]);
  expect(rolesFor("/attendance/corrections")).toEqual(["hr"]);
  expect(rolesFor("/leave/me")).toEqual(["hr", "employee"]);
  expect(rolesFor("/not-a-page")).toEqual([]);
});

test("the most specific menu item is active", () => {
  expect(activeHref(NAV.hr, "/attendance/corrections")).toBe("/attendance/corrections");
  expect(activeHref(NAV.hr, "/attendance")).toBe("/attendance");
});
