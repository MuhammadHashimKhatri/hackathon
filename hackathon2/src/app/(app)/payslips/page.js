import { ReceiptText } from "lucide-react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import RoleGate from "@/components/shell/RoleGate";

export const metadata = { title: "Payslips" };

export default function Page() {
  return (
    <RoleGate href="/payslips">
      <PageHeader title="Payslips" description="Payslips from finalized payroll runs, downloadable as PDF." />
      <Card>
        <EmptyState
          icon={ReceiptText}
          title="No payslips yet"
          description="Payslips appear here once a payroll month is finalized."
        />
      </Card>
    </RoleGate>
  );
}
