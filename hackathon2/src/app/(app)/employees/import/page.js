import { FileSpreadsheet } from "lucide-react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import RoleGate from "@/components/shell/RoleGate";

export const metadata = { title: "Import / Export" };

export default function Page() {
  return (
    <RoleGate href="/employees/import">
      <PageHeader title="Import / Export" description="Bulk-add employees from CSV with a dry run first, or export the directory." />
      <Card>
        <EmptyState
          icon={FileSpreadsheet}
          title="Nothing imported yet"
          description="Upload a CSV to check it in a dry run before any employee is created."
        />
      </Card>
    </RoleGate>
  );
}
