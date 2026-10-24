import { CalendarDays } from "lucide-react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";

export const metadata = { title: "My Leave" };

export default function Page() {
  return (
    <>
      <PageHeader title="My Leave" description="Apply for leave and track your balances and requests." />
      <Card>
        <EmptyState
          icon={CalendarDays}
          title="No leave requests yet"
          description="Your balances and requests appear here once leave types are set up."
        />
      </Card>
    </>
  );
}
