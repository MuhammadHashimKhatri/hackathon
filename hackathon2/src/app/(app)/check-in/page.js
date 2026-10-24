import { MapPin } from "lucide-react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";

export const metadata = { title: "Check-in" };

export default function Page() {
  return (
    <>
      <PageHeader title="Check-in" description="Check in when you arrive and check out when you leave." />
      <Card>
        <EmptyState
          icon={MapPin}
          title="No employee record linked"
          description="Ask HR to register you as an employee to start checking in."
        />
      </Card>
    </>
  );
}
