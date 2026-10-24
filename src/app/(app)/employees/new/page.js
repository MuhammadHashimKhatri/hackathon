import RoleGate from "@/components/shell/RoleGate";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import { getPageActor } from "@/server/auth/session";
import { companyToday } from "@/server/companyToday";
import { listDepartments, listDesignations } from "@/server/services/organization";
import RegisterEmployee from "./RegisterEmployee";

export const metadata = { title: "Register employee" };

async function Register() {
  const actor = await getPageActor();
  const [departments, designations, today] = await Promise.all([
    listDepartments(actor),
    listDesignations(actor),
    companyToday(),
  ]);
  return <RegisterEmployee departments={departments} designations={designations} today={today} />;
}

export default function RegisterEmployeePage() {
  return (
    <RoleGate href="/employees/new">
      <PageHeader
        title="Register employee"
        description="Creates their employee record, first salary and a login with a temporary password."
        breadcrumbs={[{ label: "Employees", href: "/employees" }, { label: "Register" }]}
      />
      <Card className="max-w-3xl">
        <Register />
      </Card>
    </RoleGate>
  );
}
