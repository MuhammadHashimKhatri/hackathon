import { CalendarCheck } from "lucide-react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import RoleGate from "@/components/shell/RoleGate";

export const metadata = { title: "Leave" };

export default function Page() {
  return (
    <RoleGate href="/leave">
      <PageHeader title="Leave" description="Leave requests across the company, with approval and history." />
      <Card>
        <EmptyState
          icon={CalendarCheck}
          title="No leave requests"
          description="Employee requests wait here for HR to approve or reject with a comment."
        />
      </Card>
    </RoleGate>
  );
}
