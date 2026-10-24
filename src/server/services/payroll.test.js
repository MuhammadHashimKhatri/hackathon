import { beforeEach, describe, expect, test, vi } from "vitest";
import { fakeDb, opNames } from "../../../test/fakeDb";

let db;
vi.mock("@/server/db", () => ({ getDb: () => db }));
const { audit, notify } = vi.hoisted(() => ({ audit: vi.fn(async () => {}), notify: vi.fn(async () => {}) }));
vi.mock("@/server/audit", () => ({ audit }));
vi.mock("@/server/notify", () => ({ notify }));

const { finalizeRun, generateDraft, getPayslip } = await import("./payroll");

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const RUN = "33333333-3333-4333-8333-333333333333";
const SLIP = "44444444-4444-4444-8444-444444444444";
const employee = { userId: "u-emp", role: "employee", employeeId: ME };
const hr = { userId: "u-hr", role: "hr", employeeId: null };
const admin = { userId: "u-admin", role: "admin", employeeId: null };

const SETTINGS = {
  company_name: "Acme", timezone: "Asia/Karachi", office_start: "09:00:00", grace_minutes: 15, half_day_hours: 5,
  weekend_days: [0, 6], office_lat: null, office_lng: null, office_radius_m: 150, max_gps_accuracy_m: 100,
  late_penalty_enabled: false, updated_at: "2026-10-01T00:00:00Z",
};
const has = (ops, name) => opNames({ ops }).includes(name);
const slip = (over = {}) => ({
  id: SLIP, run_id: RUN, employee_id: ME, working_days: 22, eligible_days: 22, absent_days: "1", unpaid_leave_days: "0",
  half_days: 1, late_count: 0, basic: "50000", hra: "20000", medical: "5000", gross: "75000", prorated_gross: "75000",
  per_day: "3409.09", deduction: "5113.64", monthly_tax: "1250", net: "68636.36",
  employee: { full_name: "Ayesha", employee_code: "EMP-0001", user_id: "u-emp", department: null, designation: null },
  run: { id: RUN, month: "2026-10-01", status: "finalized" }, ...over,
});

function useDb({ run = null, slips = [] } = {}) {
  const base = fakeDb((table, ops) => {
    if (table === "company_settings") return { data: SETTINGS, error: null };
    if (table === "payroll_runs") return { data: run, error: null };
    if (table === "payslips") return has(ops, "maybeSingle") ? { data: slips[0] ?? null, error: null } : { data: slips, error: null };
    if (table === "employees") return { data: [{ id: ME, user_id: "u-emp" }], error: null };
    return { data: [], error: null };
  });
  db = { ...base, rpc: (name) => base.from(`rpc:${name}`) };
}

beforeEach(() => {
  audit.mockClear();
  notify.mockClear();
});

describe("payroll", () => {
  test("regenerating a finalized month → 422", async () => {
    useDb({ run: { id: RUN, month: "2026-10-01", status: "finalized", total_gross: "0", total_net: "0" } });
    await expect(generateDraft(hr, "2026-10")).rejects.toMatchObject({ status: 422, code: "PAYROLL_FINALIZED" });
  });

  test("only HR generates drafts", async () => {
    useDb();
    await expect(generateDraft(admin, "2026-10")).rejects.toMatchObject({ status: 403 });
    await expect(generateDraft(employee, "2026-10")).rejects.toMatchObject({ status: 403 });
  });

  test("only Admin finalizes", async () => {
    useDb({ run: { id: RUN, month: "2026-10-01", status: "draft" } });
    await expect(finalizeRun(hr, RUN)).rejects.toMatchObject({ status: 403 });
  });

  test("finalizing an already finalized run → 409", async () => {
    useDb({ run: { id: RUN, month: "2026-10-01", status: "finalized" } });
    await expect(finalizeRun(admin, RUN)).rejects.toMatchObject({ status: 409 });
  });

  test("an employee can't open someone else's payslip → 403", async () => {
    useDb({ slips: [slip({ employee_id: OTHER })] });
    await expect(getPayslip(employee, SLIP)).rejects.toMatchObject({ status: 403 });
  });

  test("an employee can't see a draft payslip → 404", async () => {
    useDb({ slips: [slip({ run: { id: RUN, month: "2026-10-01", status: "draft" } })] });
    await expect(getPayslip(employee, SLIP)).rejects.toMatchObject({ status: 404 });
  });

  test("an employee opens their own finalized payslip", async () => {
    useDb({ slips: [slip()] });
    expect(await getPayslip(employee, SLIP)).toMatchObject({ net: 68636.36, employeeCode: "EMP-0001" });
  });
});
