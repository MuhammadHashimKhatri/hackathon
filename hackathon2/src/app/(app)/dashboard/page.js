import { Suspense } from "react";
import { getPageActor } from "@/server/auth/session";
import { listDepartments } from "@/server/services/organization";
import { getAdminDashboard, getEmployeeDashboard, getHrDashboard } from "@/server/services/analytics";
import { getToday } from "@/server/services/attendance";
import { dashboardQuery } from "@/lib/validation/dashboard";
import { firstValues } from "@/lib/searchParams";
import AdminDashboard from "@/components/dashboard/AdminDashboard";
import HrDashboard from "@/components/dashboard/HrDashboard";
import EmployeeDashboard from "@/components/dashboard/EmployeeDashboard";
import Loading from "../loading";

export const metadata = { title: "Dashboard" };

async function RoleDashboard({ searchParams }) {
  const actor = await getPageActor();
  if (actor.role === "employee") {
    const [data, today] = await Promise.all([getEmployeeDashboard(actor), getToday(actor)]);
    return <EmployeeDashboard data={data} today={today} />;
  }
  const filters = dashboardQuery.parse(firstValues(await searchParams));
  if (actor.role === "admin") {
    const [data, departments] = await Promise.all([getAdminDashboard(actor, filters), listDepartments(actor)]);
    return <AdminDashboard data={data} departments={departments} />;
  }
  const [data, departments] = await Promise.all([getHrDashboard(actor, filters), listDepartments(actor)]);
  return <HrDashboard data={data} departments={departments} />;
}

export default function DashboardPage({ searchParams }) {
  return (
    <Suspense fallback={<Loading />}>
      <RoleDashboard searchParams={searchParams} />
    </Suspense>
  );
}
