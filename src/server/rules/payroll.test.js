import { describe, expect, test } from "vitest";
import { annualTax, monthlyTax } from "./tax";
import { computePayslip, salaryBreakdown } from "./payroll";

describe("tax slabs (Spec §6)", () => {
  test.each([
    [0, 0],
    [600_000, 0],
    [600_001, 0.05],
    [900_000, 15_000],
    [1_200_000, 30_000],
    [2_400_000, 210_000],
    [3_600_000, 510_000],
    [4_600_000, 860_000],
  ])("annual %d → %d", (income, tax) => {
    expect(annualTax(income)).toBe(tax);
  });

  test("monthly tax on gross 75,000 is 1,250", () => {
    expect(monthlyTax(75_000)).toBe(1250);
  });
});

describe("payslip", () => {
  test("salary split: HRA 40%, medical 10%, gross 1.5 × basic", () => {
    expect(salaryBreakdown(50_000)).toEqual({ basic: 50_000, hra: 20_000, medical: 5_000, gross: 75_000 });
  });

  test("worked example: 22 days, 1 absent + 1 half day → net 68,636.36", () => {
    const p = computePayslip({ basic: 50_000, workingDays: 22, eligibleDays: 22, absent: 1, halfDays: 1 });
    expect(p).toMatchObject({ gross: 75_000, perDay: 3409.09, deduction: 5113.64, monthlyTax: 1250, net: 68636.36 });
  });

  test("a joiner is prorated by eligible days", () => {
    const p = computePayslip({ basic: 50_000, workingDays: 22, eligibleDays: 11 });
    expect(p.proratedGross).toBe(37_500);
    expect(p.net).toBe(36_250);
  });

  test("unpaid leave is deducted like an absent day", () => {
    expect(computePayslip({ basic: 50_000, workingDays: 22, unpaid: 2 }).deduction).toBe(6818.18);
  });

  test("late penalty: 3 lates = 0.5 day, only when enabled", () => {
    expect(computePayslip({ basic: 50_000, workingDays: 22, lates: 7 }).deduction).toBe(0);
    expect(computePayslip({ basic: 50_000, workingDays: 22, lates: 7, latePenaltyEnabled: true }).deductedDays).toBe(1);
  });

  test("net never goes below zero", () => {
    expect(computePayslip({ basic: 50_000, workingDays: 22, absent: 22 }).net).toBe(0);
  });
});
