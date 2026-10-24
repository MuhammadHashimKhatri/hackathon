import { salaryBreakdown } from "@/lib/validation/employees";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";

// Live HRA / medical / gross for a typed basic (Spec §5: 40%, 10%, 1.5 × basic).
export default function SalaryPreview({ basic, className }) {
  const valid = Number.isFinite(basic) && basic > 0;
  const { hra, medical, gross } = salaryBreakdown(valid ? basic : 0);
  const rows = [
    ["HRA (40%)", hra],
    ["Medical (10%)", medical],
  ];
  return (
    <dl className={cn("grid gap-1.5 rounded-lg border border-line bg-surface-2 p-3 text-[0.8125rem]", className)} aria-live="polite">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4">
          <dt className="text-muted">{label}</dt>
          <dd className="figure text-ink">{valid ? formatMoney(value) : "—"}</dd>
        </div>
      ))}
      <div className="mt-1 flex justify-between gap-4 border-t border-line pt-2 text-sm font-semibold">
        <dt>Gross per month</dt>
        <dd className="figure">{valid ? formatMoney(gross) : "—"}</dd>
      </div>
    </dl>
  );
}
