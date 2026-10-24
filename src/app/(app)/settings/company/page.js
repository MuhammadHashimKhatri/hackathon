import RoleGate from "@/components/shell/RoleGate";
import PageHeader from "@/components/ui/PageHeader";
import SettingsTabs from "@/components/settings/SettingsTabs";
import { getPageActor } from "@/server/auth/session";
import { getSettings } from "@/server/services/settings";
import CompanySettingsForm from "./CompanySettingsForm";

export const metadata = { title: "Company Settings" };

async function CompanySettings() {
  const actor = await getPageActor();
  const settings = await getSettings(actor);
  const canEdit = actor.role === "admin";
  return (
    <>
      <SettingsTabs readOnly={!canEdit} />
      <CompanySettingsForm initial={settings} canEdit={canEdit} />
    </>
  );
}

export default function CompanySettingsPage() {
  return (
    <RoleGate href="/settings/company">
      <PageHeader
        title="Company Settings"
        description="Office hours, weekend, check-in location and late rules. Changes apply to new records only."
      />
      <CompanySettings />
    </RoleGate>
  );
}
