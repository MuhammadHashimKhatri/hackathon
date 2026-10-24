import { Wallet } from "lucide-react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";

export const metadata = { title: "Payroll" };

export default function Page() {
  return (
    <>
      <PageHeader title="Payroll" description="Monthly payroll drafts and finalized runs." />
      <Card>
        <EmptyState
          icon={Wallet}
          title="No payroll runs yet"
          description="HR creates a draft for a month; Admin finalizes it to lock the month."
        />
      </Card>
    </>
  );
}
