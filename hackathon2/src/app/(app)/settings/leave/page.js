import RoleGate from "@/components/shell/RoleGate";
import PageHeader from "@/components/ui/PageHeader";
import SettingsTabs from "@/components/settings/SettingsTabs";
import { getPageActor } from "@/server/auth/session";
import { listLeaveTypes } from "@/server/services/leaveTypes";
import { listHolidayYears, listHolidays } from "@/server/services/holidays";
import { yearSchema } from "@/lib/validation/organization";
import LeaveSetup from "./LeaveSetup";

export const metadata = { title: "Leave Types & Holidays" };

async function Leave({ searchParams }) {
  const actor = await getPageActor();
  const params = await searchParams;
  const thisYear = new Date().getFullYear();
  const parsedYear = yearSchema.safeParse(params.year);
  const year = parsedYear.success ? parsedYear.data : thisYear;

  const [leaveTypes, holidays, years] = await Promise.all([
    listLeaveTypes(actor),
    listHolidays(actor, { year }),
    listHolidayYears(actor),
  ]);
  const yearOptions = [...new Set([thisYear, thisYear + 1, year, ...years])].sort();
  const canEdit = actor.role === "admin";

  return (
    <>
      <SettingsTabs readOnly={!canEdit} />
      <LeaveSetup
        tab={params.tab === "holidays" ? "holidays" : "types"}
        leaveTypes={leaveTypes}
        holidays={holidays}
        year={year}
        yearOptions={yearOptions}
        canEdit={canEdit}
      />
    </>
  );
}

export default function LeaveSettingsPage({ searchParams }) {
  return (
    <RoleGate href="/settings/leave">
      <PageHeader
        title="Leave Types & Holidays"
        description="Yearly leave quotas and the holiday calendar used to count working days."
      />
      <Leave searchParams={searchParams} />
    </RoleGate>
  );
}
