import { Clock } from "lucide-react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";

export const metadata = { title: "My Attendance" };

export default function Page() {
  return (
    <>
      <PageHeader title="My Attendance" description="Your check-ins, late days and half days by month." />
      <Card>
        <EmptyState
          icon={Clock}
          title="No attendance yet"
          description="Your days appear here after your first check-in."
        />
      </Card>
    </>
  );
}
