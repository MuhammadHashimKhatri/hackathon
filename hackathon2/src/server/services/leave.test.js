import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { fakeDb, opNames } from "../../../test/fakeDb";
import { leaveApplySchema, leaveDecisionSchema } from "@/lib/validation/leave";

let db;
vi.mock("@/server/db", () => ({ getDb: () => db }));
const { audit, notify } = vi.hoisted(() => ({ audit: vi.fn(async () => {}), notify: vi.fn(async () => {}) }));
vi.mock("@/server/audit", () => ({ audit }));
vi.mock("@/server/notify", () => ({ notify }));

const { applyLeave, cancelLeave, decideLeave, whoIsOnLeave } = await import("./leave");

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const REQ = "33333333-3333-4333-8333-333333333333";
const CASUAL = "44444444-4444-4444-8444-444444444444";
const UNPAID = "55555555-5555-4555-8555-555555555555";
const employee = { userId: "u-emp", role: "employee", employeeId: ME };
const hr = { userId: "u-hr", role: "hr", employeeId: null };

const SETTINGS = {
  company_name: "Acme", timezone: "Asia/Karachi", office_start: "09:00:00", grace_minutes: 15, half_day_hours: 5,
  weekend_days: [0, 6], office_lat: null, office_lng: null, office_radius_m: 150, max_gps_accuracy_m: 100,
  late_penalty_enabled: false, updated_at: "2026-10-01T00:00:00Z",
};
const EMPLOYEE = { id: ME, full_name: "Ayesha Khan", status: "active", join_date: "2026-01-05", exit_date: null };
const CASUAL_TYPE = { id: CASUAL, code: "casual", name: "Casual leave", yearly_quota: 10, is_paid: true };
const UNPAID_TYPE = { id: UNPAID, code: "unpaid", name: "Unpaid leave", yearly_quota: null, is_paid: false };
const JOINED_EMPLOYEE = { full_name: "Ayesha Khan", employee_code: "EMP-0001", user_id: "u-emp", department_id: null, department: null };

const request = (over = {}) => ({
  id: REQ, employee_id: ME, leave_type_id: CASUAL, start_date: "2026-10-26", end_date: "2026-10-27", days: "2",
  reason: "Sister's wedding", status: "pending", source: "form", review_comment: null, reviewed_at: null,
  created_at: "2026-10-24T05:00:00Z", employee: JOINED_EMPLOYEE, type: CASUAL_TYPE, ...over,
});

const has = (ops, name) => opNames({ ops }).includes(name);

// leave_requests is read in several shapes; tell them apart by their ops.
function useDb({ type = CASUAL_TYPE, overlap = [], taken = [], existing = null, flipped = true, insertError = null } = {}) {
  const base = fakeDb((table, ops) => {
    switch (table) {
      case "company_settings":
        return { data: SETTINGS, error: null };
      case "employees":
        return { data: EMPLOYEE, error: null };
      case "app_users":
        return { data: [{ id: "u-hr" }, { id: "u-hr2" }], error: null };
      case "leave_types":
        return has(ops, "maybeSingle") ? { data: type, error: null } : { data: [CASUAL_TYPE, UNPAID_TYPE], error: null };
      case "leave_requests": {
        if (has(ops, "insert")) {
          if (insertError) return { data: null, error: insertError };
          const row = ops.find(([op]) => op === "insert")[1];
          return { data: request({ ...row, days: String(row.days), status: "pending", type, employee: JOINED_EMPLOYEE }), error: null };
        }
        if (has(ops, "update")) return { data: flipped ? { id: REQ } : null, error: null };
        if (has(ops, "maybeSingle")) return { data: existing, error: null };
        if (has(ops, "limit") && !has(ops, "order")) return { data: overlap, error: null };
        return { data: taken, error: null };
      }
      default:
        return { data: [], error: null };
    }
  });
  db = base;
  return db;
}

const insertedRow = () => db.calls.find((c) => c.table === "leave_requests" && has(c.ops, "insert")).ops.find(([op]) => op === "insert")[1];
const apply = (over = {}) =>
  applyLeave(employee, leaveApplySchema.parse({ leaveTypeId: CASUAL, startDate: "2026-10-26", endDate: "2026-10-27", reason: "Sister's wedding", ...over }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-24T10:00:00+05:00")); // Saturday in Karachi
  audit.mockClear();
  notify.mockClear();
});
afterEach(() => vi.useRealTimers());

