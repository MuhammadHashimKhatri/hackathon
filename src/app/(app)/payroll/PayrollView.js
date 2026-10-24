"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, RefreshCw, Wallet } from "lucide-react";
import { postJson } from "@/lib/api";
import { formatMoney, formatMonth } from "@/lib/format";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import FormAlert from "@/components/ui/FormAlert";
import Input from "@/components/ui/Input";
import StatCard from "@/components/ui/StatCard";
import Table from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";

export default function PayrollView({ month, data, role }) {
  const router = useRouter();
  const { toast } = useToast();
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const run = data?.run ?? null;
  const payslips = data?.payslips ?? [];
  const locked = run?.status === "finalized";
  const label = formatMonth(`${month}-01`);

  function generate() {
    setError(null);
    startTransition(async () => {
      const result = await postJson("/api/payroll", { month });
      if (!result.ok) {
        setError(result.error?.message ?? "Couldn't generate the payroll. Try again.");
        return;
      }
      const skipped = result.data.skipped;
      toast({
        tone: "success",
        title: run ? "Draft regenerated" : "Draft created",
        description: `${result.data.payslips.length} payslips${skipped ? `, ${skipped} skipped (no salary set)` : ""}.`,
      });
      router.refresh();
    });
  }

  function finalize() {
    setError(null);
    startTransition(async () => {
      const result = await postJson(`/api/payroll/${run.id}/finalize`);
      setConfirming(false);
      if (!result.ok) {
        setError(result.error?.message ?? "Couldn't finalize. Try again.");
        return;
      }
      toast({ tone: "success", title: `${label} finalized`, description: "Employees were told their payslips are ready." });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <Input
              label="Month"
              name="month"
              type="month"
              value={month}
              onChange={(e) => e.target.value && router.replace(`/payroll?month=${e.target.value}`, { scroll: false })}
            />
            <div className="pb-2">{run ? <Badge status={run.status} /> : <Badge tone="neutral">Not generated</Badge>}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {role === "hr" && !locked ? (
              <Button variant={run ? "secondary" : "primary"} icon={RefreshCw} loading={pending && !confirming} onClick={generate}>
                {run ? "Regenerate draft" : "Generate draft"}
              </Button>
            ) : null}
            {role === "admin" && run && !locked ? (
              <Button variant="primary" icon={Lock} onClick={() => setConfirming(true)} disabled={payslips.length === 0}>
                Finalize
              </Button>
            ) : null}
            {locked ? (
              <p className="flex items-center gap-1.5 text-sm text-muted">
                <Lock size={14} aria-hidden /> Locked. A finalized month can&apos;t change.
              </p>
            ) : null}
          </div>
        </div>
        {error ? (
          <div className="mt-3">
            <FormAlert>{error}</FormAlert>
          </div>
        ) : null}
      </Card>

      {run ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Employees" value={payslips.length} />
          <StatCard label="Gross cost" value={formatMoney(run.totalGross)} />
          <StatCard label="Net pay" value={formatMoney(run.totalNet)} />
          <StatCard label="Tax" value={formatMoney(payslips.reduce((s, p) => s + p.monthlyTax, 0))} />
        </div>
      ) : null}

      <Card title={`Payslips for ${label}`} padding={false}>
        <div className="p-2 sm:p-3">
          <Table
            caption="Payroll breakdown"
            rows={payslips}
            empty={
              <EmptyState
                icon={Wallet}
                title={run ? "No payslips in this draft" : "No payroll for this month yet"}
                description={
                  role === "hr"
                    ? "Generate the draft. It reads attendance, approved unpaid leave and each employee's salary."
                    : "HR generates the draft first. Then you can review and finalize it here."
                }
              />
            }
            columns={[
              {
                key: "employee",
                header: "Employee",
                render: (p) => (
                  <div className="min-w-0">
                    <p className="font-medium">{p.employeeName}</p>
                    <p className="figure text-[0.8125rem] text-muted">{p.employeeCode}</p>
                  </div>
                ),
              },
              {
                key: "days",
                header: "Days",
                align: "right",
                hideOnMobile: true,
                render: (p) => (
                  <span className="figure">
                    {p.eligibleDays}/{p.workingDays}
                  </span>
                ),
              },
              {
                key: "lost",
                header: "Absent / unpaid / half",
                align: "right",
                hideOnMobile: true,
                render: (p) => (
                  <span className="figure">
                    {p.absentDays} / {p.unpaidLeaveDays} / {p.halfDays}
                  </span>
                ),
              },
              { key: "gross", header: "Gross", align: "right", render: (p) => formatMoney(p.proratedGross) },
              { key: "deduction", header: "Deductions", align: "right", render: (p) => formatMoney(p.deduction), hideOnMobile: true },
              { key: "tax", header: "Tax", align: "right", render: (p) => formatMoney(p.monthlyTax), hideOnMobile: true },
              { key: "net", header: "Net pay", align: "right", render: (p) => <span className="font-semibold">{formatMoney(p.net)}</span> },
              {
                key: "pdf",
                header: <span className="sr-only">PDF</span>,
                align: "right",
                render: (p) => (
                  <a href={`/api/payslips/${p.id}/pdf`} className="text-sm font-medium text-accent hover:underline">
                    PDF
                  </a>
                ),
              },
            ]}
          />
        </div>
      </Card>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={finalize}
        pending={pending}
        confirmLabel="Finalize and lock"
        title={`Finalize payroll for ${label}?`}
        description="The month is locked for good: nobody can regenerate or edit it. Every employee gets a notification that their payslip is ready."
      />
    </div>
  );
}
