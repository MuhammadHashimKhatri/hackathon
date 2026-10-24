import { Clock } from "lucide-react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";

export const metadata = { title: "Attendance" };

export default function Page() {
  return (
    <>
      <PageHeader title="Attendance" description="Daily board and calendar for every employee." />
      <Card>
        <EmptyState
          icon={Clock}
          title="No attendance yet"
          description="Check-ins appear here as employees arrive, with late and half-day status."
        />
      </Card>
    </>
  );
}
