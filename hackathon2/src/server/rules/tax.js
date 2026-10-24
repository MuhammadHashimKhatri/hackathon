// Spec §6 Payroll — tax slabs on annual income (illustrative)

const SLABS = [
  // [upper bound, base tax, rate on the amount above the lower bound, lower bound]
  [600_000, 0, 0, 0],
  [1_200_000, 0, 0.05, 600_000],
  [2_400_000, 30_000, 0.15, 1_200_000],
  [3_600_000, 210_000, 0.25, 2_400_000],
  [Infinity, 510_000, 0.35, 3_600_000],
];

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export function annualTax(annualIncome) {
  const income = Math.max(0, Number(annualIncome) || 0);
  const [, base, rate, lower] = SLABS.find(([upper]) => income <= upper);
  return round2(base + (income - lower) * rate);
}

// Tax on gross × 12, spread over the year.
export function monthlyTax(monthlyGross) {
  return round2(annualTax(Number(monthlyGross) * 12) / 12);
}
