import { UserX } from "lucide-react";
import RoleGate from "@/components/shell/RoleGate";
import { ButtonLink } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Employee360 from "@/components/employees/Employee360";
import { AppError } from "@/server/errors";
import { getPageActor } from "@/server/auth/session";
import { getEmployee360 } from "@/server/services/employees";
import { listDepartments, listDesignations } from "@/server/services/organization";

export const metadata = { title: "Employee" };

async function Profile({ params }) {
  const actor = await getPageActor();
  const { id } = await params;
  let data;
  try {
    data = await getEmployee360(actor, id);
  } catch (err) {
    if (!(err instanceof AppError) || err.status !== 404) throw err;
    return (
      <Card>
        <EmptyState
          icon={UserX}
          title="Employee not found"
          description="The link may be wrong, or the record no longer exists."
          action={<ButtonLink href="/employees">Back to employees</ButtonLink>}
        />
      </Card>
    );
  }

  const hr = actor.role === "hr";
  const [departments, designations] = hr ? await Promise.all([listDepartments(actor), listDesignations(actor)]) : [[], []];
  return (
    <Employee360
      data={{ ...data, isOwnRecord: actor.employeeId === id }}
      mode={hr ? "hr" : "admin"}
      departments={departments}
      designations={designations}
    />
  );
}

// Admin and HR (same access as the directory). Employees use /profile.
export default function EmployeePage({ params }) {
  return (
    <RoleGate href="/employees">
      <Profile params={params} />
    </RoleGate>
  );
}
