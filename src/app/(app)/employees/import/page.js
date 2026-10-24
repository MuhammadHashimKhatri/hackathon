import RoleGate from "@/components/shell/RoleGate";
import PageHeader from "@/components/ui/PageHeader";
import ImportManager from "./ImportManager";

export const metadata = { title: "Import / Export" };

export default function ImportPage() {
  return (
    <RoleGate href="/employees/import">
      <PageHeader
        title="Import / Export"
        description="Add many employees from a CSV file. A dry run checks every row first; nothing is created until the whole file is clean."
        breadcrumbs={[{ label: "Employees", href: "/employees" }, { label: "Import / Export" }]}
      />
      <ImportManager />
    </RoleGate>
  );
}
