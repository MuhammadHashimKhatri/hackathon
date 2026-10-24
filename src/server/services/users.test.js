import { describe, expect, test, vi } from "vitest";
import { createHrUserSchema } from "@/lib/validation/auth";

vi.mock("@/server/db", () => ({ getDb: () => ({}) }));
vi.mock("@/server/auth/authAdmin", () => ({}));
vi.mock("@/server/audit", () => ({ audit: vi.fn() }));

const { createHrUser, listUsers, resetPassword, setActive } = await import("./users");

const admin = { userId: "11111111-1111-4111-8111-111111111111", role: "admin" };
const hr = { userId: "22222222-2222-4222-8222-222222222222", role: "hr" };

describe("users service guards", () => {
  test("HR cannot create logins (403)", async () => {
    await expect(createHrUser(hr, { email: "x@acme.test" })).rejects.toMatchObject({ status: 403 });
  });

  test("HR cannot list logins (403); signed out is 401", async () => {
    await expect(listUsers(hr)).rejects.toMatchObject({ status: 403 });
    await expect(listUsers(null)).rejects.toMatchObject({ status: 401 });
  });

  test("admin cannot deactivate or reset their own login (422)", async () => {
    await expect(setActive(admin, admin.userId, false)).rejects.toMatchObject({ status: 422 });
    await expect(resetPassword(admin, admin.userId)).rejects.toMatchObject({ status: 422 });
  });
});

describe("createHrUserSchema", () => {
  test("rejects an attempt to create an admin", () => {
    expect(createHrUserSchema.safeParse({ email: "x@acme.test", role: "admin" }).success).toBe(false);
  });

  test("accepts a plain email and normalises it", () => {
    expect(createHrUserSchema.parse({ email: " HR@Acme.test " })).toEqual({ email: "hr@acme.test" });
  });
});
