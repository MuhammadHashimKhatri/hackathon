import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { fakeDb, opNames } from "../../../test/fakeDb";

let db;
vi.mock("@/server/db", () => ({ getDb: () => db }));
const { audit, notify } = vi.hoisted(() => ({ audit: vi.fn(async () => {}), notify: vi.fn(async () => {}) }));
vi.mock("@/server/audit", () => ({ audit }));
vi.mock("@/server/notify", () => ({ notify }));

const { checkIn, checkOut, dailyBoard, getCalendar } = await import("./attendance");
const { decideCorrection, requestCorrection } = await import("./corrections");

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const REQ = "33333333-3333-4333-8333-333333333333";
const employee = { userId: "u-emp", role: "employee", employeeId: ME };
const hr = { userId: "u-hr", role: "hr", employeeId: null };
const admin = { userId: "u-admin", role: "admin", employeeId: null };

const SETTINGS = {
  company_name: "Acme", timezone: "Asia/Karachi", office_start: "09:00:00", grace_minutes: 15, half_day_hours: 5,
  weekend_days: [0, 6], office_lat: null, office_lng: null, office_radius_m: 150, max_gps_accuracy_m: 100,
  late_penalty_enabled: false, updated_at: "2026-10-01T00:00:00Z",
};
const EMPLOYEE = { id: ME, status: "active", join_date: "2026-01-05", exit_date: null, full_name: "Ayesha Khan" };

// fakeDb with rpc() recorded as table "rpc:<name>"; tables answered by `tables[table](ops)`.
function useDb(tables) {
  const base = fakeDb((table, ops) => {
    const answer = tables[table];
    if (!answer) return { data: [], error: null };
    return typeof answer === "function" ? answer(ops) : answer;
  });
  db = { ...base, rpc: (name) => base.from(`rpc:${name}`) };
  return db;
}
const settingsTable = { company_settings: { data: SETTINGS, error: null } };
const has = (ops, name) => opNames({ ops }).includes(name);

// Saturday 24 Oct 2026 in Karachi (UTC+5): checking in on a weekend is allowed.
const at = (pktTime) => vi.setSystemTime(new Date(`2026-10-24T${pktTime}+05:00`));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  audit.mockClear();
  notify.mockClear();
});
afterEach(() => vi.useRealTimers());

describe("check-in", () => {
  const insertedWith = () => db.calls.find((c) => c.table === "attendance" && has(c.ops, "insert")).ops.find(([op]) => op === "insert")[1];

  test("stamps server time, local date and late status (09:16, on a Saturday)", async () => {
    at("09:16:00");
    useDb({
      ...settingsTable,
      employees: { data: EMPLOYEE, error: null },
      attendance: (ops) => ({ data: { id: "a1", ...ops.find(([op]) => op === "insert")[1] }, error: null }),
    });
    const result = await checkIn(employee, {});
    expect(insertedWith()).toMatchObject({ work_date: "2026-10-24", status: "late", source: "web", lat: null });
    expect(insertedWith().check_in_at).toBe("2026-10-24T04:16:00.000Z");
    expect(result).toMatchObject({ status: "late", checkIn: "09:16" });
  });

  test("09:15 is present", async () => {
    at("09:15:30");
    useDb({
      ...settingsTable,
      employees: { data: EMPLOYEE, error: null },
      attendance: (ops) => ({ data: { id: "a1", ...ops.find(([op]) => op === "insert")[1] }, error: null }),
    });
    expect((await checkIn(employee, {})).status).toBe("present");
  });

  test("a second check-in the same day is 409", async () => {
    at("10:00:00");
    useDb({
      ...settingsTable,
      employees: { data: EMPLOYEE, error: null },
      attendance: { data: null, error: { code: "23505", message: "attendance_employee_day_key" } },
    });
    await expect(checkIn(employee, {})).rejects.toMatchObject({ status: 409 });
  });

  test("no employee record or an exited employee: 403; Admin: 403", async () => {
    useDb({ ...settingsTable, employees: { data: { ...EMPLOYEE, status: "exited" }, error: null } });
    await expect(checkIn(employee, {})).rejects.toMatchObject({ status: 403 });
    await expect(checkIn({ ...hr }, {})).rejects.toMatchObject({ status: 403 });
    await expect(checkIn(admin, {})).rejects.toMatchObject({ status: 403 });
  });
});

