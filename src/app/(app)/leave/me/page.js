import { CalendarDays } from "lucide-react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import RoleGate from "@/components/shell/RoleGate";
import { getPageActor } from "@/server/auth/session";
import { getLeaveFormContext, getMyBalances, listMyLeave } from "@/server/services/leave";
import MyLeave from "./MyLeave";

export const metadata = { title: "My Leave" };

async function Content() {
  const actor = await getPageActor();
  if (!actor.employeeId) {
    return (
      <Card>
        <EmptyState icon={CalendarDays} title="No employee record linked" description="Ask HR to register you as an employee to apply for leave." />
      </Card>
    );
  }
  const context = await getLeaveFormContext(actor);
  const [balances, requests] = await Promise.all([getMyBalances(actor, context.year), listMyLeave(actor)]);
  if (balances.length === 0) {
    return (
      <Card>
        <EmptyState icon={CalendarDays} title="No leave types yet" description="Admin adds leave types in Company Settings. Then you can apply here." />
      </Card>
    );
  }
  return <MyLeave balances={balances} requests={requests} context={context} />;
}

export default function MyLeavePage() {
  return (
    <RoleGate href="/leave/me">
      <PageHeader title="My Leave" description="Apply for leave, see what's left this year and track your requests." />
      <Content />
    </RoleGate>
  );
}
