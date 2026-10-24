import { UserCog } from "lucide-react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";

export const metadata = { title: "Users" };

export default function Page() {
  return (
    <>
      <PageHeader title="Users" description="Logins for Admin and HR, with activation and password resets." />
      <Card>
        <EmptyState
          icon={UserCog}
          title="No HR logins yet"
          description="Admin creates HR logins here; each gets a temporary password shown once."
        />
      </Card>
    </>
  );
}
