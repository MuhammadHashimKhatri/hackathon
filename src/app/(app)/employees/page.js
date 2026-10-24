import { Suspense } from "react";
import Link from "next/link";
import { FileSpreadsheet, SearchX, UserPlus, Users } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import Pagination from "@/components/ui/Pagination";
import Skeleton from "@/components/ui/Skeleton";
import Table from "@/components/ui/Table";
import RoleGate from "@/components/shell/RoleGate";
import DirectoryControls from "@/components/employees/DirectoryControls";
import { getPageActor } from "@/server/auth/session";
import { listEmployees } from "@/server/services/employees";
import { listDepartments, listDesignations } from "@/server/services/organization";
import { listEmployeesQuery } from "@/lib/validation/employees";
import { firstValues } from "@/lib/searchParams";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Employees" };

const columns = [
  {
    key: "name",
    header: "Employee",
    render: (e) => (
      <Link href={`/employees/${e.id}`} className="group flex min-w-0 flex-col">
        <span className="font-medium text-ink group-hover:text-accent group-hover:underline">{e.fullName}</span>
        <span className="figure text-[0.8125rem] text-muted">{e.employeeCode}</span>
      </Link>
    ),
  },
  { key: "email", header: "Email", render: (e) => <span className="break-all">{e.email}</span>, hideOnMobile: true },
  {
    key: "job",
    header: "Department",
    render: (e) => (
      <span className="flex flex-col md:items-start">
        <span>{e.departmentName ?? "—"}</span>
        {e.designationTitle ? <span className="text-[0.8125rem] text-muted">{e.designationTitle}</span> : null}
      </span>
    ),
  },
  { key: "joinDate", header: "Joined", render: (e) => formatDate(e.joinDate) },
  { key: "status", header: "Status", render: (e) => <Badge status={e.status} /> },
];

async function Directory({ searchParams }) {
  const actor = await getPageActor();
  const params = firstValues(await searchParams);
  const query = listEmployeesQuery.safeParse(params).data ?? listEmployeesQuery.parse({});
  const filtered = Boolean(query.q || query.department || query.designation || query.status);
  const isHr = actor.role === "hr";

  const [result, departments, designations] = await Promise.all([
    listEmployees(actor, query),
    listDepartments(actor),
    listDesignations(actor),
  ]);

  const empty = filtered ? (
    <EmptyState
      icon={SearchX}
      title="No employees match"
      description="Try another name or code, or clear the filters."
      action={<ButtonLink href="/employees" size="sm">Clear filters</ButtonLink>}
    />
  ) : (
    <EmptyState
      icon={Users}
      title="No employees yet"
      description={isHr ? "Register the first employee. Each one gets their own login." : "HR registers employees; they'll appear here."}
      action={isHr ? <ButtonLink href="/employees/new" variant="primary" icon={UserPlus}>Register employee</ButtonLink> : null}
    />
  );

  return (
    <>
      <PageHeader
        title="Employees"
        description={`${result.total} ${result.total === 1 ? "employee" : "employees"}${filtered ? " match" : ""}`}
        actions={
          isHr ? (
            <>
              <ButtonLink href="/employees/import" icon={FileSpreadsheet}>Import / Export</ButtonLink>
              <ButtonLink href="/employees/new" variant="primary" icon={UserPlus}>Register employee</ButtonLink>
            </>
          ) : null
        }
      />
      <Card>
        <div className="flex flex-col gap-4">
          <DirectoryControls departments={departments} designations={designations} />
          <Table columns={columns} rows={result.rows} caption="Employees" empty={empty} />
          <Pagination page={result.page} pageSize={result.pageSize} total={result.total} />
        </div>
      </Card>
    </>
  );
}

function DirectoryLoading() {
  return (
    <div aria-busy aria-label="Loading employees" className="flex flex-col gap-4">
      <Skeleton className="h-7 w-40" />
      <div className="rounded-xl border border-line bg-surface p-5">
        <Skeleton className="mb-4 h-10 w-full" />
        <Table columns={columns} loading />
      </div>
    </div>
  );
}

export default function EmployeesPage({ searchParams }) {
  return (
    <RoleGate href="/employees">
      <Suspense fallback={<DirectoryLoading />}>
        <Directory searchParams={searchParams} />
      </Suspense>
    </RoleGate>
  );
}
