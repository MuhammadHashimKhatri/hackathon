import { Clock } from "lucide-react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import RoleGate from "@/components/shell/RoleGate";
import { getPageActor } from "@/server/auth/session";
import { getCalendar } from "@/server/services/attendance";
import { listMyCorrections } from "@/server/services/corrections";
import { monthQuery } from "@/lib/validation/attendance";
import { firstValues } from "@/lib/searchParams";
import MyAttendance from "./MyAttendance";

export const metadata = { title: "My Attendance" };

async function Month({ searchParams }) {
  const actor = await getPageActor();
  if (!actor.employeeId) {
    return (
      <Card>
        <EmptyState icon={Clock} title="No employee record linked" description="Ask HR to register you as an employee to see your attendance." />
      </Card>
    );
  }
  const query = monthQuery.parse(firstValues(await searchParams));
  const [calendar, corrections] = await Promise.all([getCalendar(actor, query), listMyCorrections(actor)]);
  return <MyAttendance calendar={calendar} corrections={corrections} />;
}

export default function MyAttendancePage({ searchParams }) {
  return (
    <RoleGate href="/attendance/me">
      <PageHeader title="My Attendance" description="Your days by month. If a time is wrong or missing, ask HR to correct it." />
      <Month searchParams={searchParams} />
    </RoleGate>
  );
}