describe("apply", () => {
  test("counts working days, saves for the actor's own record, audits and tells HR", async () => {
    useDb();
    const result = await apply();
    expect(result).toMatchObject({ status: "pending", days: 2, typeName: "Casual leave", canCancel: true });
    expect(insertedRow()).toMatchObject({ employee_id: ME, leave_type_id: CASUAL, days: 2, source: "form" });
    expect(audit).toHaveBeenCalledWith(employee, "create", "leave_requests", REQ, null, expect.objectContaining({ days: 2 }));
    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify.mock.calls[0][4]).toBe("/leave");
  });

  test("the body can't name another employee", () => {
    const parsed = leaveApplySchema.safeParse({ leaveTypeId: CASUAL, startDate: "2026-10-26", endDate: "2026-10-27", reason: "Trip", employeeId: OTHER });
    expect(parsed.success).toBe(false);
  });

  test("overlapping a pending or approved request → 422", async () => {
    useDb({ overlap: [{ start_date: "2026-10-27", end_date: "2026-10-28", status: "approved" }] });
    await expect(apply()).rejects.toMatchObject({ status: 422, code: "OVERLAP" });
  });

  test("the DB exclusion constraint maps to the same 422", async () => {
    useDb({ insertError: { code: "23P01", message: "conflicting key value violates exclusion constraint" } });
    await expect(apply()).rejects.toMatchObject({ status: 422, code: "OVERLAP" });
  });

  test("over the available balance → 422 (approved and pending both count)", async () => {
    useDb({ taken: [{ leave_type_id: CASUAL, days: "7", status: "approved" }, { leave_type_id: CASUAL, days: "2", status: "pending" }] });
    await expect(apply()).rejects.toMatchObject({ status: 422, code: "OVER_BALANCE" });
  });

  test("unpaid leave has no limit", async () => {
    useDb({ type: UNPAID_TYPE, taken: [{ leave_type_id: UNPAID, days: "40", status: "approved" }] });
    const result = await apply({ leaveTypeId: UNPAID, startDate: "2026-11-02", endDate: "2026-11-13" });
    expect(result.days).toBe(10);
  });

  test("a weekend-only range → 422", async () => {
    useDb();
    await expect(apply({ startDate: "2026-10-24", endDate: "2026-10-25" })).rejects.toMatchObject({ status: 422, code: "NO_WORKING_DAYS" });
  });

  test("before the join date → 422", async () => {
    useDb();
    await expect(apply({ startDate: "2026-01-02", endDate: "2026-01-06" })).rejects.toMatchObject({ status: 422, code: "NOT_EMPLOYED" });
  });

  test("Admin can't apply (no own leave flow)", async () => {
    useDb();
    await expect(applyLeave({ userId: "u-admin", role: "admin", employeeId: null }, {})).rejects.toMatchObject({ status: 403 });
  });
});

describe("decide", () => {
  test("an employee can't decide → 403", async () => {
    useDb({ existing: request() });
    await expect(decideLeave(employee, REQ, { decision: "approve", comment: "" })).rejects.toMatchObject({ status: 403 });
  });

  test("HR can't decide their own request → 403", async () => {
    useDb({ existing: request() });
    await expect(decideLeave({ ...hr, employeeId: ME }, REQ, { decision: "approve", comment: "" })).rejects.toMatchObject({ status: 403 });
  });

  test("rejecting needs a comment", () => {
    expect(leaveDecisionSchema.safeParse({ decision: "reject", comment: "" }).success).toBe(false);
    expect(leaveDecisionSchema.safeParse({ decision: "approve" }).success).toBe(true);
  });

  test("an already decided request → 409", async () => {
    useDb({ existing: request({ status: "approved" }) });
    await expect(decideLeave(hr, REQ, { decision: "approve", comment: "" })).rejects.toMatchObject({ status: 409 });
  });

  test("a double click loses the race → 409", async () => {
    useDb({ existing: request(), flipped: false });
    await expect(decideLeave(hr, REQ, { decision: "reject", comment: "Busy week" })).rejects.toMatchObject({ status: 409 });
  });

  test("approving over a lowered quota → 422", async () => {
    useDb({ existing: request(), taken: [{ leave_type_id: CASUAL, days: "9", status: "approved" }, { leave_type_id: CASUAL, days: "2", status: "pending" }] });
    await expect(decideLeave(hr, REQ, { decision: "approve", comment: "" })).rejects.toMatchObject({ status: 422, code: "OVER_BALANCE" });
  });

  test("approve audits and notifies the employee", async () => {
    useDb({ existing: request(), taken: [{ leave_type_id: CASUAL, days: "2", status: "pending" }] });
    const result = await decideLeave(hr, REQ, { decision: "approve", comment: "Enjoy" });
    expect(result).toMatchObject({ status: "approved", reviewComment: "Enjoy" });
    expect(audit).toHaveBeenCalledWith(hr, "approve", "leave_requests", REQ, { status: "pending" }, { status: "approved", comment: "Enjoy" });
    expect(notify).toHaveBeenCalledWith("u-emp", "leave", expect.stringContaining("approved"), "Enjoy", "/leave/me");
  });
});

describe("cancel", () => {
  test("a pending request can be cancelled", async () => {
    useDb({ existing: request() });
    expect(await cancelLeave(employee, REQ)).toMatchObject({ status: "cancelled" });
    expect(audit).toHaveBeenCalledWith(employee, "update", "leave_requests", REQ, { status: "pending" }, { status: "cancelled" });
  });

  test("approved leave that already started → 422", async () => {
    useDb({ existing: request({ status: "approved", start_date: "2026-10-20", end_date: "2026-10-21" }) });
    await expect(cancelLeave(employee, REQ)).rejects.toMatchObject({ status: 422, code: "NOT_CANCELLABLE" });
  });

  test("future approved leave can be cancelled and HR is told", async () => {
    useDb({ existing: request({ status: "approved" }) });
    expect(await cancelLeave(employee, REQ)).toMatchObject({ status: "cancelled" });
    expect(notify).toHaveBeenCalled();
  });

  test("someone else's request looks missing → 404", async () => {
    useDb({ existing: request({ employee_id: OTHER }) });
    await expect(cancelLeave(employee, REQ)).rejects.toMatchObject({ status: 404 });
  });
});

describe("who is on leave", () => {
  test("employees can't list other people's leave → 403", async () => {
    useDb();
    await expect(whoIsOnLeave(employee, { from: "2026-10-26", to: "2026-11-01" })).rejects.toMatchObject({ status: 403 });
  });
});
