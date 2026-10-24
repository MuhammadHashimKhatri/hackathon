import { ClipboardCheck } from "lucide-react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import RoleGate from "@/components/shell/RoleGate";

export const metadata = { title: "Attendance Corrections" };

export default function Page() {
  return (
    <RoleGate href="/attendance/corrections">
      <PageHeader title="Attendance Corrections" description="Requests from employees to fix a check-in or check-out." />
      <Card>
        <EmptyState
          icon={ClipboardCheck}
          title="No correction requests"
          description="When an employee asks to fix a day, the request waits here for HR."
        />
      </Card>
    </RoleGate>
  );
}
