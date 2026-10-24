import { Suspense } from "react";
import { getPageActor } from "@/server/auth/session";
import AdminDashboard from "@/components/dashboard/AdminDashboard";
import HrDashboard from "@/components/dashboard/HrDashboard";
import EmployeeDashboard from "@/components/dashboard/EmployeeDashboard";
import Loading from "../loading";

export const metadata = { title: "Dashboard" };

const DASHBOARDS = { admin: AdminDashboard, hr: HrDashboard, employee: EmployeeDashboard };

async function RoleDashboard() {
  const { role } = await getPageActor();
  const Dashboard = DASHBOARDS[role];
  return <Dashboard />;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<Loading />}>
      <RoleDashboard />
    </Suspense>
  );
}
