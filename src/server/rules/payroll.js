// Spec §6 Payroll — salary split and per-employee payslip math
import { monthlyTax } from "./tax";

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Gross = 1.5 × basic: HRA 40% + medical 10% of basic.
export function salaryBreakdown(basic) {
  const b = Number(basic);
  return { basic: round2(b), hra: round2(b * 0.4), medical: round2(b * 0.1), gross: round2(b * 1.5) };
}

// Penalty days from lates when the company turns the rule on: 3 lates = 0.5 day.
export const latePenaltyDays = (lates, enabled) => (enabled ? Math.floor(lates / 3) * 0.5 : 0);

export function computePayslip({
  basic,
  workingDays,
  eligibleDays = workingDays,
  absent = 0,
  unpaid = 0,
  halfDays = 0,
  lates = 0,
  latePenaltyEnabled = false,
}) {
  const { hra, medical, gross } = salaryBreakdown(basic);
  const perDayExact = workingDays > 0 ? gross / workingDays : 0;
  const proratedGross = workingDays > 0 ? (gross * eligibleDays) / workingDays : 0;
  const deductedDays = absent + unpaid + 0.5 * halfDays + latePenaltyDays(lates, latePenaltyEnabled);
  const deduction = round2(Math.min(perDayExact * deductedDays, proratedGross));
  const tax = monthlyTax(gross);
  const net = Math.max(0, round2(proratedGross - deduction - tax));
  return {
    basic: round2(Number(basic)),
    hra,
    medical,
    gross,
    proratedGross: round2(proratedGross),
    perDay: round2(perDayExact),
    deductedDays,
    deduction,
    monthlyTax: tax,
    net,
  };
}
