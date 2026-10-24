import { UserRound } from "lucide-react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";

export const metadata = { title: "My Profile" };

export default function Page() {
  return (
    <>
      <PageHeader title="My Profile" description="Your details on record. You can update your phone and address." />
      <Card>
        <EmptyState
          icon={UserRound}
          title="No employee record linked"
          description="Ask HR to register you as an employee to see your profile."
        />
      </Card>
    </>
  );
}
