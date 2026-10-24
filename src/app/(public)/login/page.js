import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getSetupStatus } from "@/server/services/setup";
import AuthCard from "../AuthCard";
import LoginForm from "./LoginForm";

export const metadata = { title: "Log in" };

// Second line behind the proxy: after reset.sql a server instance may still
// remember "setup done", so /login checks for itself.
async function RequireSetupDone() {
  await connection();
  const { setupCompleted } = await getSetupStatus();
  if (!setupCompleted) redirect("/setup");
  return null;
}

export default function LoginPage() {
  return (
    <AuthCard title="Log in" description="Use the email and password your admin or HR gave you.">
      <Suspense fallback={null}>
        <RequireSetupDone />
      </Suspense>
      <LoginForm />
    </AuthCard>
  );
}
