import RoleGate from "@/components/shell/RoleGate";
import PageHeader from "@/components/ui/PageHeader";
import SettingsTabs from "@/components/settings/SettingsTabs";
import { getPageActor } from "@/server/auth/session";
import { listOrganization } from "@/server/services/organization";
import OrganizationManager from "./OrganizationManager";

export const metadata = { title: "Departments & Designations" };

async function Organization() {
  const actor = await getPageActor();
  const data = await listOrganization(actor);
  const canEdit = actor.role === "admin";
  return (
    <>
      <SettingsTabs readOnly={!canEdit} />
      <OrganizationManager {...data} canEdit={canEdit} />
    </>
  );
}

export default function OrganizationPage() {
  return (
    <RoleGate href="/settings/organization">
      <PageHeader title="Departments & Designations" description="The structure employees are assigned to." />
      <Organization />
    </RoleGate>
  );
}
