import { Users } from "lucide-react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";

export const metadata = { title: "Employees" };

export default function Page() {
  return (
    <>
      <PageHeader title="Employees" description="The employee directory with search and filters." />
      <Card>
        <EmptyState
          icon={Users}
          title="No employees yet"
          description="HR registers employees here; each one gets a login."
        />
      </Card>
    </>
  );
}