describe("check-out", () => {
  const today = (row) => ({
    ...settingsTable,
    employees: { data: EMPLOYEE, error: null },
    attendance: (ops) =>
      has(ops, "update")
        ? { data: { ...row, ...ops.find(([op]) => op === "update")[1] }, error: null }
        : { data: row, error: null },
  });
  const row = { id: "a1", employee_id: ME, work_date: "2026-10-24", check_in_at: "2026-10-24T04:00:00Z", check_out_at: null, status: "present", source: "web", accuracy_m: null, distance_m: null };

  test("without a check-in today: 422", async () => {
    at("18:00:00");
    useDb(today(null));
    await expect(checkOut(employee)).rejects.toMatchObject({ status: 422 });
  });

  test("already checked out: 409", async () => {
    at("18:00:00");
    useDb(today({ ...row, check_out_at: "2026-10-24T12:00:00Z" }));
    await expect(checkOut(employee)).rejects.toMatchObject({ status: 409 });
  });

  test("4h59m after a 09:00 check-in is a half day; 5h keeps the status", async () => {
    at("13:59:00");
    useDb(today(row));
    expect((await checkOut(employee)).status).toBe("half_day");
    at("14:00:00");
    useDb(today(row));
    expect((await checkOut(employee)).status).toBe("present");
  });
});

describe("scope", () => {
  test("an employee can't see the board or another employee's calendar (403 before any read)", async () => {
    useDb({});
    await expect(dailyBoard(employee, {})).rejects.toMatchObject({ status: 403 });
    await expect(getCalendar(employee, {}, OTHER)).rejects.toMatchObject({ status: 403 });
    expect(db.calls).toHaveLength(0);
  });
});

describe("corrections", () => {
  const request = {
    id: REQ, employee_id: ME, work_date: "2026-10-22", requested_check_in: "2026-10-22T04:05:00Z", requested_check_out: null,
    reason: "Forgot", status: "pending", employee: { full_name: "Ayesha Khan", employee_code: "EMP-0001", user_id: "u-emp" },
  };

  test("approving rewrites the day with source correction and a recomputed status, audits and notifies", async () => {
    at("10:00:00");
    let upserted;
    useDb({
      ...settingsTable,
      attendance_corrections: (ops) => (has(ops, "update") ? { data: { id: REQ }, error: null } : { data: request, error: null }),
      attendance: (ops) => {
        if (has(ops, "upsert")) {
          upserted = ops.find(([op]) => op === "upsert")[1];
          return { data: upserted, error: null };
        }
        // existing row: checked in late at 09:40, out 18:00
        return { data: { id: "a1", check_in_at: "2026-10-22T04:40:00Z", check_out_at: "2026-10-22T13:00:00Z", status: "late" }, error: null };
      },
    });
    const result = await decideCorrection(hr, REQ, { decision: "approve", comment: "" });
    expect(upserted).toMatchObject({ source: "correction", status: "present", check_in_at: "2026-10-22T04:05:00Z", check_out_at: "2026-10-22T13:00:00Z" });
    expect(result.status).toBe("approved");
    expect(audit).toHaveBeenCalledWith(hr, "approve", "attendance_corrections", REQ, expect.anything(), expect.objectContaining({ status: "approved" }));
    expect(notify).toHaveBeenCalledWith("u-emp", "attendance_correction", expect.stringContaining("approved"), null, "/attendance/me");
  });

  test("a request decided in the meantime is 409 and nothing is written", async () => {
    useDb({
      ...settingsTable,
      attendance_corrections: (ops) => (has(ops, "update") ? { data: null, error: null } : { data: request, error: null }),
    });
    await expect(decideCorrection(hr, REQ, { decision: "approve", comment: "" })).rejects.toMatchObject({ status: 409 });
    expect(db.calls.some((c) => c.table === "attendance" && has(c.ops, "upsert"))).toBe(false);
  });

  test("Admin and Employee can't decide", async () => {
    useDb({});
    await expect(decideCorrection(admin, REQ, { decision: "approve" })).rejects.toMatchObject({ status: 403 });
    await expect(decideCorrection(employee, REQ, { decision: "approve" })).rejects.toMatchObject({ status: 403 });
  });

  test("requests: future day 422, missing check-in on an empty day 422, second pending 409", async () => {
    at("10:00:00");
    const tables = (insert) => ({
      ...settingsTable,
      employees: { data: EMPLOYEE, error: null },
      attendance: { data: null, error: null },
      attendance_corrections: insert,
    });
    useDb(tables({ data: null, error: null }));
    await expect(requestCorrection(employee, { workDate: "2026-10-25", checkIn: "09:00", reason: "x" })).rejects.toMatchObject({ status: 422 });
    await expect(requestCorrection(employee, { workDate: "2026-10-22", checkOut: "18:00", reason: "Forgot" })).rejects.toMatchObject({ status: 422, code: "CHECK_IN_REQUIRED" });
    useDb(tables({ data: null, error: { code: "23505", message: "attendance_corrections_one_pending" } }));
    await expect(requestCorrection(employee, { workDate: "2026-10-22", checkIn: "09:00", reason: "Forgot" })).rejects.toMatchObject({ status: 409 });
  });
});
