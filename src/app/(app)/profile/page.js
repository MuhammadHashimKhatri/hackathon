import { UserRound } from "lucide-react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import RoleGate from "@/components/shell/RoleGate";
import Employee360 from "@/components/employees/Employee360";
import { getPageActor } from "@/server/auth/session";
import { getEmployee360 } from "@/server/services/employees";

export const metadata = { title: "My Profile" };

async function MyProfile() {
  const actor = await getPageActor();
  if (!actor.employeeId) {
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
  const data = await getEmployee360(actor, actor.employeeId);
  return <Employee360 data={data} mode="self" />;
}

export default function ProfilePage() {
  return (
    <RoleGate href="/profile">
      <MyProfile />
    </RoleGate>
  );
}
