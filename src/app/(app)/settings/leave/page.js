import { CalendarRange } from "lucide-react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import RoleGate from "@/components/shell/RoleGate";

export const metadata = { title: "Leave Types & Holidays" };

export default function Page() {
  return (
    <RoleGate href="/settings/leave">
      <PageHeader title="Leave Types & Holidays" description="Yearly leave quotas and the company holiday calendar." />
      <Card>
        <EmptyState
          icon={CalendarRange}
          title="No leave types or holidays yet"
          description="Admin adds leave types with yearly quotas and marks public holidays here."
        />
      </Card>
    </RoleGate>
  );
}
