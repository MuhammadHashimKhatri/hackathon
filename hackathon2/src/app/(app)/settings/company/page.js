import { Building2 } from "lucide-react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import RoleGate from "@/components/shell/RoleGate";

export const metadata = { title: "Company Settings" };

export default function Page() {
  return (
    <RoleGate href="/settings/company">
      <PageHeader title="Company Settings" description="Office hours, grace period, weekend days and the office location used for check-in." />
      <Card>
        <EmptyState
          icon={Building2}
          title="Company settings aren't saved yet"
          description="Admin sets office hours, grace minutes, weekend days and the office location here."
        />
      </Card>
    </RoleGate>
  );
}
