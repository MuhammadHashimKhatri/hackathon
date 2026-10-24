import PageHeader from "@/components/ui/PageHeader";
import RoleGate from "@/components/shell/RoleGate";
import { getPageActor } from "@/server/auth/session";
import { companyToday } from "@/server/companyToday";
import { getRunForMonth } from "@/server/services/payroll";
import { payrollQuery } from "@/lib/validation/payroll";
import { firstValues } from "@/lib/searchParams";
import PayrollView from "./PayrollView";

export const metadata = { title: "Payroll" };

async function Content({ searchParams }) {
  const actor = await getPageActor();
  const query = payrollQuery.parse(firstValues(await searchParams));
  const month = query.month ?? (await companyToday()).slice(0, 7);
  const data = await getRunForMonth(actor, month);
  return <PayrollView month={month} data={data} role={actor.role} />;
}

export default function PayrollPage({ searchParams }) {
  return (
    <RoleGate href="/payroll">
      <PageHeader
        title="Payroll"
        description="HR generates the month's draft from attendance, leave and salaries. Admin reviews and finalizes it, which locks the month."
      />
      <Content searchParams={searchParams} />
    </RoleGate>
  );
}
