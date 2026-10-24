import { Network } from "lucide-react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import RoleGate from "@/components/shell/RoleGate";

export const metadata = { title: "Departments & Designations" };

export default function Page() {
  return (
    <RoleGate href="/settings/organization">
      <PageHeader title="Departments & Designations" description="The structure employees are assigned to." />
      <Card>
        <EmptyState
          icon={Network}
          title="No departments yet"
          description="Admin adds departments and the designations inside them here."
        />
      </Card>
    </RoleGate>
  );
}
