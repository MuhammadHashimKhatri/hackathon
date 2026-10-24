import { CalendarDays } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import RoleGate from "@/components/shell/RoleGate";
import CheckInWidget from "@/components/attendance/CheckInWidget";
import { getPageActor } from "@/server/auth/session";
import { getToday } from "@/server/services/attendance";

export const metadata = { title: "Check-in" };

async function Today() {
  const actor = await getPageActor();
  const today = await getToday(actor);
  return (
    <>
      <Card className="mx-auto w-full max-w-xl">
        <div className="py-6 sm:py-10">
          <CheckInWidget today={today} />
        </div>
      </Card>
      {actor.role === "employee" && today.linked ? (
        <div className="mt-4 flex justify-center">
          <ButtonLink href="/attendance/me" variant="ghost" icon={CalendarDays}>
            See my month
          </ButtonLink>
        </div>
      ) : null}
    </>
  );
}

export default function CheckInPage() {
  return (
    <RoleGate href="/check-in">
      <PageHeader title="Check-in" description="Check in when you arrive and check out when you leave. The time comes from the server." />
      <Today />
    </RoleGate>
  );
}
