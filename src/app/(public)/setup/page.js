import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getSetupStatus } from "@/server/services/setup";
import Skeleton from "@/components/ui/Skeleton";
import AuthCard from "../AuthCard";
import SetupWizard from "./SetupWizard";

export const metadata = { title: "Set up" };

async function SetupForm() {
  await connection();
  const status = await getSetupStatus();
  if (status.setupCompleted) redirect("/login");
  return <SetupWizard suggestedEmail={status.suggestedEmail} envPasswordAvailable={status.envPasswordAvailable} />;
}

export default function SetupPage() {
  return (
    <AuthCard title="Set up HCM Lite" description="Name your company and create the first admin account.">
      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <SetupForm />
      </Suspense>
    </AuthCard>
  );
}
