import { beforeEach, describe, expect, test, vi } from "vitest";
import { fakeDb, opNames } from "../../../test/fakeDb";

let db;
vi.mock("@/server/db", () => ({ getDb: () => db }));
const { audit } = vi.hoisted(() => ({ audit: vi.fn(async () => {}) }));
vi.mock("@/server/audit", () => ({ audit }));

const { deleteDepartment } = await import("./organization");
const { addStandardLeaveTypes } = await import("./leaveTypes");
const { updateSettings } = await import("./settings");

const admin = { userId: "u-admin", role: "admin" };
const deptId = "44444444-4444-4444-8444-444444444444";

beforeEach(() => audit.mockClear());

describe("deleteDepartment", () => {
  const withCounts = (employees, designations) =>
    fakeDb((table, ops) => {
      if (opNames({ ops }).includes("delete")) return { error: null };
      return {
        data: { id: deptId, name: "Engineering", employees: [{ count: employees }], designations: [{ count: designations }] },
        error: null,
      };
    });

  test("422 while the department has employees, nothing deleted", async () => {
    db = withCounts(3, 0);
    await expect(deleteDepartment(admin, deptId)).rejects.toMatchObject({ status: 422, code: "DEPARTMENT_HAS_EMPLOYEES" });
    expect(db.calls.some((c) => opNames(c).includes("delete"))).toBe(false);
  });

  test("422 while it still has designations", async () => {
    db = withCounts(0, 2);
    await expect(deleteDepartment(admin, deptId)).rejects.toMatchObject({ status: 422, code: "DEPARTMENT_HAS_DESIGNATIONS" });
  });

  test("deletes an empty department and audits it", async () => {
    db = withCounts(0, 0);
    await expect(deleteDepartment(admin, deptId)).resolves.toEqual({ ok: true });
    expect(audit).toHaveBeenCalledWith(admin, "delete", "departments", deptId, { name: "Engineering" }, null);
  });

  test("an id that isn't a uuid is 404", async () => {
    db = withCounts(0, 0);
    await expect(deleteDepartment(admin, "nope")).rejects.toMatchObject({ status: 404 });
  });
});

describe("addStandardLeaveTypes", () => {
  test("upserts the four standard types ignoring existing codes, audits only what was added", async () => {
    let upsertArgs;
    db = fakeDb((table, ops) => {
      upsertArgs = ops.find(([name]) => name === "upsert").slice(1);
      // Pretend annual and sick already existed: only casual and unpaid come back.
      return {
        data: [
          { id: "c", code: "unpaid", name: "Unpaid leave", yearly_quota: null, is_paid: false },
          { id: "b", code: "casual", name: "Casual leave", yearly_quota: 10, is_paid: true },
        ],
        error: null,
      };
    });
    const result = await addStandardLeaveTypes(admin);
    expect(result).toEqual({ added: ["casual", "unpaid"] });
    const [rows, options] = upsertArgs;
    expect(rows.map((r) => [r.code, r.yearly_quota, r.is_paid])).toEqual([
      ["annual", 14, true],
      ["sick", 8, true],
      ["casual", 10, true],
      ["unpaid", null, false],
    ]);
    expect(options).toEqual({ onConflict: "code", ignoreDuplicates: true });
    expect(audit).toHaveBeenCalledTimes(2);
  });
});

describe("updateSettings", () => {
  const stored = {
    company_name: "Acme",
    timezone: "Asia/Karachi",
    office_start: "09:00:00",
    grace_minutes: 15,
    half_day_hours: 5,
    weekend_days: [6, 0],
    office_lat: null,
    office_lng: null,
    office_radius_m: 150,
    max_gps_accuracy_m: 100,
    late_penalty_enabled: false,
    updated_at: "2026-10-24T00:00:00Z",
  };

  test("writes and audits only the fields that actually changed", async () => {
    let written;
    db = fakeDb((table, ops) => {
      const update = ops.find(([name]) => name === "update");
      if (update) {
        written = update[1];
        return { data: { ...stored, ...update[1] }, error: null };
      }
      return { data: stored, error: null };
    });
    await updateSettings(admin, { grace_minutes: 10, weekend_days: [0, 6], office_start: "09:00" });
    expect(written).toEqual({ grace_minutes: 10 });
    expect(audit).toHaveBeenCalledWith(admin, "update", "company_settings", 1, { grace_minutes: 15 }, { grace_minutes: 10 });
  });

  test("no real change: no write, no audit", async () => {
    db = fakeDb(() => ({ data: stored, error: null }));
    await updateSettings(admin, { weekend_days: [0, 6] });
    expect(db.calls.some((c) => opNames(c).includes("update"))).toBe(false);
    expect(audit).not.toHaveBeenCalled();
  });
});
