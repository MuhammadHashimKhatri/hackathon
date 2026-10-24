import { Banknote } from "lucide-react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";

export const metadata = { title: "Salary Structures" };

export default function Page() {
  return (
    <>
      <PageHeader title="Salary Structures" description="Basic pay per employee; HRA and medical are calculated from it." />
      <Card>
        <EmptyState
          icon={Banknote}
          title="No salary structures yet"
          description="HR sets each employee's basic pay here after registering them."
        />
      </Card>
    </>
  );
}
