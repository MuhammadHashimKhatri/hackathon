import { redirect } from "next/navigation";

// HR's "Company Setup" menu item lands here.
export default function SettingsIndex() {
  redirect("/settings/company");
}
