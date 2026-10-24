import AuthCard from "../AuthCard";
import SetupWizard from "./SetupWizard";

export const metadata = { title: "Set up" };

export default function SetupPage() {
  return (
    <AuthCard title="Set up HCM Lite" description="Name your company and create the first admin account.">
      <SetupWizard />
    </AuthCard>
  );
}
