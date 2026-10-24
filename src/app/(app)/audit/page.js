import { ScrollText } from "lucide-react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";

export const metadata = { title: "Audit Log" };

export default function Page() {
  return (
    <>
      <PageHeader title="Audit Log" description="Every create, update, approval and finalization, with who did it." />
      <Card>
        <EmptyState
          icon={ScrollText}
          title="No activity yet"
          description="Changes made by Admin and HR are recorded here and can't be edited."
        />
      </Card>
    </>
  );
}
