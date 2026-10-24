import { Suspense } from "react";
import RoleGate from "@/components/shell/RoleGate";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import Pagination from "@/components/ui/Pagination";
import Skeleton from "@/components/ui/Skeleton";
import DirectoryControls from "@/components/employees/DirectoryControls";
import { getPageActor } from "@/server/auth/session";
import { listCurrentSalaries } from "@/server/services/salary";
import { listDepartments, listDesignations } from "@/server/services/organization";
import { listEmployeesQuery } from "@/lib/validation/employees";
import { firstValues } from "@/lib/searchParams";
import SalaryTable from "./SalaryTable";

export const metadata = { title: "Salary Structures" };

async function Salaries({ searchParams }) {
  const actor = await getPageActor();
  const params = firstValues(await searchParams);
  const query = listEmployeesQuery.safeParse(params).data ?? listEmployeesQuery.parse({});
  const filtered = Boolean(query.q || query.department || query.designation || query.status);
  const [result, departments, designations] = await Promise.all([
    listCurrentSalaries(actor, query),
    listDepartments(actor),
    listDesignations(actor),
  ]);

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <DirectoryControls departments={departments} designations={designations} />
        <SalaryTable rows={result.rows} today={result.today} canManage={actor.role === "hr"} currentEmployeeId={actor.employeeId} filtered={filtered} />
        <Pagination page={result.page} pageSize={result.pageSize} total={result.total} />
      </div>
    </Card>
  );
}

export default function SalaryPage({ searchParams }) {
  return (
    <RoleGate href="/salary">
      <PageHeader
        title="Salary Structures"
        description="Basic pay per employee. HRA (40%) and medical (10%) are added on top, so gross is 1.5 times basic."
      />
      <Suspense
        fallback={
          <div aria-busy aria-label="Loading salaries" className="rounded-xl border border-line bg-surface p-5">
            <Skeleton className="mb-4 h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        }
      >
        <Salaries searchParams={searchParams} />
      </Suspense>
    </RoleGate>
  );
}
