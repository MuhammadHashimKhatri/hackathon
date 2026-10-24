import { ReceiptText } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import RoleGate from "@/components/shell/RoleGate";
import { getPageActor } from "@/server/auth/session";
import { listPayslips } from "@/server/services/payroll";
import { formatMoney, formatMonth } from "@/lib/format";

export const metadata = { title: "Payslips" };

async function List() {
  const actor = await getPageActor();
  const payslips = await listPayslips(actor);
  const staff = actor.role !== "employee";
  const columns = [
    { key: "month", header: "Month", render: (p) => <span className="font-medium">{formatMonth(p.month)}</span> },
    ...(staff ? [{ key: "employee", header: "Employee", render: (p) => `${p.employeeName} (${p.employeeCode})` }] : []),
    { key: "gross", header: "Gross", align: "right", hideOnMobile: true, render: (p) => formatMoney(p.proratedGross) },
    { key: "deduction", header: "Deductions + tax", align: "right", hideOnMobile: true, render: (p) => formatMoney(p.deduction + p.monthlyTax) },
    { key: "net", header: "Net pay", align: "right", render: (p) => <span className="font-semibold">{formatMoney(p.net)}</span> },
    ...(staff ? [{ key: "status", header: "Payroll", render: (p) => <Badge status={p.runStatus} /> }] : []),
    {
      key: "pdf",
      header: <span className="sr-only">Download</span>,
      align: "right",
      render: (p) => (
        <a href={`/api/payslips/${p.id}/pdf`} className="text-sm font-medium text-accent hover:underline">
          Download PDF
        </a>
      ),
    },
  ];
  return (
    <Card padding={false}>
      <div className="p-2 sm:p-3">
        <Table
          caption="Payslips"
          rows={payslips}
          columns={columns}
          empty={
            <EmptyState
              icon={ReceiptText}
              title="No payslips yet"
              description={
                staff
                  ? "Payslips appear once HR generates a month's payroll."
                  : "Your payslip appears here after Admin finalizes the month's payroll."
              }
            />
          }
        />
      </div>
    </Card>
  );
}

export default function PayslipsPage() {
  return (
    <RoleGate href="/payslips">
      <PageHeader title="Payslips" description="Monthly payslips with a PDF download." />
      <List />
    </RoleGate>
  );
}
